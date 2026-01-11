import type { ErrorResponse } from "./msg.ts";

export class ErrorResponseError extends Error {
  declare readonly severity: string;
  declare readonly verbosity?:
    | "ERROR"
    | "FATAL"
    | "PANIC"
    | "WARNING"
    | "NOTICE"
    | "DEBUG"
    | "INFO"
    | "LOG"
    | undefined;
  declare readonly code?: string | undefined;
  declare readonly detail?: string | undefined;
  declare readonly hint?: string | undefined;
  declare readonly position?: string | undefined;
  declare readonly internalPosition?: string | undefined;
  declare readonly internalRoutine?: string | undefined;
  declare readonly where?: string | undefined;
  declare readonly schema?: string | undefined;
  declare readonly table?: string | undefined;
  declare readonly column?: string | undefined;
  declare readonly type?: string | undefined;
  declare readonly constraint?: string | undefined;
  declare readonly file?: string | undefined;
  declare readonly line?: string | undefined;
  declare readonly routine?: string | undefined;

  constructor(msg: ErrorResponse, options?: ErrorOptions) {
    const index = Object.fromEntries(msg.fields);
    super(index["M"], options);

    this.severity = index["S"] ?? "(unknown)";

    const verbosity = index["V"];
    switch (verbosity) {
      case "ERROR":
      case "FATAL":
      case "PANIC":
      case "WARNING":
      case "NOTICE":
      case "DEBUG":
      case "INFO":
      case "LOG":
        this.verbosity = verbosity;
        break;
    }

    if ("C" in index) {
      this.code = index["C"];
    }
    if ("D" in index) {
      this.detail = index["D"];
    }
    if ("H" in index) {
      this.hint = index["H"];
    }
    if ("P" in index) {
      this.position = index["P"];
    }
    if ("p" in index) {
      this.internalPosition = index["p"];
    }
    if ("q" in index) {
      this.internalRoutine = index["q"];
    }
    if ("W" in index) {
      this.where = index["W"];
    }
    if ("s" in index) {
      this.schema = index["s"];
    }
    if ("t" in index) {
      this.table = index["t"];
    }
    if ("c" in index) {
      this.column = index["c"];
    }
    if ("d" in index) {
      this.type = index["d"];
    }
    if ("n" in index) {
      this.constraint = index["n"];
    }
    if ("F" in index) {
      this.file = index["F"];
    }
    if ("L" in index) {
      this.line = index["L"];
    }
    if ("R" in index) {
      this.routine = index["R"];
    }
  }
}
