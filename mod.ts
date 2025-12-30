import * as net from "node:net";
import * as tls from "node:tls";
import { Buffer } from "node:buffer";
import * as crypt from "node:crypto";

import * as proto from "pg-protocol";
import * as z from "zod/mini";

const zAuthenticationMD5Password = z.object({
  salt: z.custom<Buffer>((v) => v instanceof Buffer),
});

const zParameterDescriptionMessage = z.object({
  parameterCount: z.number(),
  dataTypeIDs: z.array(z.number()),
});

const zRowDescriptionMessage = z.object({
  fieldCount: z.number(),
  fields: z.array(z.object({
    name: z.string(),
    tableID: z.number(),
    columnID: z.number(),
    dataTypeID: z.number(),
    dataTypeSize: z.number(),
    dataTypeModifier: z.number(),
    format: z.union([z.literal("text"), z.literal("binary")]),
  })),
});

const zDataRowMessage = z.object({
  fieldCount: z.number(),
  fields: z.array(z.unknown()),
});

async function wraptls(socket: net.Socket): Promise<net.Socket> {
  socket.write(proto.serialize.requestSsl());
  await new Promise<void>((resolve, reject) => {
    socket.once("data", (buf) => {
      if (buf[0] !== 0x53) {
        reject(new Error("Server REPLY: requestSsl != S"));
      }
      resolve();
    });
  });

  return tls.connect({ socket });
}

type BackendMessage = Parameters<Parameters<typeof proto.parse>[1]>[0];
class ProtoStream extends ReadableStream<BackendMessage> {
  constructor(conn: net.Socket) {
    super({
      start: (controller) => {
        proto.parse(conn, (msg) => {
          controller.enqueue(msg);
        });
      },
    });
  }
}

async function read(
  reader: ReadableStreamDefaultReader<BackendMessage>,
): Promise<BackendMessage> {
  const { done, value } = await reader.read();
  if (done) {
    throw new Error();
  }
  return value;
}

function writePasswordMessageMd5(
  conn: net.Socket,
  salt: Buffer,
  opts: OpenOpts,
): void {
  const hasher = crypt.createHash("md5");
  hasher.update(opts.password).update(opts.user);
  const h1 = hasher.digest("hex");

  const hasher2 = crypt.createHash("md5");
  const h2 = hasher2.update(h1).update(salt).digest("hex");

  conn.write(proto.serialize.password(`md5${h2}`));
}

async function handleAuthentication(
  conn: net.Socket,
  reader: ReadableStreamDefaultReader<BackendMessage>,
  opts: OpenOpts,
): Promise<void> {
  while (true) {
    const msg = await read(reader);
    switch (msg.name) {
      case "authenticationOk":
        return;

      case "authenticationMD5Password": {
        const { salt } = zAuthenticationMD5Password.parse(msg);
        writePasswordMessageMd5(conn, salt, opts);
        break;
      }

      case "error":
        throw msg;

      default:
        throw new Error(`Not implemented ${msg.name}`);
    }
  }
}

async function recovery(
  conn: net.Socket,
  reader: ReadableStreamDefaultReader<BackendMessage>,
) {
  conn.write(proto.serialize.sync());

  while (true) {
    const msg = await read(reader);
    switch (msg.name) {
      case "readyForQuery":
        return;

      case "error":
        throw msg;

      default:
        console.log("DROP", msg);
        // drop
        break;
    }
  }
}

export type Type = {
  oid: number;
  schema: string;
  name: string;
  sqlType: string;
};

const zSelectTypeRow = z.tuple([
  z.string(),
  z.string(),
  z.string(),
  z.string(),
]);

