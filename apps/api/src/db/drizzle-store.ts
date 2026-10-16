import { and, avg, count, desc, eq, inArray } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type {
  AssignedRequestView,
  CreateRatingInput,
  CreateRequestInput,
  CreateUserInput,
  Store,
  StoredApplication,
  StoredMessage,
  StoredPhoto,
  StoredRating,
  StoredRefresh,
  StoredRequest,
  StoredUser,
} from "./store.js";
import { messages, ratings, refreshTokens, requestApplications, requestPhotos, serviceRequests, users, pushTokens } from "./schema.js";

/**
 * Columnas públicas de usuario. `passwordHash` se excluye a propósito:
 * es la columna más ancha/sensible y ningún lector por id la necesita
 * (la verificación de contraseña usa `findUserByEmail`).
 */
const publicUserColumns = {
  id: users.id,
  email: users.email,
  username: users.username,
  firstName: users.firstName,
  lastName: users.lastName,
  phone: users.phone,
  province: users.province,
  locality: users.locality,
  address: users.address,
  role: users.role,
  avatar: users.avatar,
  createdAt: users.createdAt,
} as const;

function toStoredUser(row: typeof users.$inferSelect): StoredUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    passwordHash: row.passwordHash,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    province: row.province,
    locality: row.locality,
    address: row.address,
    role: row.role,
    avatar: row.avatar,
    createdAt: row.createdAt,
  };
}

/**
 * Store Postgres (Neon) vía Drizzle + postgres.js.
 * Tráfico de app -> connection string pooleada (DATABASE_URL).
 * Pensado para servidor long-lived (@hono/node-server / Bun).
 */
export class DrizzleStore implements Store {
  private readonly db: PostgresJsDatabase;

