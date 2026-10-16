import { DrizzleStore } from "./drizzle-store.js";
import { MemoryStore, type Store } from "./store.js";

/**
 * Postgres (Neon) cuando hay DATABASE_URL; memoria en caso contrario
 * (tests, dev sin DB). La app usa la pooleada; migraciones/seed usan
 * DATABASE_URL_UNPOOLED (directa) con fallback a DATABASE_URL.
 */
export function createStore(): Store {
  const url = process.env["DATABASE_URL"];
  if (!url) return new MemoryStore();
  return new DrizzleStore(url);
}

/** Directa para migraciones/seed, con fallback a la pooleada. */
export function directUrl(): string {
  const url = process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"];
  if (!url) throw new Error("Falta DATABASE_URL (ver .env.example)");
  return url;
}
