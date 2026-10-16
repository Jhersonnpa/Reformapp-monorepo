import { createApp } from "../src/app";
import { MemoryStore } from "../src/db/store";
import { __resetRateLimit } from "../src/middleware/rateLimit";

process.env.JWT_SECRET = "test-secret-min-32-chars-0123456789abcdef";
process.env.PUSH_ENABLED = "0";

const requestBody = {
  category: "PLUMBING",
  description: "Se ha roto una tubería del baño y pierde agua.",
  province: "Madrid",
  locality: "Madrid",
  address: "Calle Mayor 1",
  availability: "Tardes entre semana",
};

function req(path: string, init?: RequestInit): Request {
  return new Request(`http://test${path}`, init);
}

async function clientHeaders(app: ReturnType<typeof createApp>): Promise<Record<string, string>> {
  await app.request(req("/auth/signUp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "chat-client@example.com",
      password: "Aa1!aaaa",
      username: "chat_client",
      firstName: "Ana",
      lastName: "García",
      phone: "+34600111222",
      province: "Madrid",
      locality: "Madrid",
      address: "Calle Mayor 1",
    }),
  }));
  const signIn = await app.request(req("/auth/signIn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "chat-client@example.com", password: "Aa1!aaaa" }),
  }));
  const tokens = (await signIn.json()) as { accessToken: string };
  return { "Content-Type": "application/json", Authorization: `Bearer ${tokens.accessToken}` };
}

async function techHeaders(
  app: ReturnType<typeof createApp>,
  store: MemoryStore,
  email: string,
): Promise<Record<string, string>> {
  const { hashPassword } = await import("../src/lib/password");
  await store.createUser({
    email,
    username: email.split("@")[0] ?? email,
    passwordHash: await hashPassword("Aa1!aaaa"),
    firstName: "Técnico",
    lastName: "Pruebas",
    phone: "+34600999888",
    province: "Madrid",
    locality: "Madrid",
    address: "Calle Taller 1",
    role: "TECH",
  });
  const signIn = await app.request(req("/auth/signIn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Aa1!aaaa" }),
  }));
  const tokens = (await signIn.json()) as { accessToken: string };
  return { "Content-Type": "application/json", Authorization: `Bearer ${tokens.accessToken}` };
}

async function setupAccepted(app: ReturnType<typeof createApp>, store: MemoryStore) {
  const client = await clientHeaders(app);
  const tech = await techHeaders(app, store, "chat-tech@example.com");
  const techUser = await store.findUserByEmail("chat-tech@example.com");
  const created = await app.request(req("/requests", {
    method: "POST", headers: client, body: JSON.stringify(requestBody),
  }));
  const { request } = (await created.json()) as { request: { id: string } };
  await app.request(req(`/requests/${request.id}/apply`, { method: "POST", headers: tech }));
  await app.request(req(`/requests/${request.id}/choose`, {
    method: "POST",
    headers: client,
    body: JSON.stringify({ techId: techUser!.id }),
  }));
  return { client, tech, id: request.id };
}

describe("API chat", () => {
  test("las partes hablan; un tercero no ve nada", async () => {
    __resetRateLimit();
    const store = new MemoryStore();
    const app = createApp(store);
    const { client, tech, id } = await setupAccepted(app, store);
    const outsider = await techHeaders(app, store, "chat-out@example.com");

    // En OPEN no hay chat (409); aquí ya está ACCEPTED
    const sent = await app.request(req(`/requests/${id}/messages`, {
      method: "POST",
      headers: client,
      body: JSON.stringify({ body: "Hola, ¿cuándo puedes venir?" }),
    }));
    expect(sent.status).toBe(201);

    const reply = await app.request(req(`/requests/${id}/messages`, {
      method: "POST",
      headers: tech,
      body: JSON.stringify({ body: "Mañana por la mañana." }),
    }));
    expect(reply.status).toBe(201);

    // Vacío -> 400
    const empty = await app.request(req(`/requests/${id}/messages`, {
      method: "POST",
      headers: client,
      body: JSON.stringify({ body: "   " }),
    }));
    expect(empty.status).toBe(400);

    // Historial cronológico con marca mine
    const list = await app.request(req(`/requests/${id}/messages`, { headers: client }));
    expect(list.status).toBe(200);
    const listJson = (await list.json()) as {
      messages: Array<{ body: string; mine: boolean }>;
      hasMore: boolean;
    };
    expect(listJson.messages.map((m) => m.body)).toEqual([
      "Hola, ¿cuándo puedes venir?",
      "Mañana por la mañana.",
    ]);
    expect(listJson.messages[0]!.mine).toBe(true);
    expect(listJson.messages[1]!.mine).toBe(false);
    expect(listJson.hasMore).toBe(false);

    // Tercero: ni leer ni escribir
    expect((await app.request(req(`/requests/${id}/messages`, { headers: outsider }))).status).toBe(404);
    expect((await app.request(req(`/requests/${id}/messages`, {
      method: "POST",
      headers: outsider,
      body: JSON.stringify({ body: "Soy un intruso" }),
    }))).status).toBe(404);
  });

  test("en OPEN escribir da 409", async () => {
    __resetRateLimit();
    const store = new MemoryStore();
    const app = createApp(store);
    const client = await clientHeaders(app);
    const created = await app.request(req("/requests", {
      method: "POST", headers: client, body: JSON.stringify(requestBody),
    }));
    const { request } = (await created.json()) as { request: { id: string } };
    const res = await app.request(req(`/requests/${request.id}/messages`, {
      method: "POST",
      headers: client,
      body: JSON.stringify({ body: "Hola" }),
    }));
    expect(res.status).toBe(409);
  });
});
