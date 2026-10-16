import { createApp } from "../src/app";
import { MemoryStore } from "../src/db/store";
import { __resetRateLimit } from "../src/middleware/rateLimit";

process.env.JWT_SECRET = "test-secret-min-32-chars-0123456789abcdef";

const signUpBody = {
  email: "cliente@example.com",
  password: "Aa1!aaaa",
  username: "cliente_1",
  firstName: "Ana",
  lastName: "García",
  phone: "+34600111222",
  province: "Madrid",
  locality: "Madrid",
  address: "Calle Mayor 1",
  role: "ADMIN", // debe ignorarse
};

function req(path: string, init?: RequestInit): Request {
  return new Request(`http://test${path}`, init);
}

describe("API auth", () => {
  test("GET /health -> 200 {ok:true}", async () => {
    const app = createApp(new MemoryStore());
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("sign-up fuerza CLIENT aunque body pida ADMIN + sign-in devuelve tokens", async () => {
    __resetRateLimit();
    const app = createApp(new MemoryStore());
    const signUp = await app.request(req("/auth/signUp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signUpBody),
    }));
    expect(signUp.status).toBe(201);
    const created = (await signUp.json()) as { user: { role: string } };
    expect(created.user.role).toBe("CLIENT");

    const signIn = await app.request(req("/auth/signIn", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client-Type": "mobile" },
      body: JSON.stringify({ email: signUpBody.email, password: signUpBody.password }),
    }));
    expect(signIn.status).toBe(201);
    const tokens = (await signIn.json()) as { accessToken: string; refreshToken: string };
    expect(typeof tokens.accessToken).toBe("string");
    expect(typeof tokens.refreshToken).toBe("string");

    const me = await app.request(req("/users/me", { headers: { Authorization: `Bearer ${tokens.accessToken}` } }));
    expect(me.status).toBe(200);
    const meJson = (await me.json()) as { user: { email: string; role: string } };
    expect(meJson.user.email).toBe("cliente@example.com");
    expect(meJson.user.role).toBe("CLIENT");
  });

  test("refresh rota (el viejo queda invalidado) y logout revoca", async () => {
    __resetRateLimit();
    const app = createApp(new MemoryStore());
    await app.request(req("/auth/signUp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...signUpBody, email: "otro@example.com", username: "otro_1" }),
    }));
    const signIn = await app.request(req("/auth/signIn", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Client-Type": "mobile" },
      body: JSON.stringify({ email: "otro@example.com", password: signUpBody.password }),
    }));
    const t1 = (await signIn.json()) as { refreshToken: string };

    const r1 = await app.request(req("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: t1.refreshToken }),
    }));
    expect(r1.status).toBe(200);
    const t2 = (await r1.json()) as { refreshToken: string };

    // Reusar el viejo debe fallar (rotación)
    const reuse = await app.request(req("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: t1.refreshToken }),
    }));
    expect(reuse.status).toBe(401);

    const logout = await app.request(req("/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: t2.refreshToken }),
    }));
    expect(logout.status).toBe(200);

    const afterLogout = await app.request(req("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: t2.refreshToken }),
    }));
    expect(afterLogout.status).toBe(401);
  });

  test("rate-limit 5/min en /auth/*", async () => {
    __resetRateLimit();
    const app = createApp(new MemoryStore());
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const res = await app.request(req("/auth/signIn", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "9.9.9.9" },
        body: JSON.stringify({ email: "x@y.com", password: "Aa1!aaaa" }),
      }));
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
