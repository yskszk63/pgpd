import { assertEquals } from "@std/assert";
import { deserialize } from "~/proto/de.ts";

type Test = {
  input: Parameters<typeof deserialize>[0];
  wants: ReturnType<typeof deserialize>;
};

const tests: Test[] = [
  {
    input: [Uint8Array.of()],
    wants: [[], []],
  },
  {
    input: [Uint8Array.fromHex("6e000000")],
    wants: [[], [Uint8Array.fromHex("6e000000")]],
  },

  // TODO length check

  // R
  {
    input: [Uint8Array.fromHex("5200000008")],
    wants: [[], [Uint8Array.fromHex("5200000008")]],
  },
  {
    input: [Uint8Array.fromHex("5200000008" + "00000000")],
    wants: [[{ type: "AuthenticationOk" }], []],
  },
  {
    input: [Uint8Array.fromHex("5200000008" + "00000002")],
    wants: [[{ type: "AuthenticationKerberosV5" }], []],
  },
  {
    input: [Uint8Array.fromHex("5200000008" + "00000003")],
    wants: [[{ type: "AuthenticationCleartextPassword" }], []],
  },
  {
    input: [Uint8Array.fromHex("520000000c" + "00000005" + "12345678")],
    wants: [[{
      type: "AuthenticationMD5Password",
      salt: Uint8Array.fromHex("12345678"),
    }], []],
  },
  {
    input: [Uint8Array.fromHex("5200000008" + "00000007")],
    wants: [[{ type: "AuthenticationGSS" }], []],
  },
  {
    input: [Uint8Array.fromHex("520000000a" + "00000008" + "1234")],
    wants: [[{
      type: "AuthenticationGSSContinue",
      data: Uint8Array.fromHex("1234"),
    }], []],
  },
  {
    input: [Uint8Array.fromHex("5200000008" + "00000009")],
    wants: [[{ type: "AuthenticationSSPI" }], []],
  },
  {
    input: [Uint8Array.fromHex("520000000d" + "0000000a" + "6100620000")],
    wants: [[{ type: "AuthenticationSASL", mechanisms: ["a", "b"] }], []],
  },
  {
    input: [Uint8Array.fromHex("520000000a" + "0000000b" + "2345")],
    wants: [[{
      type: "AuthenticationSASLContinue",
      data: Uint8Array.fromHex("2345"),
    }], []],
  },
  {
    input: [Uint8Array.fromHex("520000000a" + "0000000c" + "3456")],
    wants: [[{
      type: "AuthenticationSASLFinal",
      data: Uint8Array.fromHex("3456"),
    }], []],
  },

  // K
  {
    input: [Uint8Array.fromHex("4b0000000c" + "12345671" + "23456712")],
    wants: [[{ type: "BackendKeyData", pid: 0x12345671, key: 0x23456712 }], []],
  },

  // 2
  {
    input: [Uint8Array.fromHex("3200000004")],
    wants: [[{ type: "BindComplete" }], []],
  },

  // 3
  {
    input: [Uint8Array.fromHex("3300000004")],
    wants: [[{ type: "CloseComplete" }], []],
  },

  // C
  {
    input: [Uint8Array.fromHex("4300000006" + "6100")],
    wants: [[{ type: "CommandComplete", tag: "a" }], []],
  },

  // d
  {
    input: [Uint8Array.fromHex("6400000006" + "6100")],
    wants: [[{ type: "CopyData", data: Uint8Array.fromHex("6100") }], []],
  },

  // c
  {
    input: [Uint8Array.fromHex("6300000004")],
    wants: [[{ type: "CopyDone" }], []],
  },

  // G
  {
    input: [Uint8Array.fromHex("470000000b" + "01000200010000")],
    wants: [[{
      type: "CopyInResponse",
      format: "binary",
      columns: ["binary", "text"],
    }], []],
  },

  // H
  {
    input: [Uint8Array.fromHex("480000000b" + "01000200010000")],
    wants: [[{
      type: "CopyOutResponse",
      format: "binary",
      columns: ["binary", "text"],
    }], []],
  },

  // W
  {
    input: [Uint8Array.fromHex("570000000b" + "01000200010000")],
    wants: [[{
      type: "CopyBothResponse",
      format: "binary",
      columns: ["binary", "text"],
    }], []],
  },

  // D
  {
    input: [Uint8Array.fromHex("440000000f" + "0002ffffffff" + "0000000161")],
    wants: [
      [{ type: "DataRow", values: [null, Uint8Array.fromHex("61")] }],
      [],
    ],
  },

  // I
  {
    input: [Uint8Array.fromHex("4900000004")],
    wants: [[{ type: "EmptyQueryResponse" }], []],
  },

  // E
  {
    input: [Uint8Array.fromHex("4500000008" + "4d450000")],
    wants: [[{ type: "ErrorResponse", fields: [["M", "E"]] }], []],
  },

  // V
  {
    input: [Uint8Array.fromHex("5600000009" + "0000000161")],
    wants: [
      [{ type: "FunctionCallResponse", data: Uint8Array.fromHex("61") }],
      [],
    ],
  },

  // v
  {
    input: [Uint8Array.fromHex("760000000e" + "12344321000000016100")],
    wants: [[{
      type: "NegotiateProtocolVersion",
      version: 0x12344321,
      opts: ["a"],
    }], []],
  },

  // n
  {
    input: [Uint8Array.fromHex("6e00000004")],
    wants: [[{ type: "NoData" }], []],
  },

  // N
  {
    input: [Uint8Array.fromHex("4e00000008" + "4d450000")],
    wants: [[{ type: "NoticeResponse", fields: [["M", "E"]] }], []],
  },

  // A
  {
    input: [Uint8Array.fromHex("410000000c" + "1234567841004200")],
    wants: [[{
      type: "NotificationResponse",
      pid: 0x12345678,
      channel: "A",
      payload: "B",
    }], []],
  },

  // t
  {
    input: [Uint8Array.fromHex("740000000e" + "00020000000200000001")],
    wants: [[{ type: "ParameterDescription", types: [2, 1] }], []],
  },

  // S
  {
    input: [Uint8Array.fromHex("5300000008" + "61006200")],
    wants: [[{ type: "ParameterStatus", name: "a", value: "b" }], []],
  },

  // 1
  {
    input: [Uint8Array.fromHex("3100000004")],
    wants: [[{ type: "ParseComplete" }], []],
  },

  // s
  {
    input: [Uint8Array.fromHex("7300000004")],
    wants: [[{ type: "PortalSuspended" }], []],
  },

  // Z
  {
    input: [Uint8Array.fromHex("5a00000005" + "54")],
    wants: [[{ type: "ReadyForQuery", status: "T" }], []],
  },

  // T
  {
    input: [Uint8Array.fromHex(
      "540000002e" + "0002" + "4100000000010002000000030004000000050001" +
        "42000000000600070000000800090000000a0000",
    )],
    wants: [[{
      type: "RowDescription",
      fields: [
        {
          name: "A",
          tableoid: 1,
          columnoid: 2,
          oid: 3,
          len: 4,
          mod: 5,
          format: "binary",
        },
        {
          name: "B",
          tableoid: 6,
          columnoid: 7,
          oid: 8,
          len: 9,
          mod: 10,
          format: "text",
        },
      ],
    }], []],
  },

  // Multiple
  {
    input: [Uint8Array.fromHex("6300000004".repeat(2))],
    wants: [[{ type: "CopyDone" }, { type: "CopyDone" }], []],
  },
  {
    input: [Uint8Array.fromHex("6300000004".repeat(3))],
    wants: [
      [{ type: "CopyDone" }, { type: "CopyDone" }, { type: "CopyDone" }],
      [],
    ],
  },
  {
    input: [
      Uint8Array.fromHex("630000"),
      Uint8Array.fromHex("0004" + "6300000004"),
    ],
    wants: [[{ type: "CopyDone" }, { type: "CopyDone" }], []],
  },
  {
    input: [Uint8Array.fromHex("6300000004" + "63000000")],
    wants: [[{ type: "CopyDone" }], [Uint8Array.fromHex("63000000")]],
  },
  {
    input: [Uint8Array.fromHex("6300000004" + "6300000004" + "00")],
    wants: [[{ type: "CopyDone" }, { type: "CopyDone" }], [
      Uint8Array.fromHex("00"),
    ]],
  },
];

for (const t of tests) {
  Deno.test("test" + t.input.reduce((l, r) => l + r.toHex(), ""), () => {
    const actual = deserialize(t.input);
    assertEquals(actual, t.wants);
  });
}
