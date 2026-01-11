export type AuthenticationOk = {
  type: "AuthenticationOk";
};

export type AuthenticationKerberosV5 = {
  type: "AuthenticationKerberosV5";
};

export type AuthenticationCleartextPassword = {
  type: "AuthenticationCleartextPassword";
};

export type AuthenticationMD5Password = {
  type: "AuthenticationMD5Password";
  salt: Uint8Array;
};

export type AuthenticationGSS = {
  type: "AuthenticationGSS";
};

export type AuthenticationGSSContinue = {
  type: "AuthenticationGSSContinue";
  data: Uint8Array;
};

export type AuthenticationSSPI = {
  type: "AuthenticationSSPI";
};

export type AuthenticationSASL = {
  type: "AuthenticationSASL";
  mechanisms: string[];
};

export type AuthenticationSASLContinue = {
  type: "AuthenticationSASLContinue";
  data: Uint8Array;
};

export type AuthenticationSASLFinal = {
  type: "AuthenticationSASLFinal";
  data: Uint8Array;
};

export type BackendKeyData = {
  type: "BackendKeyData";
  pid: number;
  key: number;
};

export type Bind = {
  type: "Bind";
  // Not implemented
};

export type BindComplete = {
  type: "BindComplete";
};

export type CancelRequest = {
  type: "CancelRequest";
  // Not implemented
};

export type Close = {
  type: "Close";
  // Not implemented
};

export type CloseComplete = {
  type: "CloseComplete";
};

export type CommandComplete = {
  type: "CommandComplete";
  tag: string;
};

export type CopyData = {
  type: "CopyData";
  data: Uint8Array;
};

export type CopyDone = {
  type: "CopyDone";
};

export type CopyFail = {
  type: "CopyFail";
  // Not implemented
};

export type CopyInResponse = {
  type: "CopyInResponse";
  format: "text" | "binary";
  columns: ("text" | "binary")[];
};

export type CopyOutResponse = {
  type: "CopyOutResponse";
  format: "text" | "binary";
  columns: ("text" | "binary")[];
};

export type CopyBothResponse = {
  type: "CopyBothResponse";
  format: "text" | "binary";
  columns: ("text" | "binary")[];
};

export type DataRow = {
  type: "DataRow";
  values: (Uint8Array | null)[];
};

export type Describe = {
  type: "Describe";

  describeType: "S" | "P";
  name?: string | undefined;
};

export type EmptyQueryResponse = {
  type: "EmptyQueryResponse";
};

export type ErrorResponse = {
  type: "ErrorResponse";
  fields: [string, string][];
};

export type Execute = {
  type: "Execute";
  // Not implemented
};

export type Flush = {
  type: "Flush";
  // Not implemented
};

export type FunctionCall = {
  type: "FunctionCall";
  // Not implemented
};

export type FunctionCallResponse = {
  type: "FunctionCallResponse";
  data: Uint8Array | null;
};

export type GSSENCRequest = {
  type: "GSSENCRequest";
  // Not implemented
};

export type GSSResponse = {
  type: "GSSResponse";
  // Not implemented
};

export type NegotiateProtocolVersion = {
  type: "NegotiateProtocolVersion";
  version: number;
  opts: string[];
};

export type NoData = {
  type: "NoData";
};

export type NoticeResponse = {
  type: "NoticeResponse";
  fields: [string, string][];
};

export type NotificationResponse = {
  type: "NotificationResponse";
  pid: number;
  channel: string;
  payload: string;
};

export type ParameterDescription = {
  type: "ParameterDescription";
  types: number[];
};

export type ParameterStatus = {
  type: "ParameterStatus";
  name: string;
  value: string;
};

export type Parse = {
  type: "Parse";
  name?: string | undefined;
  text: string;
  types?: number[] | undefined;
};

export type ParseComplete = {
  type: "ParseComplete";
};

export type PasswordMessage = {
  type: "PasswordMessage";
  password: string;
};

export type PortalSuspended = {
  type: "PortalSuspended";
};

export type Query = {
  type: "Query";
  text: string;
};

export type ReadyForQuery = {
  type: "ReadyForQuery";
  status: "I" | "T" | "E";
};

export type RowDescription = {
  type: "RowDescription";
  fields: {
    name: string;
    tableoid: number;
    columnoid: number;
    oid: number;
    len: number;
    mod: number;
    format: "text" | "binary";
  }[];
};

export type SASLInitialResponse = {
  type: "SASLInitialResponse";
  mechanism: string;
  data?: Uint8Array | undefined;
};

export type SASLResponse = {
  type: "SASLResponse";
  data: Uint8Array;
};

export type SSLRequest = {
  type: "SSLRequest";
};

export type StartupMessage = {
  type: "StartupMessage";
  opts: Record<string, string>;
};

export type Sync = {
  type: "Sync";
};

export type Terminate = {
  type: "Terminate";
};

export type BackendMessage =
  | AuthenticationOk
  | AuthenticationKerberosV5
  | AuthenticationCleartextPassword
  | AuthenticationMD5Password
  | AuthenticationGSS
  | AuthenticationGSSContinue
  | AuthenticationSSPI
  | AuthenticationSASL
  | AuthenticationSASLContinue
  | AuthenticationSASLFinal
  | BackendKeyData
  | BindComplete
  | CloseComplete
  | CommandComplete
  | CopyData
  | CopyDone
  | CopyInResponse
  | CopyOutResponse
  | CopyBothResponse
  | DataRow
  | EmptyQueryResponse
  | ErrorResponse
  | FunctionCallResponse
  | NegotiateProtocolVersion
  | NoData
  | NoticeResponse
  | NotificationResponse
  | ParameterDescription
  | ParameterStatus
  | ParseComplete
  | PortalSuspended
  | ReadyForQuery
  | RowDescription;

export type FrontendMessage =
  | Bind
  | CancelRequest
  | Close
  | CopyData
  | CopyDone
  | CopyFail
  | Describe
  | Execute
  | Flush
  | FunctionCall
  | GSSENCRequest
  | GSSResponse
  | Parse
  | PasswordMessage
  | Query
  | SASLInitialResponse
  | SASLResponse
  | SSLRequest
  | StartupMessage
  | Sync
  | Terminate;
