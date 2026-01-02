/**
 * Type meta data
 */
export type Type = {
  /** Type's oid */
  oid: number;
  /** schma name */
  schema: string;
  /** Type name (internal) */
  name: string;
  /** Type name */
  sqlType: string;
};

/**
 * Bind parameter meta data.
 */
export type DescribeResultParameter = {
  /**
   * Parameter type.
   */
  type: Type | Pick<Type, "oid">;
};

/**
 * Result row meta data.
 */
export type DescribeResultRow = {
  /** Column name. */
  name: string;
  /** Column type. */
  type: Type | Pick<Type, "oid">;
  /** Column format. */
  format: "text" | "binary";
};

/**
 * `describe()` result.
 */
export type DescribeResult = {
  /**
   * Bind parameters meta data.
   */
  parameters: DescribeResultParameter[];

  /**
   * Result columns meta data.
   *
   * If no result (INSERT, UPDATE, DELETE ...), this field is undefined.
   */
  rows?: DescribeResultRow[] | undefined;
};

/**
 * Describe client.
 */
export type Client = {
  /**
   * describe query.
   */
  describe: (text: string) => Promise<DescribeResult>;

  [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * - disable ... Disable SSL Connection
 * - require ... Enable SSL Connection. But not verify certificate.
 * - verify-ca ... Enable SSL Connection. But not verify host name.
 * - verify-full ... Enable SSL Connection.
 */
export type SslMode =
  | "disable"
  | "require"
  | "verify-ca"
  | "verify-full";

/**
 * Options for `open()`
 */
export type Opts = {
  /**
   * Target host (tcp).
   * Or startswith '/' is Unix Socket Domain.
   */
  host?: string | undefined;

  /**
   * Target port.
   */
  port?: number | undefined;

  /**
   * sslmode. See SslMode
   */
  sslmode?: SslMode | undefined;

  /**
   * Connecting user.
   */
  user?: string | undefined;

  /**
   * Password for Connecting user.
   */
  password?: string | undefined;

  /**
   * Target database.
   */
  database?: string | undefined;
};

declare const stubopen: (opts?: Opts | string) => Promise<Client>;
export const open = stubopen;
