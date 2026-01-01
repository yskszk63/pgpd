import { runPgServer } from "./helper.ts";
import type { AuthMethod } from "./helper.ts";
import { open } from "~/client.ts";

const methods: AuthMethod[] = [
  "trust",
  "password",
  "md5",
  "scram-sha-256",
];

methods.forEach((method) =>
  Deno.test(method, async () => {
    await using pg = await runPgServer({ authMethod: method });
    await using _ = await open({
      host: pg.addr,
      port: pg.port,
      user: pg.user,
      sslmode: "disable",
      password: pg.password,
      database: pg.database,
    });
  })
);
