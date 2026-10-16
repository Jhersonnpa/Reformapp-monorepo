import type { Context, Next } from "hono";
import { verifyAccessToken } from "../lib/tokens.js";

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    userRole: string;
  }
}

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const header = c.req.header("Authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match?.[1]) return c.json({ message: "No autorizado" }, 401);
  try {
    const { userId, role } = await verifyAccessToken(match[1]);
    c.set("userId", userId);
    c.set("userRole", role);
    await next();
  } catch {
    return c.json({ message: "Sesión caducada" }, 401);
  }
}
