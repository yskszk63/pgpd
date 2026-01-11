import { assertEquals } from "@std/assert";
import { runPgServer } from "../helper.ts";
import { serialize } from "~/proto/ser.ts";
import { DeserializeStream } from "~/proto/stream.ts";

async function read<T>(
  reader: ReadableStreamDefaultReader<T>,
): Promise<T> {
  const { done, value } = await reader.read();
  if (done) {
    throw new Error(`Unexpected EOF`);
  }
  return value;
}

async function write(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  msg: Parameters<typeof serialize>[0],
): Promise<void> {
  await writer.write(serialize(msg));
}

Deno.test("test", async () => {
  await using pg = await runPgServer({ authMethod: "password" });

  retry:
  for (let attempt = 0; attempt < 10; attempt++) {
    await using conn = await Deno.connect({ hostname: pg.addr, port: pg.port });

    const writer = conn.writable.getWriter();
    const reader = conn.readable.pipeThrough(new DeserializeStream())
      .getReader();

    await write(writer, {
      type: "StartupMessage",
      opts: {
        user: pg.user,
        database: pg.database,
      },
    });

    // https://github.com/yskszk63/pgpd/actions/runs/20895745907/job/60034003998?pr=23#step:4:213
    const r = await read(reader);
    if (
      r.type === "ErrorResponse" &&
      r.fields.some(([k, v]) => k === "C" && v === "57P03")
    ) {
      continue retry;
    }
    assertEquals(r, { type: "AuthenticationCleartextPassword" });

    await write(writer, {
      type: "PasswordMessage",
      password: pg.password,
    });

    assertEquals(await read(reader), { type: "AuthenticationOk" });

    loop:
    while (true) {
      const msg = await read(reader);
      switch (msg.type) {
        case "ReadyForQuery":
          break loop;
        case "ParameterStatus":
          continue;
        case "BackendKeyData":
          continue;
        default:
          throw new Error(`${msg.type}`);
      }
    }

    await write(writer, {
      type: "Parse",
      text: "SELECT $1::text",
    });
    await write(writer, {
      type: "Describe",
      describeType: "S",
    });
    await write(writer, {
      type: "Sync",
    });

    loop:
    while (true) {
      const msg = await read(reader);
      switch (msg.type) {
        case "ReadyForQuery":
          break loop;
        case "ParseComplete":
          assertEquals(msg, {
            type: "ParseComplete",
          });
          continue;
        case "ParameterDescription":
          assertEquals(msg, {
            type: "ParameterDescription",
            types: [25],
          });
          continue;
        case "RowDescription":
          assertEquals(msg, {
            type: "RowDescription",
            fields: [
              {
                name: "text",
                tableoid: 0,
                columnoid: 0,
                oid: 25,
                len: -1,
                mod: -1,
                format: "text",
              },
            ],
          });
          continue;
        default:
          throw new Error(`${msg.type}`);
      }
    }

    await write(writer, {
      type: "Terminate",
    });

    return; // DONE
  }
});
