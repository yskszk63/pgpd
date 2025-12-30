import { open } from "~/mod.ts";
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

let containerId: string | undefined;
let addr: string = "";
let port: number = 0;

Deno.test.beforeAll(async () => {
  const script = `set -e
openssl req -new -x509 -nodes -days 1 -subj "/CN=test" -out /etc/ssl/postgres/server.crt -keyout /etc/ssl/postgres/server.key
chmod 0400 /etc/ssl/postgres/server.key
chown postgres:postgres /etc/ssl/postgres/server.key
exec docker-entrypoint.sh postgres "$@"
`;
  containerId = await docker(
    "run",
    "--rm",
    "-d",
    "-ePOSTGRES_PASSWORD=password",
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
    "-c",
    "ssl=on",
    "-c",
    "ssl_cert_file=/etc/ssl/postgres/server.crt",
    "-c",
    "ssl_key_file=/etc/ssl/postgres/server.key",
  );

  const data = await docker(
    "container",
    "inspect",
    containerId,
  );
  const [parsed] = zDockerInspectOutput.parse(JSON.parse(data));
  const _addr = parsed?.NetworkSettings?.Networks?.bridge?.IPAddress;
  if (typeof _addr === "undefined") {
    throw new Error("Failed to inspect");
  }

  const maxRetry = 100;
  let attempt = 0;

  while (true) {
    if (attempt++ > maxRetry) {
      throw new Error("Failed to connect");
    }

    try {
      const conn = await Deno.connect({ hostname: _addr, port: 5432 });
      conn.close();
      break;
    } catch (e) {
      if ((e as { code?: unknown }).code !== "ECONNREFUSED") {
        throw e;
      }
    }
    await setTimeout(100);
  }

  addr = _addr;
  port = 5432;
});

Deno.test.afterAll(async () => {
  if (typeof containerId === "undefined") {
    return;
  }

  await docker(
    "kill",
    containerId,
  );
});

Deno.test("test", async () => {
  const { assertEquals, assertRejects } = await import(
    "@std/assert"
  );

  await using client = await open({
    host: addr,
    port,
    user: "postgres",
    password: "password",
  });

  const result = await client.describe(
    "SELECT $1::text, $2::int as a, $3::int as a",
  );
  assertEquals(result, {
    parameters: [
      {
        type: {
          oid: 25,
          name: "text",
          schema: "pg_catalog",
          sqlType: "text",
        },
      },
      {
        type: {
          oid: 23,
          name: "int4",
          schema: "pg_catalog",
          sqlType: "integer",
        },
      },
      {
        type: {
          oid: 23,
          name: "int4",
          schema: "pg_catalog",
          sqlType: "integer",
        },
      },
    ],
    rows: [
      {
        name: "text",
        type: {
          name: "text",
          oid: 25,
          schema: "pg_catalog",
          sqlType: "text",
        },
        format: "text",
      },
      {
        name: "a",
        type: {
          name: "int4",
          oid: 23,
          schema: "pg_catalog",
          sqlType: "integer",
        },
        format: "text",
      },
      {
        name: "a",
        type: {
          name: "int4",
          oid: 23,
          schema: "pg_catalog",
          sqlType: "integer",
        },
        format: "text",
      },
    ],
  });
  await assertRejects(() =>
    client.describe("SELECT $1::text, $2::int as a, $3::int as a from x")
  );
  const result2 = await client.describe(
    "SELECT $1::text, $2::int as a, $3::int as a",
  );
  assertEquals(result2, result);
});
