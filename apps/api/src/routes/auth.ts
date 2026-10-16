import { Hono } from "hono";
import { signInSchema, signUpSchema } from "@reformapp/shared";
import type { Store } from "../db/store.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { hashRefreshToken, newRefreshToken, refreshExpiry, signAccessToken } from "../lib/tokens.js";

function toPublicUser(u: {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  province: string;
  locality: string;
  address: string;
  role: "CLIENT" | "TECH" | "ADMIN";
  avatar: string | null;
  createdAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    province: u.province,
    locality: u.locality,
    address: u.address,
    role: u.role,
    avatar: u.avatar,
    createdAt: u.createdAt.toISOString(),
  };
}

export function authRoutes(store: Store): Hono {
  const app = new Hono();

  app.post("/signUp", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = signUpSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ message: "Datos no válidos", errors: parsed.error.flatten().fieldErrors }, 400);
    }
    const data = parsed.data;
    try {
      const user = await store.createUser({
        email: data.email,
        username: data.username,
        passwordHash: await hashPassword(data.password),
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        province: data.province,
        locality: data.locality,
        address: data.address,
        // NUNCA del body: rol forzado server-side
        role: "CLIENT",
      });
      return c.json({ user: toPublicUser(user) }, 201);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "EMAIL_TAKEN" || err.code === "USERNAME_TAKEN") {
        return c.json({ message: "Email o usuario ya registrado" }, 409);
      }
      return c.json({ message: "Error interno" }, 500);
    }
  });

  app.post("/signIn", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = signInSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ message: "Email o contraseña no válidos" }, 400);
    }
    const user = await store.findUserByEmail(parsed.data.email);
    if (!user) return c.json({ message: "Email o contraseña incorrectos" }, 401);
    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) return c.json({ message: "Email o contraseña incorrectos" }, 401);

    const accessToken = await signAccessToken(user.id, user.role);
    const refreshToken = newRefreshToken();
    await store.createRefresh(user.id, hashRefreshToken(refreshToken), refreshExpiry());
    return c.json({ accessToken, refreshToken }, 201);
  });

  app.post("/refresh", async (c) => {
    const body = await c.req.json().catch(() => null);
    const token = typeof body?.refreshToken === "string" ? body.refreshToken : "";
    if (!token) return c.json({ message: "Falta refreshToken" }, 400);
    const row = await store.findRefreshByHash(hashRefreshToken(token));
    if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
      return c.json({ message: "Sesión caducada" }, 401);
    }
    const user = await store.findUserById(row.userId);
    if (!user) return c.json({ message: "Sesión caducada" }, 401);
    // Rotación: revoca el viejo y emite un par nuevo
    await store.revokeRefresh(row.tokenHash);
    const accessToken = await signAccessToken(user.id, user.role);
    const next = newRefreshToken();
    await store.createRefresh(user.id, hashRefreshToken(next), refreshExpiry());
    return c.json({ accessToken, refreshToken: next }, 200);
  });

  app.post("/logout", async (c) => {
    const body = await c.req.json().catch(() => null);
    const token = typeof body?.refreshToken === "string" ? body.refreshToken : "";
    if (token) await store.revokeRefresh(hashRefreshToken(token));
    return c.json({ message: "Sesión cerrada" }, 200);
  });

  return app;
}

export { toPublicUser };
