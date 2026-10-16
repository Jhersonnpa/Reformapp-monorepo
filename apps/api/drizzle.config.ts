import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // biome-ignore lint: env en config CLI
    url: process.env["DATABASE_URL"] ?? "",
  },
} satisfies Config;
