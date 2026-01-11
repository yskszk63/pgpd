import type * as m from "./msg.ts";

type Tag = null | "D" | "P" | "p" | "Q" | "S" | "X";

class Builder {
  #hastag: boolean;
  #buf: Uint8Array;
  #pos: number;

  constructor(tag: Tag, length?: number) {
    this.#buf = new Uint8Array(length ?? 8);
    if (!(this.#hastag = tag !== null)) {
      this.#pos = 4;
      return;
    }

    this.#pos = 5;
    this.#buf.set([tag.charCodeAt(0)]);
  }

  #grow(n: number): void {
    while (this.#buf.length - this.#pos < n) {
      const old = this.#buf;
      this.#buf = new Uint8Array(Math.max(old.length * 2, n));
      this.#buf.set(old);
    }
  }

  #put(b: ArrayLike<number>): void {
    this.#grow(b.length);
    this.#buf.set(b, this.#pos);
    this.#pos += b.length;
  }

  bytes(b: ArrayLike<number>): void {
    this.#put(b);
  }

  str(s: string): void {
    const encoder = new TextEncoder();
    while (s.length > 0) {
      const { read, written } = encoder.encodeInto(
        s,
        this.#buf.subarray(this.#pos),
      );
      this.#pos += written;
      s = s.substring(read);
      this.#grow(s.length);
    }
    this.#put([0]);
  }

  int16(v: number): void {
    this.#put([
      v >> 8 & 0xFF,
      v >> 0 & 0xFF,
    ]);
  }

  int32(v: number): void {
    this.#put([
      v >> 24 & 0xFF,
      v >> 16 & 0xFF,
      v >> 8 & 0xFF,
      v >> 0 & 0xFF,
    ]);
  }

  build(): Uint8Array {
    const len = this.#pos - (this.#hastag ? 1 : 0);
    this.#buf.set([
      len >> 24 & 0xFF,
      len >> 16 & 0xFF,
      len >> 8 & 0xFF,
      len >> 0 & 0xFF,
    ], this.#hastag ? 1 : 0);
    return new Uint8Array(this.#buf.buffer, 0, this.#pos);
  }
}

function serializeDescribe(msg: m.Describe): Uint8Array {
  const b = new Builder("D");
  b.bytes(
    msg.describeType === "S"
      ? [0x53] // S
      : [0x50], // P
  );
  b.str(msg.name ?? "");
  return b.build();
}

function serializeParse(msg: m.Parse): Uint8Array {
  const b = new Builder("P");
  b.str(msg.name ?? "");
  b.str(msg.text);
  b.int16(msg.types?.length ?? 0);
  for (const t of msg.types ?? []) {
    b.int32(t);
  }
  return b.build();
}

function serializePasswordMessage(msg: m.PasswordMessage): Uint8Array {
  const b = new Builder("p");
  b.str(msg.password);
  return b.build();
}

function serializeQuery(msg: m.Query): Uint8Array {
  const b = new Builder("Q");
  b.str(msg.text);
  return b.build();
}

function serializeSASLInitialResponse(msg: m.SASLInitialResponse): Uint8Array {
  const b = new Builder("p");
  b.str(msg.mechanism);
  if (typeof msg.data === "undefined") {
    b.int32(-1);
  } else {
    b.int32(msg.data.length);
    b.bytes(msg.data);
  }
  return b.build();
}

function serializeSASLResponse(msg: m.SASLResponse): Uint8Array {
  const b = new Builder("p");
  b.bytes(msg.data);
  return b.build();
}

function serializeSSLRequest(_msg: m.SSLRequest): Uint8Array {
  const b = new Builder(null);
  b.int32(80877103);
  return b.build();
}

function serializeStartupMessage(msg: m.StartupMessage): Uint8Array {
  const b = new Builder(null);
  b.int32(196608);
  for (const [key, val] of Object.entries(msg.opts)) {
    b.str(key);
    b.str(val);
  }
  b.bytes([0]);
  return b.build();
}

function serializeSync(_msg: m.Sync): Uint8Array {
  const b = new Builder("S");
  return b.build();
}

function serializeTerminate(_msg: m.Terminate): Uint8Array {
  const b = new Builder("X");
  return b.build();
}

type NotImplementedType =
  | "Bind"
  | "CancelRequest"
  | "Close"
  | "CopyData"
  | "CopyDone"
  | "CopyFail"
  | "Execute"
  | "Flush"
  | "FunctionCall"
  | "GSSENCRequest"
  | "GSSResponse";

export function serialize(
  msg: Exclude<m.FrontendMessage, { type: NotImplementedType }>,
): Uint8Array {
  switch (msg.type) {
    case "Describe":
      return serializeDescribe(msg);

    case "Parse":
      return serializeParse(msg);

    case "PasswordMessage":
      return serializePasswordMessage(msg);

    case "Query":
      return serializeQuery(msg);

    case "SASLInitialResponse":
      return serializeSASLInitialResponse(msg);

    case "SASLResponse":
      return serializeSASLResponse(msg);

    case "SSLRequest":
      return serializeSSLRequest(msg);

    case "StartupMessage":
      return serializeStartupMessage(msg);

    case "Sync":
      return serializeSync(msg);

    case "Terminate":
      return serializeTerminate(msg);
  }
}
