# pgpd — PostgreSQL Protocol Describe

`pgpd` (**P**ostgreSQL **P**rotocol **D**escribe) is a CLI and API tool that talks directly to the PostgreSQL **Wire Protocol** and retrieves **SQL metadata** using the `Parse` / `Describe` flow.

It is designed for cases where you want to understand or reuse the PostgreSQL protocol itself, without relying on high-level APIs such as JDBC or libpq.

---

## Motivation

PostgreSQL provides tools such as `EXPLAIN` and `information_schema`, but they are not always suitable when you want to:

* Inspect SQL structure **without executing it**
* Safely analyze queries using the Prepare / Extended Query model
* Implement or validate PostgreSQL client or protocol implementations
* Build IDEs, LSPs, static analyzers, or SQL checkers

`pgpd` exists to fill this gap: a **small, honest implementation** that only does what is necessary — `Parse` and `Describe`.

---

## What pgpd does

* Talks directly to the PostgreSQL Wire Protocol
* Executes a minimal subset of the Extended Query Flow:

  * `Parse`
  * `Describe` (Statement)
* Collects and returns:

  * `ParameterDescription`
  * `RowDescription`

> **No execution is performed** (`Bind` / `Execute` are intentionally omitted)

---

## Features

* ✅ Retrieve SQL metadata **without executing queries**
* ✅ Resolve parameter types (`$1`, `$2`, ...)
* ✅ Retrieve result column OIDs, type names, and metadata
* ✅ Proper protocol recovery using `Sync` on errors
* ✅ PostgreSQL v14+ support (including SCRAM-SHA-256)

---

## Non-Goals

* ❌ Query execution
* ❌ Query planning or optimization (`EXPLAIN` replacement)
* ❌ libpq-compatible API

---

## Architecture

```text
Client
  │
  │  StartupMessage
  ▼
PostgreSQL
  │
  │  Authentication
  ▼
ReadyForQuery
  │
  │  Parse
  │  Describe (Statement)
  ▼
ParameterDescription
RowDescription
  │
  │  Sync
  ▼
ReadyForQuery
```

`pgpd` implements **only this minimal sequence**.

---

## CLI Usage

```bash
export DATABASE_URL='postgres://postgres:password@localhost:5432/postgres?sslmode=disable'
SQL='SELECT t.oid, n.nspname, t.typname, format_type(t.oid, NULL) AS sql_type FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.oid = $1 ORDER BY t.oid'
echo $SQL | deno run --allow-env --allow-net ./cli.ts | jq
```


### Example Output

```json
{
  "parameters": [
    {
      "type": {
        "oid": 26,
        "schema": "pg_catalog",
        "name": "oid",
        "sqlType": "oid"
      }
    }
  ],
  "rows": [
    {
      "name": "oid",
      "type": {
        "oid": 26,
        "schema": "pg_catalog",
        "name": "oid",
        "sqlType": "oid"
      },
      "format": "text"
    },
    {
      "name": "nspname",
      "type": {
        "oid": 19,
        "schema": "pg_catalog",
        "name": "name",
        "sqlType": "name"
      },
      "format": "text"
    },
    {
      "name": "typname",
      "type": {
        "oid": 19,
        "schema": "pg_catalog",
        "name": "name",
        "sqlType": "name"
      },
      "format": "text"
    },
    {
      "name": "sql_type",
      "type": {
        "oid": 25,
        "schema": "pg_catalog",
        "name": "text",
        "sqlType": "text"
      },
      "format": "text"
    }
  ]
}
```

---

## API Usage

```ts
import { open } from "TODO/mod.ts";

await using client = await open({
  host: "localhost",
  port: 5432,
  sslmode: "disable",
  user: "user",
  password: "password",
  database: "postgres",
});
const result = await client.describe("SELECT 1");
```

---

## Returned Metadata

### Parameters

* Type OID
* Type name
* Format code

### Columns

* Column name
* Type OID
* Type name
* Format code

---

## Supported Authentication

* `trust`
* `password`
* `md5`
* `SCRAM-SHA-256`

---

## Use Cases

* Code Generator
* SQL linters and validators
* IDE / LSP integration
* ORM preflight type resolution
* Learning PostgreSQL client implementations
* Protocol testing and validation

---

## Why not EXPLAIN?

|                       | EXPLAIN | pgpd |
| --------------------- | ------- | ---- |
| No execution required | ❌       | ✅    |
| Type resolution       | △       | ✅    |
| No side effects       | △       | ✅    |
| Protocol-level access | ❌       | ✅    |

---

## Runtime Compatibility / Shim Requirements

This project may use newer JavaScript features that are only available in recent Node.js releases. If you run `pgpd` on older Node.js versions, you might need to install shims / polyfills.

### Base64 / ArrayBuffer methods

Node.js 25 and newer include built-in `Uint8Array.prototype.toBase64` / `Uint8Array.fromBase64` and related base64/hex conversion utilities.  
On **Node.js < 25**, these methods may not exist — in such cases install and load a shim like `es-arraybuffer-base64`:

```bash
npm install es-arraybuffer-base64
```

```js
require("es-arraybuffer-base64/auto");
```

This ensures `Uint8Array.prototype.toBase64`, `.fromBase64`, etc., are defined in older environments.

### Disposable / Explicit Resource Management APIs

The `DisposableStack`, `AsyncDisposableStack`, and the `Symbol.dispose` / `Symbol.asyncDispose` protocols are part of the Explicit Resource Management proposal.  
Not all Node.js releases include these built-ins yet. On **Node.js < 24**, use a shim / polyfill such as `disposablestack`:

```bash
npm install disposablestack
```

```js
require("disposablestack/auto");
```

If you are using a recent Node.js version, no additional shims are required.

---

## Status

* 🚧 Active development
* APIs and output formats may change

---

## License

MIT

---

## Name

**pgpd** = PostgreSQL Protocol Describe

> Just the right tool for `Parse` / `Describe` — nothing more, nothing less.
