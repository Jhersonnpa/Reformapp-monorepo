import { Hono } from "hono";
import { pushTokenSchema } from "@reformapp/shared";
import type { Store } from "../db/store.js";
import { toPublicUser } from "./auth.js";

export function userRoutes(store: Store): Hono {
  const app = new Hono();

  app.get("/me", async (c) => {
    const userId = c.get("userId");
    const user = await store.findUserById(userId);
    if (!user) return c.json({ message: "Usuario no encontrado" }, 404);
    return c.json({ user: toPublicUser(user) }, 200);
  });

  // Media del técnico (0/0 si aún no tiene). Cualquier rol autenticado.
  app.get("/me/rating-stats", async (c) => {
    const userId = c.get("userId");
    const stats = await store.getTechRatingStats(userId);
    return c.json({ stats: { avg: Math.round(stats.avg * 10) / 10, count: stats.count } }, 200);
  });

  // Token push Expo (uno por usuario; se sobrescribe al reinstalar).
  app.post("/me/push-token", async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req.json().catch(() => null);
    const parsed = pushTokenSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ message: "Token no válido", errors: parsed.error.flatten().fieldErrors }, 400);
    }
    await store.setPushToken(userId, parsed.data.token);
    return c.json({ ok: true }, 200);
  });

  app.delete("/me/push-token", async (c) => {
    const userId = c.get("userId") as string;
    await store.deletePushToken(userId);
    return c.json({ ok: true }, 200);
  });

  return app;
}
