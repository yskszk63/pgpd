import type { OpenOpts } from "./client.ts";

export function parse(text: string): OpenOpts {
  const url = new URL(text);
  if (url.protocol !== "postgres:") {
    throw new Error(`Invalid url: ${url.href}`);
  }

  let host: string;
  if (url.hostname !== "") {
    host = url.searchParams.get("host") ?? url.hostname;
  } else {
    const h = url.searchParams.get("host");
    if (h === null || !h.startsWith("/")) {
      throw new Error(`Invalid url: ${url.href}`);
    }
    host = h;
  }
  const database = url.pathname.slice(1) ?? void 0;

  let port: number | undefined;
  if (url.port != "") {
    port = Number.parseInt(url.port, 10);
    if (Number.isNaN(port)) {
      throw new Error(`Invalid url: ${url.href}`);
    }
  }

  const user = url.searchParams.get("user") ?? url.username;
  const password = url.searchParams.get("password") ?? url.password;

  let sslmode: OpenOpts["sslmode"];
  switch (url.searchParams.get("sslmode")) {
    case "disable":
      sslmode = "disable";
      break;

    case "require":
      sslmode = "require";
      break;

    case "verify-ca":
      sslmode = "verify-ca";
      break;

    case null:
      if (url.hostname === "") {
        sslmode = "disable";
        break;
      }
      sslmode = "verify-full";
      break;

    case "verify-full":
      sslmode = "verify-full";
      break;

    default:
      throw new Error(`Invalid url: ${url.href}`);
  }

  const result: OpenOpts = {
    host,
    port,
    user,
    password,
    database,
    sslmode,
  };

  return result;
}
