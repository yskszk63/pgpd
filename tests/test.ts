import { assertEquals, assertRejects } from "@std/assert";
import { runPgServer } from "./helper.ts";
import type { PgServer } from "./helper.ts";
import { open } from "~/mod.ts";

let srv: PgServer;

Deno.test.beforeAll(async () => {
  srv = await runPgServer();
});

Deno.test.afterAll(async () => {
  await using _ = srv;
});

Deno.test("test", async () => {
  const pg = srv;

  await using client = await open({
    host: pg.addr,
    port: pg.port,
    user: pg.user,
    sslmode: "disable",
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
});

Deno.test("testError", async () => {
  const pg = srv;

  await using client = await open({
    host: pg.addr,
    port: pg.port,
    user: pg.user,
    sslmode: "disable",
    password: pg.password,
    database: pg.database,
  });

  const result = await client.describe("SELECT $1::text");
  await assertRejects(() => client.describe("SELECT $1::textx"));
  const result2 = await client.describe("SELECT $1::text");
  assertEquals(result2, result);
});

Deno.test("testNoResult", async () => {
  const pg = srv;

  await using client = await open({
    host: pg.addr,
    port: pg.port,
    user: pg.user,
    sslmode: "disable",
    password: pg.password,
    database: pg.database,
  });

  const result = await client.describe("ROLLBACK");
  assertEquals(result, {
    parameters: [],
  });
});
