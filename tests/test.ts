import { assertEquals, assertRejects } from "@std/assert";
import { runPgServer } from "./helper.ts";
import { open } from "~/mod.ts";

Deno.test("test", async () => {
  await using pg = await runPgServer({});

  await using client = await open({
    host: pg.addr,
    port: pg.port,
    user: pg.user,
    password: pg.password,
    database: pg.database,
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
