import { assertEquals } from "@std/assert";
import { DeserializeStream, SerializeStream } from "~/proto/stream.ts";
import type { BackendMessage, FrontendMessage } from "~/proto/msg.ts";

Deno.test("serialize", async () => {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  await ReadableStream
    .from<FrontendMessage>([
      {
        type: "StartupMessage",
        opts: {
          "U": "u",
          "V": "v",
        },
      },
      {
        type: "Sync",
      },
    ])
    .pipeThrough(new SerializeStream())
    .pipeTo(
      new WritableStream({
        write: (chunk) => {
          chunks.push(Uint8Array.from(chunk));
        },
      }),
    );

  const all = await new Blob(chunks).bytes();
  assertEquals(
    all,
    Uint8Array.of(
      // StartupMessage
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
      // Sync
      0x53, // S
      0x00,
      0x00,
      0x00,
      0x04,
    ),
  );
});

Deno.test("deserialize", async () => {
  const chunks: BackendMessage[] = [];
  await ReadableStream
    .from([
      Uint8Array.fromHex("5200000008" + "00000003"),
      Uint8Array.fromHex("5200000008" + "00000000"),
    ])
    .pipeThrough(new DeserializeStream())
    .pipeTo(
      new WritableStream({
        write: (chunk) => {
          chunks.push(chunk);
        },
      }),
    );

  assertEquals(chunks, [
    { type: "AuthenticationCleartextPassword" },
    { type: "AuthenticationOk" },
  ]);
});
