import * as process from "node:process";
import * as net from "node:net";
import { Buffer } from "node:buffer";
import * as crypt from "node:crypto";
import * as fs from "node:fs/promises";

import * as z from "zod/mini";

import {
  zAuthenticationMD5Password,
  zDataRowMessage,
  zParameterDescriptionMessage,
  zRowDescriptionMessage,
} from "./types.ts";
import type { Connection, ConnectOpts } from "./conn.ts";
import { connect, FatalError } from "./conn.ts";
import { parse as parseUrl } from "./url.ts";
import path from "node:path";

export type OpenOpts = ConnectOpts & {
  host: string;
  port?: number | undefined;
};

function isUds(opts: OpenOpts): boolean {
  return opts.host.startsWith("/");
}

async function writePasswordMessageMd5(
  conn: Connection,
  salt: Buffer,
  opts: OpenOpts,
): Promise<void> {
  const hasher = crypt.createHash("md5");
  hasher.update(opts.password).update(opts.user);
  const h1 = hasher.digest("hex");

  const hasher2 = crypt.createHash("md5");
  const h2 = hasher2.update(h1).update(salt).digest("hex");

  await conn.write("password", `md5${h2}`);
}

async function handleAuthentication(
  conn: Connection,
  opts: OpenOpts,
): Promise<void> {
  for await (const msg of conn.readUntilReady()) {
    switch (msg.name) {
      case "authenticationOk":
        return;

      case "authenticationMD5Password": {
        const { salt } = zAuthenticationMD5Password.parse(msg);
        await writePasswordMessageMd5(conn, salt, opts);
        break;
      }

      default:
        throw new Error(`Not implemented ${msg.name}`);
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
  conn: Connection,
): Promise<Type[]> {
  const sql =
    "SELECT t.oid, n.nspname, t.typname, format_type(t.oid, NULL) AS sql_type FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace ORDER BY t.oid";
  await conn.write("query", sql);

  const types: Type[] = [];
  for await (const msg of conn.readUntilReady()) {
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

      default:
        throw new Error(`Not implemented ${msg.name}`);
    }
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
  parameters: DescribeResultParameter[];
  rows?: DescribeResultRow[] | undefined;
};

async function describe(
  conn: Connection,
  types: Record<number, Type>,
  text: string,
): Promise<DescribeResult> {
  await conn.write("parse", {
    text,
  });
  await conn.write("describe", {
    type: "S",
  });
  await conn.write("sync");

  const result: DescribeResult = { parameters: [] };
  for await (const msg of conn.readUntilReady()) {
    switch (msg.name) {
      case "parseComplete":
      case "noData":
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

      default:
        throw new Error(`Not implemented ${msg.name}`);
    }
  }

  return result;
}

const DEFAULT_PORT = 5432;

function connectTcp(opts: OpenOpts): Promise<net.Socket> {
  return new Promise<net.Socket>((resolve, reject) => {
    const sock = net.connect({
      host: opts.host,
      port: opts.port ?? DEFAULT_PORT,
    });
    sock.once("connect", () => resolve(sock));
    sock.once("error", reject);
  });
}

async function connectUds(opts: OpenOpts): Promise<net.Socket> {
  const p = path.join(opts.host, `.s.PGSQL.${opts.port ?? DEFAULT_PORT}`);
  // NOTE:
  // Deno needs --allow-read for UDS connect, but net.connect({ path })
  // does not prompt for it. Explicit stat() makes the permission error visible.
  await fs.stat(p);
  return new Promise<net.Socket>((resolve, reject) => {
    const sock = net.connect({
      path: p,
    });
    sock.once("connect", () => resolve(sock));
    sock.once("error", reject);
  });
}

async function connectSocket(opts: OpenOpts): Promise<net.Socket> {
  if (isUds(opts)) {
    return await connectUds(opts);
  }
  return await connectTcp(opts);
}

async function tryConnectAuthenticate(
  opts: OpenOpts,
): Promise<[net.Socket, Connection]> {
  await using stack = new AsyncDisposableStack();

  const sock = await connectSocket(opts);
  stack.defer(() => void sock.end());

  if (typeof opts.sslmode === "undefined" && isUds(opts)) {
    opts.sslmode = "disable";
  }

  const conn = await connect(sock, opts);

  await conn.write("startup", {
    user: opts.user,
  });

  await handleAuthentication(conn, opts);

  stack.move();

  return [sock, conn];
}

async function connectAuthenticate(
  opts: OpenOpts,
): Promise<[net.Socket, Connection]> {
  const maxRetry = 5;
  let attempt = 0;

  while (true) {
    try {
      return await tryConnectAuthenticate(opts);
    } catch (e) {
      if (attempt++ > maxRetry) {
        throw e;
      }

      if (!(e instanceof FatalError)) {
        throw e;
      }
    }
  }
}

export type Client = {
  describe: (text: string) => Promise<DescribeResult>;
  [Symbol.asyncDispose]: () => Promise<void>;
};

export async function open(
  opts: OpenOpts | string | undefined = process.env["DATABASE_URL"],
): Promise<Client> {
  if (typeof opts === "undefined") {
    throw new Error(`no DATABASE_URL`);
  }

  if (typeof opts === "string") {
    opts = parseUrl(opts);
  }

  await using stack = new AsyncDisposableStack();

  const [sock, conn] = await connectAuthenticate(opts);

  for await (const msg of conn.readUntilReady()) {
    switch (msg.name) {
      case "parameterStatus":
      case "backendKeyData":
        break;

      default:
        throw new Error(`Not implemented ${msg.name}`);
    }
  }

  const types: Record<number, Type> = Object.fromEntries(
    (await selectTypes(conn)).map((v) => [v.oid, v]),
  );

  stack.move();
  return {
    describe: describe.bind(null, conn, types),
    [Symbol.asyncDispose]: async () => {
      await conn.write("end");
      await new Promise<void>((resolve) => sock.end(resolve));
    },
  };
}
