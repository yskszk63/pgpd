import type { BackendMessage, RowDescription } from "./msg.ts";

class Reader {
  #buf: Uint8Array;
  #view: DataView;
  #pos: number;
  readonly len: number;

  constructor(buf: Uint8Array) {
    this.#buf = buf;
    this.#view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    this.#pos = 5;
    this.len = this.#view.getUint32(1, false) + 1;
  }

  #checkSufficient(n: number): void {
    const remaining = this.len - this.#pos;
    if (remaining < n) {
      throw new Error(`Lack of space (${remaining} < ${n})`);
    }
  }

  tag(): string {
    return String.fromCharCode(this.#view.getUint8(0));
  }

  int32(): number {
    this.#checkSufficient(4);

    const p = this.#pos;
    this.#pos += 4;
    return this.#view.getInt32(p, false);
  }

  int16(): number {
    this.#checkSufficient(2);

    const p = this.#pos;
    this.#pos += 2;
    return this.#view.getInt16(p, false);
  }

  int8(): number {
    this.#checkSufficient(1);

    const p = this.#pos;
    this.#pos += 1;
    return this.#view.getInt8(p);
  }

  bytes(n?: number): Uint8Array {
    if (typeof n !== "undefined") {
      this.#checkSufficient(n);
    }

    const len = n ?? this.#view.byteLength - this.#pos;
    const p = this.#pos;
    this.#pos += len;
    return this.#buf.slice(p, p + len);
  }

  str(): string {
    const t = this.#buf.indexOf(0, this.#pos);
    if (t < 0) {
      throw new Error("No NUL found.");
    }
    this.#checkSufficient(t - this.#pos);
    const p = this.#pos;
    this.#pos = t + 1;
    return new TextDecoder().decode(this.#buf.subarray(p, t));
  }

  throwHasRemaining(): void {
    if (this.#pos !== this.len) {
      throw new Error(`${this.#pos} != ${this.len}`);
    }
  }
}

function deserializeR(r: Reader): BackendMessage {
  const k = r.int32();
  switch (k) {
    case 0:
      return { type: "AuthenticationOk" };
    case 2:
      return { type: "AuthenticationKerberosV5" };
    case 3:
      return { type: "AuthenticationCleartextPassword" };
    case 5: {
      const salt = r.bytes(4);
      return { type: "AuthenticationMD5Password", salt };
    }
    case 7:
      return { type: "AuthenticationGSS" };
    case 8: {
      const data = r.bytes();
      return { type: "AuthenticationGSSContinue", data };
    }
    case 9:
      return { type: "AuthenticationSSPI" };
    case 10: {
      const mechanisms: string[] = [];
      let m: string;
      while ((m = r.str()) !== "") {
        mechanisms.push(m);
      }
      return { type: "AuthenticationSASL", mechanisms };
    }
    case 11: {
      const data = r.bytes();
      return { type: "AuthenticationSASLContinue", data };
    }
    case 12: {
      const data = r.bytes();
      return { type: "AuthenticationSASLFinal", data };
    }
    default:
      throw new Error(`Unknown: ${k}`);
  }
}

function deserializeK(r: Reader): BackendMessage {
  const pid = r.int32();
  const key = r.int32();
  return {
    type: "BackendKeyData",
    pid,
    key,
  };
}

function deserialize2(_r: Reader): BackendMessage {
  return {
    type: "BindComplete",
  };
}

function deserialize3(_r: Reader): BackendMessage {
  return {
    type: "CloseComplete",
  };
}

function deserializeC(r: Reader): BackendMessage {
  const tag = r.str();
  return {
    type: "CommandComplete",
    tag,
  };
}

function deserialized(r: Reader): BackendMessage {
  const data = r.bytes();
  return {
    type: "CopyData",
    data,
  };
}

function deserializec(_r: Reader): BackendMessage {
  return {
    type: "CopyDone",
  };
}

function deserializeG(r: Reader): BackendMessage {
  const format = r.int8();
  const n = r.int16();
  const columns: number[] = [];
  for (let i = 0; i < n; i++) {
    columns.push(r.int16());
  }

  return {
    type: "CopyInResponse",
    format: format === 0 ? "text" : "binary",
    columns: columns.map((c) => c === 0 ? "text" : "binary"),
  };
}

function deserializeH(r: Reader): BackendMessage {
  const format = r.int8();
  const n = r.int16();
  const columns: number[] = [];
  for (let i = 0; i < n; i++) {
    columns.push(r.int16());
  }

  return {
    type: "CopyOutResponse",
    format: format === 0 ? "text" : "binary",
    columns: columns.map((c) => c === 0 ? "text" : "binary"),
  };
}

function deserializeW(r: Reader): BackendMessage {
  const format = r.int8();
  const n = r.int16();
  const columns: number[] = [];
  for (let i = 0; i < n; i++) {
    columns.push(r.int16());
  }

  return {
    type: "CopyBothResponse",
    format: format === 0 ? "text" : "binary",
    columns: columns.map((c) => c === 0 ? "text" : "binary"),
  };
}

function deserializeD(r: Reader): BackendMessage {
  const n = r.int16();
  const values: (Uint8Array | null)[] = [];
  for (let i = 0; i < n; i++) {
    const n = r.int32();
    if (n === -1) {
      values.push(null);
      continue;
    }
    values.push(r.bytes(n));
  }

  return {
    type: "DataRow",
    values,
  };
}

function deserializeI(_r: Reader): BackendMessage {
  return {
    type: "EmptyQueryResponse",
  };
}

function deserializeE(r: Reader): BackendMessage {
  const fields: [string, string][] = [];
  while (true) {
    const tag = r.bytes(1);
    if (tag[0] === 0) {
      break;
    }

    const val = r.str();
    fields.push([new TextDecoder().decode(tag), val]);
  }

  return {
    type: "ErrorResponse",
    fields,
  };
}

function deserializeV(r: Reader): BackendMessage {
  const len = r.int32();
  const data = len === -1 ? null : r.bytes(len);
  return {
    type: "FunctionCallResponse",
    data,
  };
}

function deserializev(r: Reader): BackendMessage {
  const version = r.int32();
  const n = r.int32();
  const opts: string[] = [];
  for (let i = 0; i < n; i++) {
    opts.push(r.str());
  }

  return {
    type: "NegotiateProtocolVersion",
    version,
    opts,
  };
}

function deserializen(_r: Reader): BackendMessage {
  return {
    type: "NoData",
  };
}

function deserializeN(r: Reader): BackendMessage {
  const fields: [string, string][] = [];
  while (true) {
    const tag = r.bytes(1);
    if (tag[0] === 0) {
      break;
    }

    const val = r.str();
    fields.push([new TextDecoder().decode(tag), val]);
  }

  return {
    type: "NoticeResponse",
    fields,
  };
}

function deserializeA(r: Reader): BackendMessage {
  const pid = r.int32();
  const channel = r.str();
  const payload = r.str();

  return {
    type: "NotificationResponse",
    pid,
    channel,
    payload,
  };
}

function deserializet(r: Reader): BackendMessage {
  const n = r.int16();
  const types: number[] = [];
  for (let i = 0; i < n; i++) {
    types.push(r.int32());
  }

  return {
    type: "ParameterDescription",
    types,
  };
}

function deserializeS(r: Reader): BackendMessage {
  const name = r.str();
  const value = r.str();

  return {
    type: "ParameterStatus",
    name,
    value,
  };
}

function deserialize1(_r: Reader): BackendMessage {
  return {
    type: "ParseComplete",
  };
}

function deserializes(_r: Reader): BackendMessage {
  return {
    type: "PortalSuspended",
  };
}

function deserializeZ(r: Reader): BackendMessage {
  const [v] = r.bytes(1);
  const status = String.fromCodePoint(v);
  switch (status) {
    case "I":
    case "T":
    case "E":
      break;
    default:
      throw new Error(`Unknown ${status}`);
  }

  return {
    type: "ReadyForQuery",
    status,
  };
}

function deserializeT(r: Reader): BackendMessage {
  const n = r.int16();
  const fields: RowDescription["fields"] = [];

  for (let i = 0; i < n; i++) {
    fields.push({
      name: r.str(),
      tableoid: r.int32(),
      columnoid: r.int16(),
      oid: r.int32(),
      len: r.int16(),
      mod: r.int32(),
      format: r.int16() === 0 ? "text" : "binary",
    });
  }

  return {
    type: "RowDescription",
    fields,
  };
}

function deserializeMessage(r: Reader): BackendMessage {
  const tag = r.tag();
  switch (tag) {
    case "R":
      return deserializeR(r);

    case "K":
      return deserializeK(r);

    case "2":
      return deserialize2(r);

    case "3":
      return deserialize3(r);

    case "C":
      return deserializeC(r);

    case "d":
      return deserialized(r);

    case "c":
      return deserializec(r);

    case "G":
      return deserializeG(r);

    case "H":
      return deserializeH(r);

    case "W":
      return deserializeW(r);

    case "D":
      return deserializeD(r);

    case "I":
      return deserializeI(r);

    case "E":
      return deserializeE(r);

    case "V":
      return deserializeV(r);

    case "v":
      return deserializev(r);

    case "n":
      return deserializen(r);

    case "N":
      return deserializeN(r);

    case "A":
      return deserializeA(r);

    case "t":
      return deserializet(r);

    case "S":
      return deserializeS(r);

    case "1":
      return deserialize1(r);

    case "s":
      return deserializes(r);

    case "Z":
      return deserializeZ(r);

    case "T":
      return deserializeT(r);

    default:
      throw new Error(`Unknown ${tag}`);
  }
}

function concat(buf: Uint8Array[]): Uint8Array {
  if (buf.length === 0) {
    return new Uint8Array(0);
  }
  if (buf.length === 1) {
    return buf[0];
  }

  const result = new Uint8Array(buf.reduce((l, r) => l + r.byteLength, 0));
  let p = 0;
  for (const b of buf) {
    result.set(b, p);
    p += b.byteLength;
  }
  return result;
}

export function deserialize(
  buf: Uint8Array[],
): [BackendMessage[], Uint8Array[]] {
  let b = concat(buf);
  const result: BackendMessage[] = [];
  while (b.length >= 5) {
    const r = new Reader(b);
    if (b.length < r.len) {
      break;
    }
    b = b.subarray(r.len);
    result.push(deserializeMessage(r));
    r.throwHasRemaining();
  }

  if (b.byteLength === 0) {
    return [result, []];
  }
  return [result, [b]];
}
