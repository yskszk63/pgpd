import * as process from "node:process";
import { text } from "node:stream/consumers";
import * as fs from "node:fs/promises";

import { open } from "./mod.ts";

async function main() {
  let [url, file] = process.argv.slice(2);

  if (
    typeof url === "undefined" &&
    typeof process.env["DATABASE_URL"] !== "undefined"
  ) {
    url = process.env["DATABASE_URL"];
  }

  let input;
  if (typeof file === "undefined" || file === "-") {
    input = await text(process.stdin);
  } else {
    input = await fs.readFile(file, { encoding: "utf8" });
  }

  await using client = await open(url);
  const result = await client.describe(input);
  console.log(JSON.stringify(result));
}

await main();
