import type {
  AuthTokens,
  SignInInput,
  SignUpInput,
  User,
} from "@reformapp/shared";
import api from "./api";

/** Mensaje de servidor si lo hay, si no el fallback genérico (nunca crudo). */
export function serverMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const data = (error as { response?: { data?: { message?: unknown } } })
      .response?.data;
    if (typeof data?.message === "string" && data.message) return data.message;
  }
  return fallback;
}

export async function signIn(input: SignInInput): Promise<AuthTokens> {
  const res = await api.post<AuthTokens>("/auth/signIn", input);
  return res.data;
}

/** El servidor fuerza CLIENT aunque el body traiga role: no se envía. */
export async function signUp(
  input: SignUpInput,
): Promise<{ user: User }> {
  const res = await api.post<{ user: User }>("/auth/signUp", input);
  return res.data;
}

export async function getMe(): Promise<{ user: User }> {
  const res = await api.get<{ user: User }>("/users/me");
  return res.data;
}

export async function logoutRemote(refreshToken: string | null): Promise<void> {
  if (!refreshToken) return;
  await api.post("/auth/logout", { refreshToken });
}
