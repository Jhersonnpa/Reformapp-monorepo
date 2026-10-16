import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth.js";
import { requestRoutes } from "./routes/requests.js";
import { userRoutes } from "./routes/users.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import type { Store } from "./db/store.js";
import { MemoryStore } from "./db/store.js";

export function createApp(store: Store = new MemoryStore()): Hono {
  const app = new Hono();
  app.use("*", cors({ origin: "*", allowHeaders: ["Content-Type", "Authorization", "X-Client-Type"] }));

  app.get("/health", (c) => c.json({ ok: true }, 200));

  // Anti-brute-force estricto en credenciales; refresh/logout con límite amplio
  // para no romper la rotación 401->refresh->retry del cliente móvil.
  app.use("/auth/signIn", rateLimit(5));
  app.use("/auth/signUp", rateLimit(5));
  app.use("/auth/refresh", rateLimit(30));
  app.use("/auth/logout", rateLimit(30));
  app.route("/auth", authRoutes(store));

  app.use("/users/*", authMiddleware);
  app.route("/users", userRoutes(store));

  // Solicitudes: auth obligatoria; límites amplios (no son credenciales)
  // y por ruta+IP para no interferir con el resto.
  app.use("/requests", authMiddleware);
  app.use("/requests/*", authMiddleware);
  app.use("/requests", rateLimit(30));
  app.use("/requests/*", rateLimit(60));
  app.route("/requests", requestRoutes(store));

  app.notFound((c) => c.json({ message: "No encontrado" }, 404));
  return app;
}
