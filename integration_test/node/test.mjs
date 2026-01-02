import * as assert from "node:assert";
import { open } from "pgpd";

const sql = `SELECT t.oid, n.nspname, t.typname, format_type(t.oid, NULL) AS sql_type FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.oid = $1 ORDER BY t.oid`;

await using client = await open();
const result = await client.describe(sql);
assert.deepEqual(result, {
  parameters: [
    {
      type: {
        oid: 26,
        schema: "pg_catalog",
        name: "oid",
        sqlType: "oid",
      },
    },
  ],
  rows: [
    {
      name: "oid",
      type: {
        oid: 26,
        schema: "pg_catalog",
        name: "oid",
        sqlType: "oid",
      },
      format: "text",
    },
    {
      name: "nspname",
      type: {
        oid: 19,
        schema: "pg_catalog",
        name: "name",
        sqlType: "name",
      },
      format: "text",
    },
    {
      name: "typname",
      type: {
        oid: 19,
        schema: "pg_catalog",
        name: "name",
        sqlType: "name",
      },
      format: "text",
    },
    {
      name: "sql_type",
      type: {
        oid: 25,
        schema: "pg_catalog",
        name: "text",
        sqlType: "text",
      },
      format: "text",
    },
  ],
});
