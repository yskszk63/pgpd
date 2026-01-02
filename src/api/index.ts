export type Type = {
  oid: number;
  schema: string;
  name: string;
  sqlType: string;
};

export type DescribeResultParameter = {
  type: Type | Pick<Type, "oid">;
};

export type DescribeResultRow = {
  name: string;
  type: Type | Pick<Type, "oid">;
  format: "text" | "binary";
};

export type DescribeResult = {
  parameters: DescribeResultParameter[];
  rows?: DescribeResultRow[] | undefined;
};

export type Client = {
  describe: (text: string) => Promise<DescribeResult>;
  [Symbol.asyncDispose]: () => Promise<void>;
};

export type SslMode =
  | "disable"
  | "require"
  | "verify-ca"
  | "verify-full";

export type Opts = {
  host?: string | undefined;
  port?: number | undefined;
  sslmode?: SslMode | undefined;
  user?: string | undefined;
  password?: string | undefined;
  database?: string | undefined;
};

declare const stubopen: (opts?: Opts | string) => Promise<Client>;
export const open = stubopen;
