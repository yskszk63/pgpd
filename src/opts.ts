import process from "node:process";

import type { Opts, SslMode } from "./api.ts";

export type CheckedOpts = {
  readonly _connection: "tcp" | "uds";
  readonly host: string;
  readonly port: number;
  readonly sslmode: SslMode;
  readonly user: string;
  readonly password?: string | undefined;
  readonly database?: string | undefined;
};

export function checkAndFillDefault(
  opts: Opts,
  env = process.env,
): CheckedOpts {
  const host = opts.host ?? env["PGHOST"];
  let port = opts.port;
  if (typeof port === "undefined" && typeof env["PGPORT"] !== "undefined") {
    const n = Number.parseInt(env["PGPORT"], 10);
    if (!Number.isNaN(n)) {
      port = n;
    }
  }
  const database = opts.database ?? env["PGDATABASE"];
  const user = opts.user ?? env["PGUSER"];
  const password = opts.password ?? env["PGPASSWORD"];
  let sslmode = opts.sslmode;
  if (
    typeof sslmode === "undefined" && typeof env["PGSSLMODE"] !== "undefined"
  ) {
    const v = env["PGSSLMODE"];
    switch (v) {
      case "disable":
      case "require":
      case "verify-ca":
      case "verify-full":
        sslmode = v;
        break;

      default:
        break;
    }
  }

  if (typeof host === "undefined") {
    throw new Error("no host specified");
  }
  if (typeof user === "undefined") {
    throw new Error("no user specified");
  }

  const _connection = host.startsWith("/") ? "uds" : "tcp";

  if (typeof sslmode === "undefined") {
    if (_connection === "uds") {
      sslmode = "disable";
    } else {
      sslmode = "verify-full";
    }
  }

  return {
    _connection,
    host,
    port: port ?? 5432,
    sslmode,
    user,
    password,
    database,
  };
}
