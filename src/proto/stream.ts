import type { BackendMessage, FrontendMessage } from "./msg.ts";
import { serialize } from "./ser.ts";
import { deserialize } from "./de.ts";

export class SerializeStream
  extends TransformStream<FrontendMessage, Uint8Array> {
  constructor() {
    super({
      transform: (chunk, ctrl) => {
        ctrl.enqueue(serialize(chunk));
      },
    });
  }
}

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
