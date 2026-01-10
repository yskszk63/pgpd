import { assertEquals } from "@std/assert";
import { serialize } from "~/proto/ser.ts";

type Test = {
  input: Parameters<typeof serialize>[0];
  wants: ReturnType<typeof serialize>;
};

const tests: Test[] = [
  {
    input: {
      type: "Describe",
      describeType: "S",
      name: "a",
    },
    wants: Uint8Array.from([
      0x44, // D
      0x00,
      0x00,
      0x00,
      0x07, // 7
      0x53, // [S]
      0x61,
      0x00, // "a"
    ]),
  },
  {
    input: {
      type: "Parse",
      text: "Q",
      name: "N",
      types: [0],
    },
    wants: Uint8Array.from([
      0x50, // P
      0x00,
      0x00,
      0x00,
      0x0e, // 14
      0x4e,
      0x00, // "N"
      0x51,
      0x00, // "Q"
      0x00,
      0x01, // 1
      0x00,
      0x00,
      0x00,
      0x00, // 0
    ]),
  },
  {
    input: {
      type: "PasswordMessage",
      password: "P",
    },
    wants: Uint8Array.from([
      0x70, // p
      0x00,
      0x00,
      0x00,
      0x06, // 6
      0x50,
      0x00, // "P"
    ]),
  },
  {
    input: {
      type: "Query",
      text: "q",
    },
    wants: Uint8Array.from([
      0x51, // Q
      0x00,
      0x00,
      0x00,
      0x06, // 6
      0x71,
      0x00, // "q"
    ]),
  },
  {
    input: {
      type: "SASLInitialResponse",
      mechanism: "M",
      data: Uint8Array.of(1),
    },
    wants: Uint8Array.from([
      0x70, // p
      0x00,
      0x00,
      0x00,
      0x0b, // 11
      0x4d,
      0x00, // "M"
      0x00,
      0x00,
      0x00,
      0x01, // 1
      0x01, // 1
    ]),
  },
  {
    input: {
      type: "SASLResponse",
      data: Uint8Array.of(1),
    },
    wants: Uint8Array.from([
      0x70, // p
      0x00,
      0x00,
      0x00,
      0x05, // 5
      0x01, // 1
    ]),
  },
  {
    input: {
      type: "SSLRequest",
    },
    wants: Uint8Array.from([
      0x00,
      0x00,
      0x00,
      0x08, // 8
      0x04,
      0xd2, // 1234
      0x16,
      0x2f, // 5679
    ]),
  },
  {
    input: {
      type: "StartupMessage",
      opts: {
        "U": "u",
        "V": "v",
      },
    },
    wants: Uint8Array.from([
      0x00,
      0x00,
      0x00,
      0x11, // 17
      0x00,
      0x03, // 3
      0x00,
      0x00, // 0
      0x55,
      0x00, // "U"
      0x75,
      0x00, // "u"
      0x56,
      0x00, // "V"
      0x76,
      0x00, // "v"
      0x00, // terminate
    ]),
  },
  {
    input: {
      type: "Sync",
    },
    wants: Uint8Array.from([
      0x53, // S
      0x00,
      0x00,
      0x00,
      0x04,
    ]),
  },
  {
    input: {
      type: "Terminate",
    },
    wants: Uint8Array.from([
      0x58, // X
      0x00,
      0x00,
      0x00,
      0x04,
    ]),
  },
];

for (const t of tests) {
  Deno.test(JSON.stringify(t.input), () => {
    const actual = serialize(t.input);
    assertEquals(actual, t.wants);
  });
}
