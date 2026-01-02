import { assertEquals } from "@std/assert";
import { checkAndFillDefault } from "~/opts.ts";
import type { CheckedOpts } from "~/opts.ts";
import type { Opts } from "~/api.ts";

type Test = {
  input: Opts;
  env: NodeJS.ProcessEnv;
  wants: CheckedOpts;
};

const tests: Test[] = [
  {
    input: {},
    env: {
      PGHOST: "example.com",
      PGPORT: "15432",
      PGUSER: "user",
      PGPASSWORD: "password",
      PGDATABASE: "db",
      PGSSLMODE: "require",
    },
    wants: {
      _connection: "tcp",
      host: "example.com",
      port: 15432,
      user: "user",
      password: "password",
      database: "db",
      sslmode: "require",
    },
  },
  {
    input: {},
    env: {
      PGHOST: "example.com",
      PGUSER: "user",
    },
    wants: {
      _connection: "tcp",
      host: "example.com",
      port: 5432,
      user: "user",
      password: void 0,
      database: void 0,
      sslmode: "verify-full",
    },
  },
  {
    input: {},
    env: {
      PGHOST: "/var/run/postgresql",
      PGUSER: "user",
    },
    wants: {
      _connection: "uds",
      host: "/var/run/postgresql",
      port: 5432,
      user: "user",
      password: void 0,
      database: void 0,
      sslmode: "disable",
    },
  },
];

tests.forEach((t, i) => {
  Deno.test(String(i), () => {
    const actual = checkAndFillDefault(t.input, t.env);
    assertEquals(actual, t.wants);
  });
});
