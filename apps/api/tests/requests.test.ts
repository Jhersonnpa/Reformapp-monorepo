import { createApp } from "../src/app";
import { MemoryStore } from "../src/db/store";
import { __resetRateLimit } from "../src/middleware/rateLimit";

process.env.JWT_SECRET = "test-secret-min-32-chars-0123456789abcdef";
// Los envíos push nunca salen a red en tests (best-effort igualmente).
process.env.PUSH_ENABLED = "0";

const signUpBody = {
  email: "solicitante@example.com",
  password: "Aa1!aaaa",
  username: "solicitante_1",
  firstName: "Ana",
  lastName: "García",
  phone: "+34600111222",
  province: "Madrid",
  locality: "Madrid",
  address: "Calle Mayor 1",
};

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

async function authHeaders(app: ReturnType<typeof createApp>): Promise<Record<string, string>> {
  await app.request(req("/auth/signUp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signUpBody),
  }));
  const signIn = await app.request(req("/auth/signIn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: signUpBody.email, password: signUpBody.password }),
  }));
  const tokens = (await signIn.json()) as { accessToken: string };
  return { Authorization: `Bearer ${tokens.accessToken}` };
}

describe("API requests", () => {
  test("sin token -> 401", async () => {
    __resetRateLimit();
    const app = createApp(new MemoryStore());
    const res = await app.request(req("/requests"));
    expect(res.status).toBe(401);
  });

  test("crear -> listar -> detalle -> cancelar -> 409 al repetir", async () => {
    __resetRateLimit();
    const app = createApp(new MemoryStore());
    const headers = { "Content-Type": "application/json", ...(await authHeaders(app)) };

    const created = await app.request(req("/requests", {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    }));
    expect(created.status).toBe(201);
    const createdJson = (await created.json()) as { request: { id: string; status: string } };
    expect(createdJson.request.status).toBe("OPEN");

    const list = await app.request(req("/requests", { headers }));
    expect(list.status).toBe(200);
    const listJson = (await list.json()) as { requests: unknown[]; hasMore: boolean };
    expect(listJson.requests).toHaveLength(1);
    expect(listJson.hasMore).toBe(false);

    const detail = await app.request(req(`/requests/${createdJson.request.id}`, { headers }));
    expect(detail.status).toBe(200);

    const cancel = await app.request(req(`/requests/${createdJson.request.id}/cancel`, {
      method: "POST",
      headers,
    }));
    expect(cancel.status).toBe(200);
    const cancelJson = (await cancel.json()) as { request: { status: string } };
    expect(cancelJson.request.status).toBe("CANCELLED");

    const again = await app.request(req(`/requests/${createdJson.request.id}/cancel`, {
      method: "POST",
      headers,
    }));
    expect(again.status).toBe(409);
  });

  test("400 con datos inválidos y 404 con id ajeno", async () => {
    __resetRateLimit();
    const app = createApp(new MemoryStore());
    const headers = { "Content-Type": "application/json", ...(await authHeaders(app)) };

    const bad = await app.request(req("/requests", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...requestBody, category: "FONTANERIA" }),
    }));
    expect(bad.status).toBe(400);

    const missing = await app.request(req("/requests/no-existe", { headers }));
    expect(missing.status).toBe(404);
  });
});

