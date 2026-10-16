/** Limpieza puntual del e2e de portadas. No commitear. */
import "../env.js";
import { directUrl } from "./provider.js";

const postgres = (await import("postgres")).default;
const sql = postgres(directUrl(), { max: 1 });
const users = await sql`DELETE FROM users WHERE email LIKE 'cover.%@reformapp.dev' RETURNING email`;
// eslint-disable-next-line no-console
console.log(`Borrados: ${users.length}`);
await sql.end();
