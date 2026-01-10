import * as tls from "node:tls";
import type * as stream from "node:stream";
import { Readable as NodeReadable } from "node:stream";

import type { CheckedOpts } from "./opts.ts";
import type { SslMode } from "./api.ts";
import type {
  BackendMessage,
  ErrorResponse,
  FrontendMessage,
} from "./proto/msg.ts";
import { serialize } from "./proto/ser.ts";
import { DeserializeStream } from "./proto/stream.ts";

async function wraptls(
  mode: Exclude<SslMode, "disable">,
  raw: stream.Duplex,
): Promise<stream.Duplex> {
  raw.write(serialize({ type: "SSLRequest" }));

  await new Promise<void>((resolve, reject) => {
    raw.once("data", (buf) => {
      if (buf[0] !== 0x53) {
        reject(new Error("Server REPLY: requestSsl != S"));
      }
      resolve();
    });
  });

  const opts: tls.ConnectionOptions = {
    socket: raw,
  };
  switch (mode) {
    case "require":
      opts.rejectUnauthorized = false;
      break;
    case "verify-ca":
      opts.checkServerIdentity = () => void 0;
      break;
    case "verify-full":
      break;
  }

  return tls.connect(opts);
}

export type Connection = {
  readUntilReady: () => AsyncIterable<
    Exclude<
      BackendMessage,
      { type: "ReadyForQuery" } | { type: "ErrorResponse" }
    >
  >;
  write: (msg: FrontendMessage) => Promise<void>;
};

export class FatalError extends Error {}

type State =
  | "READY"
  | "BUSY"
  | "WAIT_READY";

export async function connect(
  raw: stream.Duplex,
  opts: CheckedOpts,
): Promise<Connection> {
  const sslmode = opts.sslmode ?? "verify-full";
  const conn = sslmode !== "disable" ? await wraptls(sslmode, raw) : raw;
  const stream = (NodeReadable.toWeb(conn) as ReadableStream<Uint8Array>)
    .pipeThrough(new DeserializeStream());
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

      let err: ErrorResponse | undefined;
      loop:
      while (state !== "READY") {
        const { done, value } = await reader.read();
        throwIfBroken();
        if (done) {
          throw new Error();
        }

        const type = value.type;
        switch (type) {
          case "ReadyForQuery":
            switch (state) {
              case "WAIT_READY":
                break;
              default:
                throw new Error(`Unexpected state: ${state} ${name}`);
            }
            state = "READY";
            break loop;

          case "ErrorResponse":
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

          case "ParseComplete":
          case "BindComplete":
          case "CloseComplete":
          case "NoData":
          case "PortalSuspended":
          // case "replicationStart":
          case "EmptyQueryResponse":
          case "CopyDone":
          case "CopyData":
          case "RowDescription":
          case "ParameterDescription":
          case "ParameterStatus":
          case "BackendKeyData":
          case "NotificationResponse":
          case "CommandComplete":
          case "DataRow":
          case "CopyInResponse":
          case "CopyOutResponse":
          case "AuthenticationOk":
          case "AuthenticationMD5Password":
          case "AuthenticationCleartextPassword":
          case "AuthenticationSASL":
          case "AuthenticationSASLContinue":
          case "AuthenticationSASLFinal":
          case "NoticeResponse":
          case "AuthenticationKerberosV5":
          case "AuthenticationGSS":
          case "AuthenticationSSPI":
          case "AuthenticationGSSContinue":
          case "CopyBothResponse":
          case "FunctionCallResponse":
          case "NegotiateProtocolVersion":
            yield value;
            break;

          default:
            throw new Error(`Unreachable ${type satisfies never}`);
        }
      }

      if (typeof err !== "undefined") {
        switch (err.fields.find(([tag]) => tag === "S")?.[1]) {
          case "FATAL":
          case "PANIC":
            broken = true;
            throw new FatalError(err.fields.find(([tag]) => tag === "M")?.[1], {
              cause: err,
            });
          default:
            break;
        }

        // Recovery
        let value: BackendMessage;
        do {
          const r = await reader.read();
          if (r.done) {
            throw new Error("DONE");
          }
          value = r.value;
        } while (value.type !== "ReadyForQuery");
        state = "READY";
        throw err;
      }
    },

    write: async (msg) => {
      throwIfBroken();

      // @ts-ignore: supress `A spread argument must either have a tuple type or be passed to a rest parameter.`
      const buf = serialize(msg);

      const type = msg.type;
      switch (type) {
        case "StartupMessage":
          switch (state) {
            case "READY":
              break;
            default:
              throw new Error(`Unexpected state: ${state} ${name}`);
          }
          state = "WAIT_READY";
          break;

        // SIMPLE QUERY
        case "Query":
        case "CopyData":
        case "CopyDone":
        case "CopyFail":
          switch (state) {
            case "READY":
              break;
            default:
              throw new Error(`Unexpected state: ${state} ${name}`);
          }
          state = "WAIT_READY";
          break;

        // EXTENDED QUERY
        case "Parse":
        case "Describe":
        case "Bind":
        case "Execute":
          switch (state) {
            case "BUSY":
            case "READY":
              break;
            default:
              throw new Error(`Unexpected state: ${state} ${name}`);
          }
          state = "BUSY";
          break;

        case "Sync":
          switch (state) {
            case "READY":
            case "BUSY":
              break;
            default:
              throw new Error(`Unexpected state: ${state} ${name}`);
          }
          state = "WAIT_READY";
          break;

        case "Terminate":
        case "PasswordMessage":
        case "Close":
        case "Flush":
        case "CancelRequest":
        case "SSLRequest":
        case "SASLResponse":
        case "SASLInitialResponse":
        case "GSSResponse":
        case "GSSENCRequest":
        case "FunctionCall": // TODO
          break;

        default:
          throw new Error(`Unreachable ${type satisfies never}`);
      }

      if (!conn.write(buf)) {
        const { promise, resolve } = Promise.withResolvers<void>();
        conn.once("drain", resolve);
        await promise;
      }
    },
  };
}
