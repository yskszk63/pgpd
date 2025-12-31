import { assertEquals } from "@std/assert";
import { parse } from "~/url.ts";

type Test = {
  url: string;
  wants: ReturnType<typeof parse>;
};

const tests: Test[] = [
  {
    url: "postgres://user:pass@example.com/db",
    wants: {
      host: "example.com",
      port: void 0,
      user: "user",
      password: "pass",
      database: "db",
      sslmode: "verify-full",
    },
  },
  {
    url:
      "postgres://user:pass@example.com:1234/db?host=example.org&sslmode=disable",
    wants: {
      host: "example.org",
      port: 1234,
      user: "user",
      password: "pass",
      database: "db",
      sslmode: "disable",
    },
  },
  {
    url: "postgres:///db?host=/var/lib/postgres&user=user&password=pass",
    wants: {
      host: "/var/lib/postgres",
      port: void 0,
      user: "user",
      password: "pass",
      database: "db",
      sslmode: "disable",
    },
  },
];

tests.forEach((t) => {
  Deno.test(t.url, () => {
    const actual = parse(t.url);
    assertEquals(actual, t.wants);
  });
});
