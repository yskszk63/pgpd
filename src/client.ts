import * as process from "node:process";
import * as net from "node:net";
import * as fs from "node:fs/promises";
import path from "node:path";

import * as z from "zod/mini";

import {
  zDataRowMessage,
  zParameterDescriptionMessage,
  zRowDescriptionMessage,
} from "./types.ts";
import type { Connection } from "./conn.ts";
import { connect, FatalError } from "./conn.ts";
import { parse as parseUrl } from "./url.ts";
import { checkAndFillDefault } from "./opts.ts";
import type { CheckedOpts } from "./opts.ts";
import { handleAuthentication } from "./auth.ts";
import type {
  Client,
  DescribeResult,
  open as opendecl,
  Opts,
  Type,
} from "./api.ts";

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

function connectTcp(opts: CheckedOpts): Promise<net.Socket> {
  return new Promise<net.Socket>((resolve, reject) => {
    const sock = net.connect({
      host: opts.host,
      port: opts.port ?? DEFAULT_PORT,
    });
    sock.once("connect", () => resolve(sock));
    sock.once("error", reject);
  });
}

async function connectUds(opts: CheckedOpts): Promise<net.Socket> {
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

async function connectSocket(opts: CheckedOpts): Promise<net.Socket> {
  if (opts._connection === "uds") {
    return await connectUds(opts);
  }
  return await connectTcp(opts);
}

async function tryConnectAuthenticate(
  opts: CheckedOpts,
): Promise<[net.Socket, Connection]> {
  await using stack = new AsyncDisposableStack();

  const sock = await connectSocket(opts);
  stack.defer(() => void sock.end());

  const conn = await connect(sock, opts);

  await conn.write("startup", {
    user: opts.user,
  });

  await handleAuthentication(conn, opts);

  stack.move();

  return [sock, conn];
}

async function connectAuthenticate(
  opts: CheckedOpts,
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

/**
 * Get client instance.
 *
 * @example
 * ```ts ignore
 * // opts from `DATABASE_URL` environment variable.
 * await using client = await open();
 * ...
 *
 * // default values from `PG***` environment variables.
 * await using client = await open({});
 * ...
 *
 * // explicitly
 * await using client = await open({
 *   host: "host",
 *   port: 5432,
 *   sslmode: "require",
 *   user: "user",
 *   password: "pass",
 *   database: "mydb",
 * });
 * ```
 */
export async function open(
  opts: Opts | string | undefined = process.env["DATABASE_URL"],
): Promise<Client> {
  if (typeof opts === "undefined") {
    throw new Error(`no DATABASE_URL`);
  }

  if (typeof opts === "string") {
    opts = parseUrl(opts);
  }

  const checked = checkAndFillDefault(opts);

  await using stack = new AsyncDisposableStack();

  const [sock, conn] = await connectAuthenticate(checked);
  stack.defer(() => new Promise((resolve) => sock.end(resolve)));
  stack.defer(() => conn.write("end"));

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

  const defer = stack.move();
  return {
    describe: describe.bind(null, conn, types),
    [Symbol.asyncDispose]: async () => {
      await using _ = defer;
    },
  };
}

open satisfies typeof opendecl;
