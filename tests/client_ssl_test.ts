import { runPgServer } from "./helper.ts";
import { open } from "~/client.ts";

Deno.test("ssl", async () => {
  await using pg = await runPgServer({ ssl: true });
  await using _ = await open({
    host: pg.addr,
    port: pg.port,
    user: pg.user,
    sslmode: "require",
    password: pg.password,
    database: pg.database,
  });
});