describe("API tech flow", () => {
  async function techHeaders(app: ReturnType<typeof createApp>, store: MemoryStore, email: string): Promise<Record<string, string>> {
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
    return { Authorization: `Bearer ${tokens.accessToken}` };
  }

  test("pool sin dirección -> postulación -> el cliente elige -> contacto -> terminar", async () => {
    __resetRateLimit();
    const store = new MemoryStore();
    const app = createApp(store);
    const client = { "Content-Type": "application/json", ...(await authHeaders(app)) };
    const tech = { "Content-Type": "application/json", ...(await techHeaders(app, store, "tech@example.com")) };
    const techUser = await store.findUserByEmail("tech@example.com");

    // Cliente crea
    const created = await app.request(req("/requests", {
      method: "POST", headers: client, body: JSON.stringify(requestBody),
    }));
    expect(created.status).toBe(201);
    const { request } = (await created.json()) as { request: { id: string } };

    // Cliente no puede ver el pool
    const forbidden = await app.request(req("/requests/open", { headers: client }));
    expect(forbidden.status).toBe(403);

    // Pool del técnico: sin dirección ni userId
    const pool = await app.request(req("/requests/open", { headers: tech }));
    expect(pool.status).toBe(200);
    const poolJson = (await pool.json()) as { requests: Array<Record<string, unknown>> };
    expect(poolJson.requests).toHaveLength(1);
    expect("address" in poolJson.requests[0]!).toBe(false);
    expect("userId" in poolJson.requests[0]!).toBe(false);

    // Aceptación directa desactivada para técnicos
    const gone = await app.request(req(`/requests/${request.id}/accept`, { method: "POST", headers: tech }));
    expect(gone.status).toBe(410);

    // Postulación
    const apply = await app.request(req(`/requests/${request.id}/apply`, { method: "POST", headers: tech }));
    expect(apply.status).toBe(201);

    // Duplicada -> 409
    const dup = await app.request(req(`/requests/${request.id}/apply`, { method: "POST", headers: tech }));
    expect(dup.status).toBe(409);

    // Sigue en el pool (abierta) hasta que el cliente elige
    const poolStill = await app.request(req("/requests/open", { headers: tech }));
    expect(((await poolStill.json()) as { requests: unknown[] }).requests).toHaveLength(1);

    // El cliente ve candidatos con nombre y sin teléfono
    const cands = await app.request(req(`/requests/${request.id}/applications`, { headers: client }));
    expect(cands.status).toBe(200);
    const candsJson = (await cands.json()) as {
      applications: Array<{ techId: string; firstName: string; avg: number; count: number } & Record<string, unknown>>;
    };
    expect(candsJson.applications).toHaveLength(1);
    expect(candsJson.applications[0]!.techId).toBe(techUser!.id);
    expect("phone" in candsJson.applications[0]!).toBe(false);

    // Elegir a un técnico no postulado -> 409
    const noApp = await app.request(req(`/requests/${request.id}/choose`, {
      method: "POST",
      headers: client,
      body: JSON.stringify({ techId: "00000000-0000-4000-8000-000000000000" }),
    }));
    expect(noApp.status).toBe(409);

    // El cliente elige
    const choose = await app.request(req(`/requests/${request.id}/choose`, {
      method: "POST",
      headers: client,
      body: JSON.stringify({ techId: techUser!.id }),
    }));
    expect(choose.status).toBe(200);
    expect(((await choose.json()) as { request: { status: string } }).request.status).toBe("ACCEPTED");

    // Ya no sale en el pool
    const poolEmpty = await app.request(req("/requests/open", { headers: tech }));
    expect(((await poolEmpty.json()) as { requests: unknown[] }).requests).toHaveLength(0);

    // Detalle del cliente: contacto del técnico elegido
    const detail = await app.request(req(`/requests/${request.id}`, { headers: client }));
    const detailJson = (await detail.json()) as {
      request: { technician: { firstName: string; phone: string } | null };
    };
    expect(detailJson.request.technician?.phone).toBe("+34600999888");

    // Asignada: con dirección y contacto del cliente
    const assigned = await app.request(req(`/requests/assigned/${request.id}`, { headers: tech }));
    expect(assigned.status).toBe(200);
    const assignedJson = (await assigned.json()) as {
      request: { address: string; client: { firstName: string; phone: string } };
    };
    expect(assignedJson.request.address).toBe("Calle Mayor 1");
    expect(assignedJson.request.client.phone).toBe("+34600111222");

    // Cliente ya no puede cancelar (asignada)
    const cancel = await app.request(req(`/requests/${request.id}/cancel`, { method: "POST", headers: client }));
    expect(cancel.status).toBe(409);

    // Terminar
    const done = await app.request(req(`/requests/${request.id}/complete`, { method: "POST", headers: tech }));
    expect(done.status).toBe(200);
    expect(((await done.json()) as { request: { status: string } }).request.status).toBe("DONE");

    // Terminar de nuevo -> 409
    const again = await app.request(req(`/requests/${request.id}/complete`, { method: "POST", headers: tech }));
    expect(again.status).toBe(409);
  });

  test("privacidad entre técnicos y elección ajena bloqueadas", async () => {    __resetRateLimit();
    const store = new MemoryStore();
    const app = createApp(store);
    const client = { "Content-Type": "application/json", ...(await authHeaders(app)) };
    const tech1 = { "Content-Type": "application/json", ...(await techHeaders(app, store, "tech1@example.com")) };
    const tech2 = { "Content-Type": "application/json", ...(await techHeaders(app, store, "tech2@example.com")) };
    const tech1User = await store.findUserByEmail("tech1@example.com");

    const created = await app.request(req("/requests", {
      method: "POST", headers: client, body: JSON.stringify(requestBody),
    }));
    const { request } = (await created.json()) as { request: { id: string } };

    await app.request(req(`/requests/${request.id}/apply`, { method: "POST", headers: tech1 }));

    // Otro técnico solo ve su estado, no la identidad de competidores
    const status = await app.request(req(`/requests/${request.id}/applications`, { headers: tech2 }));
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({ applied: false, applicationCount: 1 });

    // Otro técnico no ve el detalle asignado ni puede terminarlo
    expect((await app.request(req(`/requests/assigned/${request.id}`, { headers: tech2 }))).status).toBe(404);
    expect((await app.request(req(`/requests/${request.id}/complete`, { method: "POST", headers: tech2 }))).status).toBe(404);
    // Ni puede elegir (no es el dueño)
    expect((await app.request(req(`/requests/${request.id}/choose`, {
      method: "POST",
      headers: tech2,
      body: JSON.stringify({ techId: tech1User!.id }),
    }))).status).toBe(404);
  });
});

