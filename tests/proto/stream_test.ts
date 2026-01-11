import { assertEquals } from "@std/assert";
import { DeserializeStream } from "~/proto/stream.ts";
import type { BackendMessage } from "~/proto/msg.ts";

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
