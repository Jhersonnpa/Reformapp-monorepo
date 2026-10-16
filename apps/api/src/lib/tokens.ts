import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

function secret(): Uint8Array {
  const raw = process.env["JWT_SECRET"] ?? "dev-only-secret-cambia-esto-min-32-chars!!";
  return new TextEncoder().encode(raw);
}

export async function signAccessToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<{ userId: string; role: string }> {
  const { payload } = await jwtVerify(token, secret());
  const userId = payload.sub;
  if (!userId) throw new Error("Token sin sub");
  return { userId, role: String(payload["role"] ?? "CLIENT") };
}

export function newRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshExpiry(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}
