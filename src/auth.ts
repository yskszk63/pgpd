import * as crypt from "node:crypto";
import { Buffer } from "node:buffer";

import {
  zAuthenticationMD5Password,
  zAuthenticationSASL,
  zAuthenticationSASLContinue,
  zAuthenticationSASLFinal,
} from "./types.ts";
import type { Connection } from "./conn.ts";
import type { CheckedOpts } from "./opts.ts";

type State = {
  // SCRAM-SHA-256
  nonce?: string | undefined;
  clientFirstBare?: string | undefined;
  serverSignature?: string | undefined;
};

async function pbkdf2(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const p = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey(
    "raw",
    p,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: {
          name: "SHA-256",
        },
      },
      key,
      256,
    ),
  );
}

async function hmac(
  key: Uint8Array<ArrayBuffer>,
  data: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)),
  );
}

async function hash(
  data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

function xor(
  b1: Uint8Array<ArrayBuffer>,
  b2: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  if (b1.length !== b2.length) {
    throw new Error(`${b1.length} != ${b2.length}`);
  }

  const r = new Uint8Array(b1.length);

  for (let i = 0; i < b1.length; i++) {
    r[i] = b1[i] ^ b2[i];
  }

  return r;
}

async function writePasswordMessageMd5(
  conn: Connection,
  salt: Buffer,
  opts: CheckedOpts,
): Promise<void> {
  if (typeof opts.password === "undefined") {
    throw new Error("password not specified");
  }

  const hasher = crypt.createHash("md5");
  hasher.update(opts.password).update(opts.user);
  const h1 = hasher.digest("hex");

  const hasher2 = crypt.createHash("md5");
  const h2 = hasher2.update(h1).update(salt).digest("hex");

  await conn.write("password", `md5${h2}`);
}

async function writePasswordPlain(
  conn: Connection,
  opts: CheckedOpts,
): Promise<void> {
  if (typeof opts.password === "undefined") {
    throw new Error("password not specified");
  }

  await conn.write("password", opts.password);
}

async function writeSendSASLInitialResponseMessageScramSha256(
  state: State,
  conn: Connection,
  opts: CheckedOpts,
): Promise<void> {
  if (typeof opts.password === "undefined") {
    throw new Error("password not specified");
  }

  // NOTE: Based on node-postgres
  // https://github.com/brianc/node-postgres/blob/ecff60dc8aa0bd1ad5ea8f4623af0756a86dc110/packages/pg/lib/crypto/sasl.js
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  const nonce = b.toBase64();
  const clientFirstBare = `n=${opts.user},r=${nonce}`;

  state.nonce = nonce;
  state.clientFirstBare = clientFirstBare;
  delete state.serverSignature;

  await conn.write(
    "sendSASLInitialResponseMessage",
    "SCRAM-SHA-256",
    `n,,${clientFirstBare}`,
  );
}

async function writeSendSCRAMClientFinalMessage(
  state: State,
  conn: Connection,
  opts: CheckedOpts,
  data: string,
): Promise<void> {
  if (typeof state.nonce === "undefined") {
    throw new Error("Invalid state");
  }

  if (typeof opts.password === "undefined") {
    throw new Error("password not specified");
  }

  const attrs = Object.fromEntries(
    data
      .split(",")
      .map((v) => {
        const s = v.indexOf("=");
        if (s < 0) {
          throw new Error();
        }
        return [v.slice(0, s), v.slice(s + 1)];
      }),
  );

  const nonce = attrs["r"];
  const salt = Buffer.from(attrs["s"], "base64");
  const iter = Number.parseInt(attrs["i"], 10);

  const salted = await pbkdf2(opts.password, salt, iter);
  const clientKey = await hmac(salted, "Client Key");
  const storedKey = await hash(clientKey);

  const clientFinalWithoutProof = `c=biws,r=${nonce}`;
  if (!nonce.startsWith(state.nonce)) {
    throw new Error("mismatch");
  }

  const authMessage =
    `${state.clientFirstBare},${data},${clientFinalWithoutProof}`;
  const clientSignature = await hmac(storedKey, authMessage);
  const clientProof = xor(clientKey, clientSignature);

  const serverKey = await hmac(salted, "Server Key");
  const serverSignature = await hmac(serverKey, authMessage);
  state.serverSignature = serverSignature.toBase64();

  await conn.write(
    "sendSCRAMClientFinalMessage",
    `${clientFinalWithoutProof},p=${clientProof.toBase64()}`,
  );
}

export async function handleAuthentication(
  conn: Connection,
  opts: CheckedOpts,
): Promise<void> {
  const state: State = {};

  for await (const msg of conn.readUntilReady()) {
    switch (msg.name) {
      case "authenticationOk":
        return;

      case "authenticationCleartextPassword": {
        await writePasswordPlain(conn, opts);
        break;
      }

      case "authenticationMD5Password": {
        const { salt } = zAuthenticationMD5Password.parse(msg);
        await writePasswordMessageMd5(conn, salt, opts);
        break;
      }

      case "authenticationSASL": {
        const { mechanisms } = zAuthenticationSASL.parse(msg);
        if (!mechanisms.includes("SCRAM-SHA-256")) {
          throw new Error(
            `Not implemented ${msg.name} ${mechanisms.join(" ")}`,
          );
        }
        await writeSendSASLInitialResponseMessageScramSha256(state, conn, opts);
        break;
      }

      case "authenticationSASLContinue": {
        const { data } = zAuthenticationSASLContinue.parse(msg);
        await writeSendSCRAMClientFinalMessage(state, conn, opts, data);
        break;
      }

      case "authenticationSASLFinal": {
        const { data } = zAuthenticationSASLFinal.parse(msg);
        if (data !== `v=${state.serverSignature}`) {
          throw new Error("SCRAM-SHA-256 verification failure");
        }
        delete state.nonce;
        delete state.clientFirstBare;
        delete state.serverSignature;
        break;
      }

      default:
        throw new Error(`Not implemented ${msg.name}`);
    }
  }
}