  constructor(url: string) {
    const sql = postgres(url, { max: 10 });
    this.db = drizzle(sql);
  }

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    try {
      const [row] = await this.db.insert(users).values(input).returning();
      if (!row) throw new Error("Insert sin returning");
      return toStoredUser(row);
    } catch (e) {
      const err = e as { code?: string; constraint?: string };
      if (err.code === "23505") {
        if (err.constraint?.includes("email")) {
          throw Object.assign(new Error("Email ya registrado"), { code: "EMAIL_TAKEN" });
        }
        throw Object.assign(new Error("Username ya registrado"), { code: "USERNAME_TAKEN" });
      }
      throw e;
    }
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    const row = rows[0];
    return row ? toStoredUser(row) : null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const rows = await this.db
      .select(publicUserColumns)
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    const row = rows[0];
    // Sin passwordHash por diseño (egress): nunca se usa para verificar
    // aquí (eso lo hace findUserByEmail); si algún día se usara, bcrypt
    // contra "" falla cerrado (deniega, nunca concede).
    return row ? { ...row, passwordHash: "" } : null;
  }

  async createRefresh(userId: string, tokenHash: string, expiresAt: Date): Promise<StoredRefresh> {
    const [row] = await this.db
      .insert(refreshTokens)
      .values({ userId, tokenHash, expiresAt })
      .returning();
    if (!row) throw new Error("Insert sin returning");
    return row;
  }

  async findRefreshByHash(tokenHash: string): Promise<StoredRefresh | null> {
    const rows = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return rows[0] ?? null;
  }

  async revokeRefresh(tokenHash: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  async createRequest(input: CreateRequestInput): Promise<StoredRequest> {
    const [row] = await this.db.insert(serviceRequests).values(input).returning();
    if (!row) throw new Error("Insert sin returning");
    return toStoredRequest(row);
  }

  async listRequestsByUser(userId: string, limit: number, offset: number): Promise<StoredRequest[]> {
    const rows = await this.db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.userId, userId))
      .orderBy(desc(serviceRequests.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(toStoredRequest);
  }

  async findRequestById(id: string, userId: string): Promise<StoredRequest | null> {
    const rows = await this.db
      .select()
      .from(serviceRequests)
      .where(and(eq(serviceRequests.id, id), eq(serviceRequests.userId, userId)))
      .limit(1);
    const row = rows[0];
    return row ? toStoredRequest(row) : null;
  }

  async cancelRequest(id: string, userId: string): Promise<StoredRequest | "NOT_OPEN" | null> {
    const current = await this.findRequestById(id, userId);
    if (!current) return null;
    if (current.status !== "OPEN") return "NOT_OPEN";
    const [row] = await this.db
      .update(serviceRequests)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(and(eq(serviceRequests.id, id), eq(serviceRequests.status, "OPEN")))
      .returning();
    if (!row) return "NOT_OPEN";
    return toStoredRequest(row);
  }

  async listOpenRequests(province: string | null, limit: number, offset: number): Promise<StoredRequest[]> {
    const conds = [eq(serviceRequests.status, "OPEN")];
    if (province) conds.push(eq(serviceRequests.province, province));
    const rows = await this.db
      .select()
      .from(serviceRequests)
      .where(and(...conds))
      .orderBy(desc(serviceRequests.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(toStoredRequest);
  }

  async listAssignedRequests(techId: string, limit: number, offset: number): Promise<StoredRequest[]> {
    const rows = await this.db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.acceptedBy, techId))
      .orderBy(desc(serviceRequests.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(toStoredRequest);
  }

  async findTechRequest(id: string, techId: string, isAdmin: boolean): Promise<AssignedRequestView | null> {
    const rows = await this.db
      .select({
        request: serviceRequests,
        clientFirstName: users.firstName,
        clientPhone: users.phone,
      })
      .from(serviceRequests)
      .innerJoin(users, eq(serviceRequests.userId, users.id))
      .where(eq(serviceRequests.id, id))
      .limit(1);
    const hit = rows[0];
    if (!hit) return null;
    const row = toStoredRequest(hit.request);
    if (row.status === "OPEN" && row.userId !== techId) {
      return { ...row, clientFirstName: hit.clientFirstName, clientPhone: hit.clientPhone };
    }
    if (row.acceptedBy === techId || isAdmin) {
      return { ...row, clientFirstName: hit.clientFirstName, clientPhone: hit.clientPhone };
    }
    return null;
  }

  async acceptRequest(id: string, techId: string): Promise<StoredRequest | "OWN" | "NOT_OPEN" | null> {
    const rows = await this.db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, id))
      .limit(1);
    const current = rows[0] ? toStoredRequest(rows[0]) : null;
    if (!current) return null;
    if (current.userId === techId) return "OWN";
    if (current.status !== "OPEN") return "NOT_OPEN";
    const [row] = await this.db
      .update(serviceRequests)
      .set({ status: "ACCEPTED", acceptedBy: techId, updatedAt: new Date() })
      .where(and(eq(serviceRequests.id, id), eq(serviceRequests.status, "OPEN")))
      .returning();
    if (!row) return "NOT_OPEN";
    return toStoredRequest(row);
  }

  async completeRequest(
    id: string,
    techId: string,
    isAdmin: boolean,
  ): Promise<StoredRequest | "NOT_ACCEPTED" | null> {
    const rows = await this.db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, id))
      .limit(1);
    const current = rows[0] ? toStoredRequest(rows[0]) : null;
    if (!current) return null;
    if (current.acceptedBy !== techId && !isAdmin) return null;
    if (current.status !== "ACCEPTED") return "NOT_ACCEPTED";
    const conds = [eq(serviceRequests.id, id), eq(serviceRequests.status, "ACCEPTED")];
    if (!isAdmin) conds.push(eq(serviceRequests.acceptedBy, techId));
    const [row] = await this.db
      .update(serviceRequests)
      .set({ status: "DONE", updatedAt: new Date() })
      .where(and(...conds))
      .returning();
    if (!row) return "NOT_ACCEPTED";
    return toStoredRequest(row);
  }

  async findRequestForAttachment(id: string, userId: string): Promise<StoredRequest | null> {
    const rows = await this.db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, id))
      .limit(1);
    const row = rows[0] ? toStoredRequest(rows[0]) : null;
    if (!row) return null;
    if (row.status !== "OPEN" && row.status !== "ACCEPTED") return null;
    if (row.userId === userId || row.acceptedBy === userId) return row;
    return null;
  }

  async addRequestPhotos(requestId: string, keys: string[]): Promise<StoredPhoto[]> {
    if (keys.length === 0) return [];
    const rows = await this.db
      .insert(requestPhotos)
      .values(keys.map((objectKey) => ({ requestId, objectKey })))
      .onConflictDoNothing()
      .returning();
    return rows;
  }

  async listRequestPhotos(requestId: string): Promise<StoredPhoto[]> {
    return this.db
      .select()
      .from(requestPhotos)
      .where(eq(requestPhotos.requestId, requestId))
      .orderBy(requestPhotos.createdAt);
  }

  async countPhotosByRequest(ids: string[]): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const id of ids) counts[id] = 0;
    if (ids.length === 0) return counts;
    const rows = await this.db
      .select({ requestId: requestPhotos.requestId, n: count() })
      .from(requestPhotos)
      .where(inArray(requestPhotos.requestId, ids))
      .groupBy(requestPhotos.requestId);
    for (const r of rows) counts[r.requestId] = Number(r.n);
    return counts;
  }

  async firstPhotoByRequest(ids: string[]): Promise<Record<string, StoredPhoto>> {
    const firsts: Record<string, StoredPhoto> = {};
    if (ids.length === 0) return firsts;
    const rows = await this.db
      .select()
      .from(requestPhotos)
      .where(inArray(requestPhotos.requestId, ids))
      .orderBy(requestPhotos.createdAt);
    for (const r of rows) {
      if (!(r.requestId in firsts)) firsts[r.requestId] = r;
    }
    return firsts;
  }

  async createRating(
    clientId: string,
    requestId: string,
    score: number,
    comment: string | null,
  ): Promise<StoredRating | "NOT_DONE" | "DUPLICATE" | null> {
    const reqs = await this.db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId))
      .limit(1);
    const row = reqs[0] ? toStoredRequest(reqs[0]) : null;
    if (!row || row.userId !== clientId) return null;
    if (row.status !== "DONE" || !row.acceptedBy) return "NOT_DONE";
    const input: CreateRatingInput = {
      requestId,
      techId: row.acceptedBy,
      clientId,
      score,
      comment,
    };
    try {
      const [created] = await this.db.insert(ratings).values(input).returning();
      if (!created) throw new Error("Insert sin returning");
      return created;
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "23505") return "DUPLICATE";
      throw e;
    }
  }

  async findRatingByRequest(requestId: string): Promise<StoredRating | null> {
    const rows = await this.db
      .select()
      .from(ratings)
      .where(eq(ratings.requestId, requestId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getTechRatingStats(techId: string): Promise<{ avg: number; count: number }> {
    const rows = await this.db
      .select({ avgScore: avg(ratings.score), n: count() })
      .from(ratings)
      .where(eq(ratings.techId, techId));
    const row = rows[0];
    const n = Number(row?.n ?? 0);
    if (n === 0) return { avg: 0, count: 0 };
    return { avg: Number(row?.avgScore ?? 0), count: n };
  }

  async applyToRequest(
    requestId: string,
    techId: string,
  ): Promise<StoredApplication | "OWN" | "NOT_OPEN" | "DUPLICATE" | null> {
    const rows = await this.db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId))
      .limit(1);
    const current = rows[0] ? toStoredRequest(rows[0]) : null;
    if (!current) return null;
    if (current.userId === techId) return "OWN";
    if (current.status !== "OPEN") return "NOT_OPEN";
    try {
      const [created] = await this.db
        .insert(requestApplications)
        .values({ requestId, techId })
        .returning();
      if (!created) throw new Error("Insert sin returning");
      return created;
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "23505") return "DUPLICATE";
      throw e;
    }
  }

  async hasApplied(requestId: string, techId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: requestApplications.id })
      .from(requestApplications)
      .where(and(eq(requestApplications.requestId, requestId), eq(requestApplications.techId, techId)))
      .limit(1);
    return rows.length > 0;
  }

  async listApplications(requestId: string): Promise<StoredApplication[]> {
    return this.db
      .select()
      .from(requestApplications)
      .where(eq(requestApplications.requestId, requestId))
      .orderBy(requestApplications.createdAt);
  }

  async countApplicationsByRequest(ids: string[]): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const id of ids) counts[id] = 0;
    if (ids.length === 0) return counts;
    const rows = await this.db
      .select({ requestId: requestApplications.requestId, n: count() })
      .from(requestApplications)
      .where(inArray(requestApplications.requestId, ids))
      .groupBy(requestApplications.requestId);
    for (const r of rows) counts[r.requestId] = Number(r.n);
    return counts;
  }

  async chooseApplication(
    requestId: string,
    clientId: string,
    techId: string,
  ): Promise<StoredRequest | "NOT_OPEN" | "NO_APPLICATION" | null> {
    const reqs = await this.db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId))
      .limit(1);
    const current = reqs[0] ? toStoredRequest(reqs[0]) : null;
    if (!current || current.userId !== clientId) return null;
    if (current.status !== "OPEN") return "NOT_OPEN";
    if (!(await this.hasApplied(requestId, techId))) return "NO_APPLICATION";
    const [row] = await this.db
      .update(serviceRequests)
      .set({ status: "ACCEPTED", acceptedBy: techId, updatedAt: new Date() })
      .where(and(eq(serviceRequests.id, requestId), eq(serviceRequests.status, "OPEN")))
      .returning();
    if (!row) return "NOT_OPEN";
    return toStoredRequest(row);
  }

  async getApplicantProfiles(techIds: string[]): Promise<Array<{ id: string; firstName: string; username: string }>> {
    if (techIds.length === 0) return [];
    return this.db
      .select({ id: users.id, firstName: users.firstName, username: users.username })
      .from(users)
      .where(inArray(users.id, techIds));
  }

  async getTechsRatingStats(techIds: string[]): Promise<Record<string, { avg: number; count: number }>> {
    const stats: Record<string, { avg: number; count: number }> = {};
    for (const id of techIds) stats[id] = { avg: 0, count: 0 };
    if (techIds.length === 0) return stats;
    const rows = await this.db
      .select({ techId: ratings.techId, avgScore: avg(ratings.score), n: count() })
      .from(ratings)
      .where(inArray(ratings.techId, techIds))
      .groupBy(ratings.techId);
    for (const r of rows) {
      stats[r.techId] = { avg: Number(r.avgScore ?? 0), count: Number(r.n) };
    }
    return stats;
  }

  async setPushToken(userId: string, token: string): Promise<void> {
    await this.db
      .insert(pushTokens)
      .values({ userId, token, updatedAt: new Date() })
      .onConflictDoUpdate({ target: pushTokens.userId, set: { token, updatedAt: new Date() } });
  }

  async deletePushToken(userId: string): Promise<void> {
    await this.db.delete(pushTokens).where(eq(pushTokens.userId, userId));
  }

  async getPushToken(userId: string): Promise<string | null> {
    const rows = await this.db
      .select({ token: pushTokens.token })
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId))
      .limit(1);
    return rows[0]?.token ?? null;
  }

  async findRequestParties(requestId: string): Promise<{ userId: string; acceptedBy: string | null; status: string } | null> {
    const rows = await this.db
      .select({ userId: serviceRequests.userId, acceptedBy: serviceRequests.acceptedBy, status: serviceRequests.status })
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId))
      .limit(1);
    return rows[0] ?? null;
  }

  async listMessages(requestId: string, limit: number, offset: number): Promise<StoredMessage[]> {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.requestId, requestId))
      .orderBy(messages.createdAt)
      .limit(limit)
      .offset(offset);
  }

  async createMessage(requestId: string, senderId: string, body: string): Promise<StoredMessage> {
    const [row] = await this.db
      .insert(messages)
      .values({ requestId, senderId, body })
      .returning();
    if (!row) throw new Error("Insert sin returning");
    return row;
  }
}

function toStoredRequest(row: typeof serviceRequests.$inferSelect): StoredRequest {
  return {
    id: row.id,
    userId: row.userId,
    category: row.category,
    description: row.description,
    province: row.province,
    locality: row.locality,
    address: row.address,
    availability: row.availability,
    status: row.status,
    acceptedBy: row.acceptedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
