import path from "node:path";
import { setTimeout } from "node:timers/promises";

import * as z from "zod/mini";

const zDockerInspectOutput = z.array(z.object({
  NetworkSettings: z.object({
    Networks: z.record(
      z.string(),
      z.object({
        IPAddress: z.string(),
      }),
    ),
  }),
}));

async function docker(...args: string[]): Promise<string> {
  const proc = new Deno.Command("docker", {
    args,
    stdin: "null",
    stdout: "piped",
    stderr: "inherit",
  });
  const { success, stdout } = await proc.output();
  if (!success) {
    throw new Error("Failed to launch postgres");
  }

  return new TextDecoder().decode(stdout);
}

export type PgServer = {
  readonly addr: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly sockdir: string;
  [Symbol.asyncDispose]: () => Promise<void>;
};

export type AuthMethod =
  | "trust"
  | "reject"
  | "scram-sha-256"
  | "md5"
  | "password"
  | "gss"
  | "sspi"
  | "ident"
  | "peer"
  | "ldap"
  | "radius"
  | "cert"
  | "pam"
  | "bsd";

export type RunOpts = {
  ssl?: boolean | undefined;
  authMethod?: AuthMethod | undefined;
};

export async function runPgServer(opts?: RunOpts): Promise<PgServer> {
  await using stack = new AsyncDisposableStack();

  const tmpdir = await Deno.makeTempDir({ prefix: "pgpd-test-sock-" });
  stack.defer(() => Deno.remove(tmpdir, { recursive: true }));

  await Deno.chmod(tmpdir, 0o777);

  const sockdir = path.join(tmpdir, "sock");
  Deno.mkdir(sockdir);

  let script: string;
  if (opts?.ssl === true) {
    script = `set -e
fcert=/etc/ssl/postgres/server.crt
fkey=/etc/ssl/postgres/server.key

[[ -f "$fcert" ]] || {
  openssl req -new -x509 -nodes -days 1 -subj "/CN=test" -out "$fcert" -keyout "$fkey"
  chmod 0400 /etc/ssl/postgres/server.key
  chown postgres:postgres /etc/ssl/postgres/server.key
}

exec docker-entrypoint.sh postgres -cssl=on -cssl_cert_file="$fcert" -cssl_key_file="$fkey"
`;
  } else {
    script = "exec docker-entrypoint.sh postgres";
  }
  // $PGDATA/postgresql.conf

  const database = "postgres";
  const user = "postgres";
  const password = "password";

  const authMethod = opts?.authMethod ?? "md5";
  const containerId = await docker(
    "run",
    "--rm",
    "-d",
    `-ePOSTGRES_DB=${database}`,
    `-ePOSTGRES_USER=${user}`,
    `-ePOSTGRES_PASSWORD=${password}`,
    `-ePOSTGRES_INITDB_ARGS=--auth-host=${authMethod} --nosync`,
    `-ePOSTGRES_HOST_AUTH_METHOD=${authMethod}`,
    "-ePGDATA=/var/lib/postgresql/data",
    "--network",
    "bridge",
    "--mount",
    `type=tmpfs,target=/etc/ssl/postgres`,
    "--mount",
    `type=tmpfs,target=/var/lib/postgresql/data`,
    "--mount",
    `type=bind,source=${sockdir},target=/var/run/postgresql`,
    "postgres",
    "bash",
    "-c",
    script,
    "--",
    "-cfsync=off",
    "-cshared_buffers=8M",
  );

  stack.defer(() => docker("stop", containerId).then(() => {}));

  const data = await docker(
    "container",
    "inspect",
    containerId,
  );
  const [parsed] = zDockerInspectOutput.parse(JSON.parse(data));
  const addr = parsed?.NetworkSettings?.Networks?.bridge?.IPAddress;
  if (typeof addr === "undefined") {
    throw new Error("Failed to inspect");
  }

  const maxRetry = 100;
  let attempt = 0;

  while (true) {
    if (attempt++ > maxRetry) {
      throw new Error("Failed to connect");
    }

    try {
      using _conn = await Deno.connect({ hostname: addr, port: 5432 });
      break;
    } catch (e) {
      if ((e as { code?: unknown }).code !== "ECONNREFUSED") {
        throw e;
      }
    }
    await setTimeout(100);
  }

  //console.log(await Deno.stat(sockdir + "/.s.PGSQL.5432"));

  const defer = stack.move();

  return {
    addr,
    port: 5432,
    database,
    user,
    password,
    sockdir,
    [Symbol.asyncDispose]: async () => {
      await using _ = defer;
    },
  };
}
