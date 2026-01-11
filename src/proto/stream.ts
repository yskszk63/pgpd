import type { BackendMessage } from "./msg.ts";
import { deserialize } from "./de.ts";

export class DeserializeStream
  extends TransformStream<Uint8Array, BackendMessage> {
  constructor() {
    let buf: Uint8Array[] = [];
    super({
      transform: (chunk, ctrl) => {
        const [msgs, rest] = deserialize([...buf, chunk]);
        for (const msg of msgs) {
          ctrl.enqueue(msg);
        }
        buf = rest;
      },
    });
  }
}
