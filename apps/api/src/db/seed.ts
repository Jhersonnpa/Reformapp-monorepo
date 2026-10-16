/**
 * Seed demo (coste 0€: ejecuta contra Postgres Neon cuando DATABASE_URL existe).
 * Sin DATABASE_URL imprime las credenciales demo y el SQL necesario.
 */
import "../env.js";
import { hashPassword } from "../lib/password.js";

const DEMO = [
  {
    email: "client@reformapp.dev",
    username: "cliente_demo",
    password: "Client123!",
    firstName: "Ana",
    lastName: "García",
    phone: "+34600111222",
    province: "Madrid",
    locality: "Madrid",
    address: "Calle Mayor 1",
    role: "CLIENT" as const,
  },
  {
    email: "tech@reformapp.dev",
    username: "tecnico_demo",
    password: "Tech123!",
    firstName: "Bruno",
    lastName: "Técnico",
    phone: "+34600333444",
    province: "Madrid",
    locality: "Madrid",
    address: "Calle Taller 9",
    role: "TECH" as const,
  },
];

async function main(): Promise<void> {
  const pooled = process.env["DATABASE_URL"];
  const url = process.env["DATABASE_URL_UNPOOLED"] ?? pooled;
  if (!url) {
    // eslint-disable-next-line no-console
    console.log("Sin DATABASE_URL: aplica drizzle/0001_init.sql en Neon y define las cuentas:");
    for (const u of DEMO) {
      const hash = await hashPassword(u.password);
      // eslint-disable-next-line no-console
      console.log(`- ${u.email} / ${u.password} (role ${u.role}, hash ${hash.slice(0, 12)}…)`);
    }
    return;
  }
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;
  const { users } = await import("./schema.js");
  const sql = postgres(url);
  const db = drizzle(sql);
  for (const u of DEMO) {
    await db
      .insert(users)
      .values({
        email: u.email,
        username: u.username,
        passwordHash: await hashPassword(u.password),
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        province: u.province,
        locality: u.locality,
        address: u.address,
        role: u.role,
      })
      .onConflictDoNothing({ target: users.email });
  }
  // eslint-disable-next-line no-console
  console.log("Seed OK: client@reformapp.dev + tech@reformapp.dev");
  await sql.end();
}

void main();
