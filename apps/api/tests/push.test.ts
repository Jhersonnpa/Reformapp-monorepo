import { createApp } from "../src/app";
import { MemoryStore } from "../src/db/store";
import { __resetRateLimit } from "../src/middleware/rateLimit";

process.env.JWT_SECRET = "test-secret-min-32-chars-0123456789abcdef";
process.env.PUSH_ENABLED = "0";

function req(path: string, init?: RequestInit): Request {
  return new Request(`http://test${path}`, init);
}

const TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

async function authHeaders(app: ReturnType<typeof createApp>): Promise<Record<string, string>> {
  await app.request(req("/auth/signUp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "push@example.com",
      password: "Aa1!aaaa",
      username: "push_user",
      firstName: "Push",
      lastName: "Test",
      phone: "+34600111222",
      province: "Madrid",
      locality: "Madrid",
      address: "Calle 1",
    }),
  }));
  const signIn = await app.request(req("/auth/signIn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "push@example.com", password: "Aa1!aaaa" }),
  }));
  const tokens = (await signIn.json()) as { accessToken: string };
  return { "Content-Type": "application/json", Authorization: `Bearer ${tokens.accessToken}` };
}

describe("API push tokens", () => {
  test("token inválido -> 400; válido -> 200; borrar -> 200", async () => {
    __resetRateLimit();
    const store = new MemoryStore();
    const app = createApp(store);
    const headers = await authHeaders(app);

    const bad = await app.request(req("/users/me/push-token", {
      method: "POST",
      headers,
      body: JSON.stringify({ token: "no-es-un-token" }),
    }));
    expect(bad.status).toBe(400);

    const ok = await app.request(req("/users/me/push-token", {
      method: "POST",
      headers,
      body: JSON.stringify({ token: TOKEN }),
    }));
    expect(ok.status).toBe(200);

    const me = await store.findUserByEmail("push@example.com");
    expect(await store.getPushToken(me!.id)).toBe(TOKEN);

    const del = await app.request(req("/users/me/push-token", { method: "DELETE", headers }));
    expect(del.status).toBe(200);
    expect(await store.getPushToken(me!.id)).toBeNull();
  });

  test("sin token -> 401", async () => {
    __resetRateLimit();
    const app = createApp(new MemoryStore());
    const res = await app.request(req("/users/me/push-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: TOKEN }),
    }));
    expect(res.status).toBe(401);
  });
});
