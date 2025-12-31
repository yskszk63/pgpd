import { runPgServer } from "./helper.ts";
import { open } from "~/client.ts";

Deno.test("test", async () => {
  await using pg = await runPgServer();
  await using _ = await open({
    host: pg.sockdir,
    user: pg.user,
    password: pg.password,
  });
});
