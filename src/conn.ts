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

type Names = keyof typeof proto.serialize;
type SerializeOpts<K extends Names> = {
  [P in Names]: Parameters<(typeof proto.serialize)[P]>;
}[K];
export type Connection = {
  readUntilReady: () => AsyncIterable<
    Exclude<BackendMessage, { name: "readyForQuery" } | { name: "error" }>
  >;
  write: <
    K extends Names,
    P extends SerializeOpts<K>,
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
  let broken: boolean = false;
  const throwIfBroken = () => {
    if (broken) {
      throw new Error("Broken");
    }
  };

  return {
    readUntilReady: async function* () {
      throwIfBroken();

      let err: unknown;
      loop:
      while (state !== "READY") {
        const { done, value } = await reader.read();
        throwIfBroken();
        if (done) {
          throw new Error();
        }

        const name = value.name;
        switch (name) {
          case "readyForQuery":
            switch (state) {
              case "WAIT_READY":
                break;
              default:
                throw new Error(`Unexpected state: ${state} ${name}`);
            }
            state = "READY";
            break loop;

          case "error":
            switch (state) {
              case "WAIT_READY":
              case "BUSY":
                break;
              default:
                throw new Error(`Unexpected state: ${state} ${name}`, {
                  cause: value,
                });
            }
            state = "WAIT_READY";
            err = value;
            break loop;

          case "parseComplete":
          case "bindComplete":
          case "closeComplete":
          case "noData":
          case "portalSuspended":
          case "replicationStart":
          case "emptyQuery":
          case "copyDone":
          case "copyData":
          case "rowDescription":
          case "parameterDescription":
          case "parameterStatus":
          case "backendKeyData":
          case "notification":
          case "commandComplete":
          case "dataRow":
          case "copyInResponse":
          case "copyOutResponse":
          case "authenticationOk":
          case "authenticationMD5Password":
          case "authenticationCleartextPassword":
          case "authenticationSASL":
          case "authenticationSASLContinue":
          case "authenticationSASLFinal":
          case "notice":
            yield value;
            break;

          default:
            throw new Error(`Unreachable ${name satisfies never}`);
        }
      }

      if (typeof err !== "undefined") {
        if (err instanceof proto.DatabaseError) {
          switch (err.severity) {
            case "FATAL":
            case "PANIC":
              broken = true;
              throw err;
            default:
              break;
          }
        } else {
          broken = true;
          throw err;
        }

        // Recovery
        let value: BackendMessage;
        do {
          const r = await reader.read();
          if (r.done) {
            throw new Error("DONE");
          }
          value = r.value;
        } while (value.name !== "readyForQuery");
        state = "READY";
        throw err;
      }
    },

    write: async (name, ...opts) => {
      throwIfBroken();

      // @ts-ignore: supress `A spread argument must either have a tuple type or be passed to a rest parameter.`
      const buf = proto.serialize[name](...opts);

      switch (name) {
        case "startup":
          switch (state) {
            case "READY":
              break;
            default:
              throw new Error(`Unexpected state: ${state} ${name}`);
          }
          state = "WAIT_READY";
          break;

        // SIMPLE QUERY
        case "query":
        case "copyData":
        case "copyDone":
        case "copyFail":
          switch (state) {
            case "READY":
              break;
            default:
              throw new Error(`Unexpected state: ${state} ${name}`);
          }
          state = "WAIT_READY";
          break;

        // EXTENDED QUERY
        case "parse":
        case "describe":
        case "bind":
        case "execute":
          switch (state) {
            case "BUSY":
            case "READY":
              break;
            default:
              throw new Error(`Unexpected state: ${state} ${name}`);
          }
          state = "BUSY";
          break;

        case "sync":
          switch (state) {
            case "READY":
            case "BUSY":
              break;
            default:
              throw new Error(`Unexpected state: ${state} ${name}`);
          }
          state = "WAIT_READY";
          break;

        case "end":
        case "password":
        case "close":
        case "flush":
        case "cancel":
        case "requestSsl":
        case "sendSCRAMClientFinalMessage":
        case "sendSASLInitialResponseMessage":
          break;

        default:
          throw new Error(`Unreachable ${name satisfies never}`);
      }

      if (!conn.write(buf)) {
        const { promise, resolve } = Promise.withResolvers<void>();
        conn.once("drain", resolve);
        await promise;
      }
    },
  };
}
