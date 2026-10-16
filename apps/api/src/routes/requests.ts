import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  MAX_REQUEST_PHOTOS,
  PHOTO_CONTENT_TYPES,
  chooseTechSchema,
  messageCreateSchema,
  ratingCreateSchema,
  requestCreateSchema,
} from "@reformapp/shared";
import type { AssignedRequestView, Store, StoredPhoto, StoredRating, StoredRequest } from "../db/store.js";
import { notifyUser } from "../lib/expo-push.js";
import { presignedGetUrl, presignedPutUrl } from "../lib/r2.js";

function toPublicRequest(r: StoredRequest, photoCount: number, applicationCount = 0, coverUrl: string | null = null) {
  return {
    id: r.id,
    userId: r.userId,
    category: r.category,
    description: r.description,
    province: r.province,
    locality: r.locality,
    address: r.address,
    availability: r.availability,
    status: r.status,
    acceptedBy: r.acceptedBy,
    photoCount,
    coverUrl,
    applicationCount,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Pool: sin dirección exacta ni userId (privacidad hasta aceptar). */
function toPoolRequest(r: StoredRequest, photoCount: number, applicationCount = 0, coverUrl: string | null = null) {
  return {
    id: r.id,
    category: r.category,
    description: r.description,
    province: r.province,
    locality: r.locality,
    availability: r.availability,
    status: r.status,
    photoCount,
    coverUrl,
    applicationCount,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Asignada: completa + contacto del cliente para coordinar. */
function toAssignedRequest(r: AssignedRequestView, photos: StoredPhoto[], urls: Map<string, string>) {
  return {
    ...toPublicRequest(r, photos.length),
    photos: photos
      .filter((p) => urls.has(p.id))
      .map((p) => ({
        id: p.id,
        key: p.objectKey,
        url: urls.get(p.id) as string,
        createdAt: p.createdAt.toISOString(),
      })),
    client: { firstName: r.clientFirstName, phone: r.clientPhone },
  };
}

async function photoUrls(photos: StoredPhoto[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  await Promise.all(
    photos.map(async (p) => {
      const url = await presignedGetUrl(p.objectKey);
      if (url) urls.set(p.id, url);
    }),
  );
  return urls;
}

/** Portadas de lista: primera foto de cada solicitud con URL lista. */
async function coverUrlMap(store: Store, ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const firsts = await store.firstPhotoByRequest(ids);
  const urls = await photoUrls(Object.values(firsts));
  const map: Record<string, string> = {};
  for (const p of Object.values(firsts)) {
    const url = urls.get(p.id);
    if (url) map[p.requestId] = url;
  }
  return map;
}

function toPublicRating(r: StoredRating) {
  return {
    id: r.id,
    requestId: r.requestId,
    techId: r.techId,
    clientId: r.clientId,
    score: r.score,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
  };
}

function isTech(c: { get(key: string): unknown }): boolean {
  const role = c.get("userRole");
  return role === "TECH" || role === "ADMIN";
}

function isAdmin(c: { get(key: string): unknown }): boolean {
  return c.get("userRole") === "ADMIN";
}

function pageParams(c: { req: { query(name: string): string | undefined } }): { limit: number; offset: number } {
  const q = (n: string) => c.req.query(n);
  return {
    limit: Math.min(Math.max(Number(q("limit")) || PAGE_DEFAULT, 1), PAGE_MAX),
    offset: Math.max(Number(q("offset")) || 0, 0),
  };
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PAGE_DEFAULT = 20;
const PAGE_MAX = 50;

export function requestRoutes(store: Store): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = requestCreateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ message: "Datos no válidos", errors: parsed.error.flatten().fieldErrors }, 400);
    }
    const userId = c.get("userId") as string;
    const row = await store.createRequest({ ...parsed.data, userId });
    return c.json({ request: toPublicRequest(row, 0) }, 201);
  });

  app.get("/", async (c) => {
    const { limit, offset } = pageParams(c);
    const userId = c.get("userId") as string;
    // +1 para saber si hay más sin un COUNT extra (egress).
    const rows = await store.listRequestsByUser(userId, limit + 1, offset);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const ids = page.map((r) => r.id);
    const [counts, appCounts] = await Promise.all([
      store.countPhotosByRequest(ids),
      store.countApplicationsByRequest(ids),
    ]);
    const covers = await coverUrlMap(store, ids);
    return c.json(
      { requests: page.map((r) => toPublicRequest(r, counts[r.id] ?? 0, appCounts[r.id] ?? 0, covers[r.id] ?? null)), hasMore },
      200,
    );
  });

  // ---- Flujo técnico (TECH/ADMIN). Rutas fijas SIEMPRE antes de /:id. ----

  app.get("/open", async (c) => {
    if (!isTech(c)) return c.json({ message: "No autorizado" }, 403);
    const province = c.req.query("province")?.trim() || null;
    const { limit, offset } = pageParams(c);
    const rows = await store.listOpenRequests(province, limit + 1, offset);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const ids = page.map((r) => r.id);
    const [counts, appCounts] = await Promise.all([
      store.countPhotosByRequest(ids),
      store.countApplicationsByRequest(ids),
    ]);
    const covers = await coverUrlMap(store, ids);
    return c.json({ requests: page.map((r) => toPoolRequest(r, counts[r.id] ?? 0, appCounts[r.id] ?? 0, covers[r.id] ?? null)), hasMore }, 200);
  });

  app.get("/assigned", async (c) => {
    if (!isTech(c)) return c.json({ message: "No autorizado" }, 403);
    const techId = c.get("userId") as string;
    const { limit, offset } = pageParams(c);
    const rows = await store.listAssignedRequests(techId, limit + 1, offset);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const ids = page.map((r) => r.id);
    const [counts, appCounts] = await Promise.all([
      store.countPhotosByRequest(ids),
      store.countApplicationsByRequest(ids),
    ]);
    const covers = await coverUrlMap(store, ids);
    return c.json(
      { requests: page.map((r) => toPublicRequest(r, counts[r.id] ?? 0, appCounts[r.id] ?? 0, covers[r.id] ?? null)), hasMore },
      200,
    );
  });

  app.get("/open/:id", async (c) => {
    if (!isTech(c)) return c.json({ message: "No autorizado" }, 403);
    const techId = c.get("userId") as string;
    const row = await store.findTechRequest(c.req.param("id"), techId, isAdmin(c));
    if (!row || row.status !== "OPEN") return c.json({ message: "Solicitud no encontrada" }, 404);
    const [counts, appCounts] = await Promise.all([
      store.countPhotosByRequest([row.id]),
      store.countApplicationsByRequest([row.id]),
    ]);
    return c.json({
      request: toPoolRequest(row, counts[row.id] ?? 0, appCounts[row.id] ?? 0),
      applied: await store.hasApplied(row.id, techId),
    }, 200);
  });

  app.get("/assigned/:id", async (c) => {
    if (!isTech(c)) return c.json({ message: "No autorizado" }, 403);
    const techId = c.get("userId") as string;
    const row = await store.findTechRequest(c.req.param("id"), techId, isAdmin(c));
    if (!row || row.status === "OPEN") return c.json({ message: "Solicitud no encontrada" }, 404);
    const photos = await store.listRequestPhotos(row.id);
    const rating = await store.findRatingByRequest(row.id);
    const base = toAssignedRequest(row, photos, await photoUrls(photos));
    return c.json({ request: { ...base, rating: rating ? toPublicRating(rating) : null } }, 200);
  });

  // Aceptación directa desactivada: ahora el cliente elige entre los
  // postulados. Solo ADMIN conserva el atajo (gestión/backoffice).
  app.post("/:id/accept", async (c) => {
    if (!isAdmin(c)) {
      return c.json(
        { message: "Ahora el cliente elige: postúlate al trabajo y espera su elección." },
        410,
      );
    }
    const techId = c.get("userId") as string;
    const result = await store.acceptRequest(c.req.param("id"), techId);
    if (result === null) return c.json({ message: "Solicitud no encontrada" }, 404);
    if (result === "OWN") {
      return c.json({ message: "No puedes aceptar tu propia solicitud" }, 409);
    }
    if (result === "NOT_OPEN") {
      return c.json({ message: "Esta solicitud ya no está abierta" }, 409);
    }
    const counts = await store.countPhotosByRequest([result.id]);
    const appCounts = await store.countApplicationsByRequest([result.id]);
    return c.json({ request: toPublicRequest(result, counts[result.id] ?? 0, appCounts[result.id] ?? 0) }, 200);
  });

  // ---- Postulaciones: el técnico se postula, el cliente elige. ----

  app.post("/:id/apply", async (c) => {
    if (!isTech(c)) return c.json({ message: "No autorizado" }, 403);
    const techId = c.get("userId") as string;
    const result = await store.applyToRequest(c.req.param("id"), techId);
    if (result === null) return c.json({ message: "Solicitud no encontrada" }, 404);
    if (result === "OWN") {
      return c.json({ message: "No puedes postularte a tu propia solicitud" }, 409);
    }
    if (result === "NOT_OPEN") {
      return c.json({ message: "Esta solicitud ya no está abierta" }, 409);
    }
    if (result === "DUPLICATE") {
      return c.json({ message: "Ya te postulaste a este trabajo" }, 409);
    }
    // Avisa al cliente (best-effort, no bloquea).
    const parties = await store.findRequestParties(result.requestId);
    if (parties) {
      await notifyUser(store.getPushToken.bind(store), parties.userId,
        "Nuevo candidato",
        "Un técnico quiere hacer tu reforma. Míralo y elige.",
        { requestId: result.requestId, kind: "application" });
    }
    return c.json(
      {
        application: {
          id: result.id,
          requestId: result.requestId,
          techId: result.techId,
          createdAt: result.createdAt.toISOString(),
        },
      },
      201,
    );
  });

  app.get("/:id/applications", async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    // Dueño: lista de candidatos (nombre + valoración, sin contacto).
    const own = await store.findRequestById(id, userId);
    if (own) {
      const apps = await store.listApplications(id);
      const techIds = [...new Set(apps.map((a) => a.techId))];
      const [profiles, stats] = await Promise.all([
        store.getApplicantProfiles(techIds),
        store.getTechsRatingStats(techIds),
      ]);
      const byId = new Map(profiles.map((p) => [p.id, p]));
      return c.json({
        applications: apps.map((a) => {
          const p = byId.get(a.techId);
          const s = stats[a.techId] ?? { avg: 0, count: 0 };
          return {
            techId: a.techId,
            firstName: p?.firstName ?? "Técnico",
            username: p?.username ?? "",
            avg: Math.round(s.avg * 10) / 10,
            count: s.count,
            appliedAt: a.createdAt.toISOString(),
          };
        }),
      }, 200);
    }
    // Técnico con acceso: solo su estado (sin revelar competidores).
    if (!isTech(c)) return c.json({ message: "Solicitud no encontrada" }, 404);
    const tech = await store.findTechRequest(id, userId, isAdmin(c));
    if (!tech) return c.json({ message: "Solicitud no encontrada" }, 404);
    const counts = await store.countApplicationsByRequest([id]);
    return c.json(
      { applied: await store.hasApplied(id, userId), applicationCount: counts[id] ?? 0 },
      200,
    );
  });

  app.post("/:id/choose", async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req.json().catch(() => null);
    const parsed = chooseTechSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ message: "Datos no válidos", errors: parsed.error.flatten().fieldErrors }, 400);
    }
    const result = await store.chooseApplication(c.req.param("id"), userId, parsed.data.techId);
    if (result === null) return c.json({ message: "Solicitud no encontrada" }, 404);
    if (result === "NOT_OPEN") {
      return c.json({ message: "Esta solicitud ya no está abierta" }, 409);
    }
    if (result === "NO_APPLICATION") {
      return c.json({ message: "Ese técnico no se postuló a este trabajo" }, 409);
    }
    const counts = await store.countPhotosByRequest([result.id]);
    const appCounts = await store.countApplicationsByRequest([result.id]);
    if (result.acceptedBy) {
      await notifyUser(store.getPushToken.bind(store), result.acceptedBy,
        "¡Te han elegido!",
        "Un cliente te ha elegido para su reforma. Ponte en marcha.",
        { requestId: result.id, kind: "chosen" });
    }
    return c.json({ request: toPublicRequest(result, counts[result.id] ?? 0, appCounts[result.id] ?? 0) }, 200);
  });

  app.post("/:id/complete", async (c) => {
    if (!isTech(c)) return c.json({ message: "No autorizado" }, 403);
    const techId = c.get("userId") as string;
    const result = await store.completeRequest(c.req.param("id"), techId, isAdmin(c));
    if (result === null) return c.json({ message: "Solicitud no encontrada" }, 404);
    if (result === "NOT_ACCEPTED") {
      return c.json({ message: "Solo se pueden terminar trabajos en curso" }, 409);
    }
    const counts = await store.countPhotosByRequest([result.id]);
    const appCounts = await store.countApplicationsByRequest([result.id]);
    await notifyUser(store.getPushToken.bind(store), result.userId,
      "Trabajo terminado",
      "Tu reforma está terminada. Valora cómo fue.",
      { requestId: result.id, kind: "done" });
    return c.json({ request: toPublicRequest(result, counts[result.id] ?? 0, appCounts[result.id] ?? 0) }, 200);
  });

  // ---- Fotos (dueño o técnico asignado, en OPEN/ACCEPTED). ----

  app.post("/:id/photos/presign", async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const row = await store.findRequestForAttachment(id, userId);
    if (!row) return c.json({ message: "Solicitud no encontrada" }, 404);

    const body = await c.req.json().catch(() => null);
    const contentType = typeof body?.contentType === "string" ? body.contentType : "";
    const count = typeof body?.count === "number" ? Math.floor(body.count) : 0;
    if (!(PHOTO_CONTENT_TYPES as readonly string[]).includes(contentType) || count < 1 || count > 5) {
      return c.json({ message: "Tipo o cantidad no válidos (máx. 5 por tanda)" }, 400);
    }
    const existing = await store.countPhotosByRequest([id]);
    if ((existing[id] ?? 0) + count > MAX_REQUEST_PHOTOS) {
      return c.json({ message: `Máximo ${MAX_REQUEST_PHOTOS} fotos por solicitud` }, 409);
    }

    const ext = EXT_BY_TYPE[contentType] as string;
    const uploads: Array<{ key: string; url: string }> = [];
    for (let i = 0; i < count; i++) {
      const key = `requests/${id}/${randomUUID()}.${ext}`;
      const url = await presignedPutUrl(key, contentType);
      if (!url) return c.json({ message: "Fotos no configuradas en el servidor" }, 501);
      uploads.push({ key, url });
    }
    return c.json({ uploads }, 200);
  });

  app.post("/:id/photos", async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const row = await store.findRequestForAttachment(id, userId);
    if (!row) return c.json({ message: "Solicitud no encontrada" }, 404);

    const body = await c.req.json().catch(() => null);
    const keys = Array.isArray(body?.keys) ? body.keys.filter((k: unknown) => typeof k === "string") : [];
    if (keys.length < 1 || keys.length > 5) {
      return c.json({ message: "Debes confirmar entre 1 y 5 fotos" }, 400);
    }
    const prefix = `requests/${id}/`;
    const valid = keys.every(
      (k: string) =>
        k.startsWith(prefix) && /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(k.slice(prefix.length)),
    );
    if (!valid) return c.json({ message: "Claves de foto no válidas" }, 400);
    const existing = await store.countPhotosByRequest([id]);
    if ((existing[id] ?? 0) + keys.length > MAX_REQUEST_PHOTOS) {
      return c.json({ message: `Máximo ${MAX_REQUEST_PHOTOS} fotos por solicitud` }, 409);
    }

    const photos = await store.addRequestPhotos(id, keys);
    return c.json({ photos: await withUrls(photos) }, 200);
  });

  async function withUrls(photos: StoredPhoto[]) {
    const urls = await photoUrls(photos);
    return photos
      .filter((p) => urls.has(p.id))
      .map((p) => ({
        id: p.id,
        key: p.objectKey,
        url: urls.get(p.id) as string,
        createdAt: p.createdAt.toISOString(),
      }));
  }

  // ---- Vista del cliente (dueño). Después de las fijas. ----

  app.get("/:id", async (c) => {
    const userId = c.get("userId") as string;
    const row = await store.findRequestById(c.req.param("id"), userId);
    if (!row) return c.json({ message: "Solicitud no encontrada" }, 404);
    const photos = await store.listRequestPhotos(row.id);
    const rating = await store.findRatingByRequest(row.id);
    const appCounts = await store.countApplicationsByRequest([row.id]);
    // Contacto del técnico elegido (para coordinar una vez asignado).
    let technician: { firstName: string; phone: string } | null = null;
    if (row.acceptedBy) {
      const tech = await store.findUserById(row.acceptedBy);
      if (tech) technician = { firstName: tech.firstName, phone: tech.phone };
    }
    return c.json({
      request: {
        ...toPublicRequest(row, photos.length, appCounts[row.id] ?? 0),
        photos: await withUrls(photos),
        rating: rating ? toPublicRating(rating) : null,
        technician,
      },
    }, 200);
  });

  app.post("/:id/cancel", async (c) => {
    const userId = c.get("userId") as string;
    const result = await store.cancelRequest(c.req.param("id"), userId);
    if (result === null) return c.json({ message: "Solicitud no encontrada" }, 404);
    if (result === "NOT_OPEN") {
      return c.json({ message: "Solo se pueden cancelar solicitudes abiertas" }, 409);
    }
    const counts = await store.countPhotosByRequest([result.id]);
    const appCounts = await store.countApplicationsByRequest([result.id]);
    return c.json({ request: toPublicRequest(result, counts[result.id] ?? 0, appCounts[result.id] ?? 0) }, 200);
  });

  // ---- Valoraciones (solo el cliente dueño, una por solicitud DONE). ----

  app.post("/:id/rating", async (c) => {
    const userId = c.get("userId") as string;
    const body = await c.req.json().catch(() => null);
    const parsed = ratingCreateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ message: "Datos no válidos", errors: parsed.error.flatten().fieldErrors }, 400);
    }
    const result = await store.createRating(userId, c.req.param("id"), parsed.data.score, parsed.data.comment);
    if (result === null) return c.json({ message: "Solicitud no encontrada" }, 404);
    if (result === "NOT_DONE") {
      return c.json({ message: "Solo se pueden valorar trabajos terminados" }, 409);
    }
    if (result === "DUPLICATE") {
      return c.json({ message: "Esta solicitud ya fue valorada" }, 409);
    }
    return c.json({ rating: toPublicRating(result) }, 201);
  });

  app.get("/:id/rating", async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    // Dueño o técnico con acceso (asignado/admin): nadie más ve notas.
    const own = await store.findRequestById(id, userId);
    const tech = own ? null : await store.findTechRequest(id, userId, isAdmin(c));
    if (!own && !tech) return c.json({ message: "Solicitud no encontrada" }, 404);
    const rating = await store.findRatingByRequest(id);
    return c.json({ rating: rating ? toPublicRating(rating) : null }, 200);
  });

  // ---- Chat (solo dueño y técnico asignado; escribir solo en ACCEPTED). ----

  function toChatMessage(
    requestId: string,
    m: { id: string; senderId: string; body: string; createdAt: Date },
    me: string,
  ) {
    return {
      id: m.id,
      requestId,
      senderId: m.senderId,
      mine: m.senderId === me,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    };
  }

  app.get("/:id/messages", async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const parties = await store.findRequestParties(id);
    if (!parties) return c.json({ message: "Solicitud no encontrada" }, 404);
    const party = userId === parties.userId || userId === parties.acceptedBy;
    if (!party) return c.json({ message: "Solicitud no encontrada" }, 404);
    if (parties.status !== "ACCEPTED" && parties.status !== "DONE") {
      return c.json({ message: "El chat se abre cuando el trabajo empieza" }, 409);
    }
    const { limit, offset } = pageParams(c);
    const rows = await store.listMessages(id, limit + 1, offset);
    const hasMore = rows.length > limit;
    return c.json({ messages: rows.slice(0, limit).map((m) => toChatMessage(id, m, userId)), hasMore }, 200);
  });

  app.post("/:id/messages", async (c) => {
    const userId = c.get("userId") as string;
    const id = c.req.param("id");
    const parties = await store.findRequestParties(id);
    if (!parties) return c.json({ message: "Solicitud no encontrada" }, 404);
    const party = userId === parties.userId || userId === parties.acceptedBy;
    if (!party) return c.json({ message: "Solicitud no encontrada" }, 404);
    if (parties.status !== "ACCEPTED") {
      return c.json({ message: "El chat se abre cuando el trabajo empieza" }, 409);
    }
    const body = await c.req.json().catch(() => null);
    const parsed = messageCreateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ message: "Datos no válidos", errors: parsed.error.flatten().fieldErrors }, 400);
    }
    const created = await store.createMessage(id, userId, parsed.data.body);
    // Avisa a la otra parte (best-effort, genérico en la pantalla de bloqueo).
    const other = userId === parties.userId ? parties.acceptedBy : parties.userId;
    if (other) {
      await notifyUser(store.getPushToken.bind(store), other,
        "Nuevo mensaje",
        "Tienes un mensaje nuevo en tu reforma.",
        { requestId: id, kind: "message" });
    }
    return c.json({ message: toChatMessage(id, created, userId) }, 201);
  });

  return app;
}

export { toPublicRequest };
