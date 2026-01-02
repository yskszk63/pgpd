/**
 * `pgpd` (**P**ostgreSQL **P**rotocol **D**escribe) is a CLI and API tool that talks directly to the PostgreSQL *
 * *Wire Protocol** and retrieves **SQL metadata** using the `Parse` / `Describe` flow.
 *
 * @example
 * ```ts ignore
 * import { open } from "@pgpd/pgpd";
 *
 * await using client = await open();
 * const result = await client.describe("SELECT 1");
 * ```
 *
 * @module
 */

export { open } from "./src/client.ts";
export type {
  Client,
  DescribeResult,
  DescribeResultParameter,
  DescribeResultRow,
  Opts,
  Type,
} from "./src/api.ts";