async function selectTypes(
  conn: net.Socket,
  reader: ReadableStreamDefaultReader<BackendMessage>,
): Promise<Type[]> {
  const sql =
    "SELECT t.oid, n.nspname, t.typname, format_type(t.oid, NULL) AS sql_type FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace ORDER BY t.oid";
  conn.write(proto.serialize.query(sql));

  let err: unknown;
  const types: Type[] = [];
  loop:
  while (true) {
    const msg = await read(reader);
    switch (msg.name) {
      case "rowDescription":
      case "commandComplete":
        break;

      case "dataRow": {
        const item = zDataRowMessage.parse(msg);
        const [oid, schema, name, sqlType] = zSelectTypeRow.parse(item.fields);
        types.push({
          oid: Number.parseInt(oid, 10),
          schema,
          name,
          sqlType,
        });
        break;
      }

      case "readyForQuery":
        break loop;

      case "error":
        //await recovery(conn, reader);
        err = msg;
        break;

      default:
        throw new Error(`Not implemented ${msg.name}`);
    }
  }

  if (typeof err !== "undefined") {
    throw err;
  }

  return types;
}

export type DescribeResultParameter = {
  type: Type | Pick<Type, "oid">;
};

export type DescribeResultRow = {
  name: string;
  type: Type | Pick<Type, "oid">;
  format: "text" | "binary";
};

export type DescribeResult = {
  parameters?: DescribeResultParameter[] | undefined;
  rows?: DescribeResultRow[] | undefined;
};

async function describe(
  conn: net.Socket,
  reader: ReadableStreamDefaultReader<BackendMessage>,
  types: Record<number, Type>,
  text: string,
): Promise<DescribeResult> {
  conn.write(proto.serialize.parse({
    text,
  }));
  conn.write(proto.serialize.describe({
    type: "S",
  }));
  conn.write(proto.serialize.sync());

  let err: unknown;
  const result: DescribeResult = {};
  loop:
  while (true) {
    const msg = await read(reader);
    switch (msg.name) {
      case "parseComplete":
        break;

      case "parameterDescription": {
        const item = zParameterDescriptionMessage.parse(msg);
        result.parameters = item.dataTypeIDs.map((v) => ({
          type: types[v] ?? { oid: v },
        }));
        break;
      }

      case "rowDescription": {
        const item = zRowDescriptionMessage.parse(msg);
        result.rows = item.fields.map((v) => ({
          name: v.name,
          type: types[v.dataTypeID] ?? { oid: v.dataTypeID },
          format: v.format,
        }));
        break;
      }

      case "readyForQuery":
        break loop;

      case "error":
        //await recovery(conn, reader);
        err = msg;
        break;

      default:
        throw new Error(`Not implemented ${msg.name}`);
    }
  }

  if (typeof err !== "undefined") {
    throw err;
  }

  return result;
}

type Client = {
  describe: (text: string) => Promise<DescribeResult>;
  [Symbol.asyncDispose]: () => Promise<void>;
};

export type OpenOpts = {
  host: string;
  port: number;
  tls?: boolean | undefined;
  user: string;
  password: string;
  database?: string | undefined;
};

export async function open(opts: OpenOpts): Promise<Client> {
  using stack = new DisposableStack();

  const sock = await new Promise<net.Socket>((resolve, reject) => {
    const sock = net.connect({
      host: opts.host,
      port: opts.port,
    });
    sock.once("connect", () => resolve(sock));
    sock.once("error", reject);
  });
  stack.defer(() => sock.end());

  const conn = opts.tls === true ? await wraptls(sock) : sock;
  const stream = new ProtoStream(conn);
  const reader = stream.getReader();

  conn.write(proto.serialize.startup({
    user: opts.user,
  }));
  await handleAuthentication(conn, reader, opts);

  loop:
  while (true) {
    const msg = await read(reader);
    switch (msg.name) {
      case "parameterStatus":
      case "backendKeyData":
        break;

      case "readyForQuery":
        break loop;

      case "error":
        throw msg;

      default:
        throw new Error(`Not implemented ${msg.name}`);
    }
  }

  const types: Record<number, Type> = Object.fromEntries(
    (await selectTypes(conn, reader)).map((v) => [v.oid, v]),
  );

  stack.move();
  return {
    describe: describe.bind(null, conn, reader, types),
    [Symbol.asyncDispose]: async () => {
      await new Promise<void>((resolve) => sock.end(resolve));
    },
  };
}