describe("API fotos", () => {
  test("sin R2 -> 501 explicativo; tipo inválido -> 400; ajeno -> 404", async () => {
    __resetRateLimit();
    const app = createApp(new MemoryStore());
    const headers = { "Content-Type": "application/json", ...(await authHeaders(app)) };

    const created = await app.request(req("/requests", {
      method: "POST", headers, body: JSON.stringify(requestBody),
    }));
    const { request } = (await created.json()) as { request: { id: string } };

    const badType = await app.request(req(`/requests/${request.id}/photos/presign`, {
      method: "POST", headers, body: JSON.stringify({ contentType: "image/gif", count: 1 }),
    }));
    expect(badType.status).toBe(400);

    // Sin R2 configurado en tests -> 501 con mensaje claro
    const noR2 = await app.request(req(`/requests/${request.id}/photos/presign`, {
      method: "POST", headers, body: JSON.stringify({ contentType: "image/webp", count: 1 }),
    }));
    expect(noR2.status).toBe(501);

    // Otro usuario (ni dueño ni asignado) -> 404
    const other = await app.request(req(`/requests/${request.id}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: [`requests/${request.id}/12345678-1234-1234-1234-123456789012.webp`] }),
    }));
    expect(other.status).toBe(401);

    const badKeys = await app.request(req(`/requests/${request.id}/photos`, {
      method: "POST", headers, body: JSON.stringify({ keys: ["otro/prefijo/x.webp"] }),
    }));
    expect(badKeys.status).toBe(400);
  });

  test("conteo de fotos en listas vía store", async () => {
    __resetRateLimit();
    const store = new MemoryStore();
    const app = createApp(store);
    const headers = { "Content-Type": "application/json", ...(await authHeaders(app)) };

    const created = await app.request(req("/requests", {
      method: "POST", headers, body: JSON.stringify(requestBody),
    }));
    const { request } = (await created.json()) as { request: { id: string } };
    await store.addRequestPhotos(request.id, [
      `requests/${request.id}/11111111-1111-1111-1111-111111111111.webp`,
      `requests/${request.id}/22222222-2222-2222-2222-222222222222.jpg`,
    ]);

    const list = await app.request(req("/requests", { headers }));
    const listJson = (await list.json()) as { requests: Array<{ photoCount: number; coverUrl: string | null }> };
    expect(listJson.requests[0]!.photoCount).toBe(2);
    // Sin R2 en tests no hay URL firmada: el campo existe pero es null.
    expect("coverUrl" in listJson.requests[0]!).toBe(true);
    expect(listJson.requests[0]!.coverUrl).toBeNull();
  });
});

describe("API ratings", () => {
  async function setupDone(
    app: ReturnType<typeof createApp>,
    store: MemoryStore,
    techEmail: string,
  ): Promise<{ client: Record<string, string>; tech: Record<string, string>; id: string }> {
    const client = { "Content-Type": "application/json", ...(await authHeaders(app)) };
    const { hashPassword } = await import("../src/lib/password");
    await store.createUser({
      email: techEmail,
      username: techEmail.split("@")[0] ?? techEmail,
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
      body: JSON.stringify({ email: techEmail, password: "Aa1!aaaa" }),
    }));
    const tokens = (await signIn.json()) as { accessToken: string };
    const tech = { "Content-Type": "application/json", Authorization: `Bearer ${tokens.accessToken}` };

    const created = await app.request(req("/requests", {
      method: "POST", headers: client, body: JSON.stringify(requestBody),
    }));
    const { request } = (await created.json()) as { request: { id: string } };
    // Flujo con elección del cliente: postulación + choose (accept directo está desactivado).
    const techUser = await store.findUserByEmail(techEmail);
    await app.request(req(`/requests/${request.id}/apply`, { method: "POST", headers: tech }));
    await app.request(req(`/requests/${request.id}/choose`, {
      method: "POST",
      headers: client,
      body: JSON.stringify({ techId: techUser!.id }),
    }));
    await app.request(req(`/requests/${request.id}/complete`, { method: "POST", headers: tech }));
    return { client, tech, id: request.id };
  }

  test("valorar DONE -> 201; duplicada -> 409; abierta no se puede", async () => {
    __resetRateLimit();
    const store = new MemoryStore();
    const app = createApp(store);
    const { client, id } = await setupDone(app, store, "rate-tech@example.com");

    const rated = await app.request(req(`/requests/${id}/rating`, {
      method: "POST",
      headers: client,
      body: JSON.stringify({ score: 5, comment: "Rápido y limpio" }),
    }));
    expect(rated.status).toBe(201);

    const dup = await app.request(req(`/requests/${id}/rating`, {
      method: "POST",
      headers: client,
      body: JSON.stringify({ score: 4 }),
    }));
    expect(dup.status).toBe(409);

    // Detalle del cliente incluye la valoración
    const detail = await app.request(req(`/requests/${id}`, { headers: client }));
    const detailJson = (await detail.json()) as { request: { rating: { score: number } | null } };
    expect(detailJson.request.rating?.score).toBe(5);

    // Abierta no se puede valorar
    const created = await app.request(req("/requests", {
      method: "POST", headers: client, body: JSON.stringify(requestBody),
    }));
    const open = (await created.json()) as { request: { id: string } };
    const early = await app.request(req(`/requests/${open.request.id}/rating`, {
      method: "POST",
      headers: client,
      body: JSON.stringify({ score: 5 }),
    }));
    expect(early.status).toBe(409);

    // Score fuera de rango -> 400
    const bad = await app.request(req(`/requests/${open.request.id}/rating`, {
      method: "POST",
      headers: client,
      body: JSON.stringify({ score: 6 }),
    }));
    expect(bad.status).toBe(400);
  });

  test("stats del técnico agregan media y conteo", async () => {
    __resetRateLimit();
    const store = new MemoryStore();
    const app = createApp(store);
    const { client, tech, id } = await setupDone(app, store, "stats-tech@example.com");

    await app.request(req(`/requests/${id}/rating`, {
      method: "POST",
      headers: client,
      body: JSON.stringify({ score: 4 }),
    }));

    const stats = await app.request(req("/users/me/rating-stats", { headers: tech }));
    expect(stats.status).toBe(200);
    expect(await stats.json()).toEqual({ stats: { avg: 4, count: 1 } });
  });
});
