/** Aplica drizzle/*.sql con postgres.js (sin docker, directo a Neon Free). */
import "../env.js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { directUrl } from "./provider.js";

async function main(): Promise<void> {
  const url = directUrl();
  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { max: 1 });
  const dir = join(process.cwd(), "drizzle");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const q = readFileSync(join(dir, f), "utf8");
    await sql.unsafe(q);
    // eslint-disable-next-line no-console
    console.log(`Aplicada ${f}`);
  }
  await sql.end();
}

void main();
