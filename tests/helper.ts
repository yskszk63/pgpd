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
  [Symbol.asyncDispose]: () => Promise<void>;
};

export type RunOpts = {};

export async function runPgServer(opts: RunOpts): Promise<PgServer> {
  await using stack = new AsyncDisposableStack();

  const script = `set -e
openssl req -new -x509 -nodes -days 1 -subj "/CN=test" -out /etc/ssl/postgres/server.crt -keyout /etc/ssl/postgres/server.key
chmod 0400 /etc/ssl/postgres/server.key
chown postgres:postgres /etc/ssl/postgres/server.key
exec docker-entrypoint.sh "$@"
`;

  // $PGDATA/postgresql.conf

  const database = "postgres";
  const user = "postgres";
  const password = "password";

  const containerId = await docker(
    "run",
    "--rm",
    "-d",
    `-ePOSTGRES_DB=${database}`,
    `-ePOSTGRES_USER=${user}`,
    `-ePOSTGRES_PASSWORD=${password}`,
    "-ePOSTGRES_INITDB_ARGS=--auth-host=md5",
    "--network",
    "bridge",
    "--mount",
    `type=tmpfs,target=/etc/ssl/postgres`,
    "postgres",
    "bash",
    "-c",
    script,
    "--",
    "postgres",
    "-c",
    "ssl=on",
    "-c",
    "ssl_cert_file=/etc/ssl/postgres/server.crt",
    "-c",
    "ssl_key_file=/etc/ssl/postgres/server.key",
  );

  stack.defer(() => docker("kill", containerId).then(() => {}));

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

  const defer = stack.move();

  return {
    addr,
    port: 5432,
    database,
    user,
    password,
    [Symbol.asyncDispose]: async () => {
      await using _ = defer;
    },
  };
}
