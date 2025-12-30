import * as tls from "node:tls";
import type * as stream from "node:stream";

import * as proto from "pg-protocol";

async function wraptls(raw: stream.Duplex): Promise<stream.Duplex> {
  raw.write(proto.serialize.requestSsl());
  await new Promise<void>((resolve, reject) => {
    raw.once("data", (buf) => {
      if (buf[0] !== 0x53) {
        reject(new Error("Server REPLY: requestSsl != S"));
      }
      resolve();
    });
  });

  return tls.connect({ socket: raw });
}

type BackendMessage = Parameters<Parameters<typeof proto.parse>[1]>[0];
class ProtoStream extends ReadableStream<BackendMessage> {
  constructor(conn: stream.Readable) {
    super({
      start: (controller) => {
        proto.parse(conn, (msg) => {
          controller.enqueue(msg);
        });
      },
    });
  }
}

export type Connection = {
  readUntilReady: () => AsyncIterable<
    Exclude<BackendMessage, { name: "readyForQuery" } | { name: "error" }>
  >;
  write: <
    K extends keyof typeof proto.serialize,
    // deno-lint-ignore no-explicit-any
    P extends any[] = Parameters<typeof proto.serialize[K]>,
  >(name: K, ...opts: P) => Promise<void>;
};

export type ConnectOpts = {
  tls?: boolean | undefined;
  user: string;
  password: string;
  database?: string | undefined;
};

type State =
  | "READY"
  | "BUSY"
  | "WAIT_READY";

export async function connect(
  raw: stream.Duplex,
  opts: ConnectOpts,
): Promise<Connection> {
  const conn = opts.tls === true ? await wraptls(raw) : raw;
  const stream = new ProtoStream(conn);
  const reader = stream.getReader();
  let state: State = "READY";

  return {
    readUntilReady: async function* () {
      let err: unknown;
      loop:
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          throw new Error();
        }

        switch (value.name) {
          case "readyForQuery":
            break loop;

          case "error":
            err = value;
            break;

          default:
            yield value;
            break;
        }
      }

      if (typeof err !== "undefined") {
        throw err;
      }
    },

    write: async (name, ...opts) => {
      // @ts-ignore: supress `A spread argument must either have a tuple type or be passed to a rest parameter.`
      const buf = proto.serialize[name](...opts);
      if (!conn.write(buf)) {
        const { promise, resolve } = Promise.withResolvers<void>();
        conn.once("drain", resolve);
        await promise;
      }
    },
  };
}
