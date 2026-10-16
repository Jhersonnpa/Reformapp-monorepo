import type { RequestCategory, RequestStatus, Role } from "@reformapp/shared";

export interface CreateUserInput {
  email: string;
  username: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string;
  province: string;
  locality: string;
  address: string;
  role: Role;
}

export interface StoredUser extends CreateUserInput {
  id: string;
  avatar: string | null;
  createdAt: Date;
}

export interface StoredRefresh {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface Store {
  createUser(input: CreateUserInput): Promise<StoredUser>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  createRefresh(userId: string, tokenHash: string, expiresAt: Date): Promise<StoredRefresh>;
  findRefreshByHash(tokenHash: string): Promise<StoredRefresh | null>;
  revokeRefresh(tokenHash: string): Promise<void>;
  createRequest(input: CreateRequestInput): Promise<StoredRequest>;
  /** Solo las del usuario, más recientes primero, paginado. */
  listRequestsByUser(userId: string, limit: number, offset: number): Promise<StoredRequest[]>;
  /** Solo si es del usuario; null si no existe o es de otro. */
  findRequestById(id: string, userId: string): Promise<StoredRequest | null>;
  /**
   * OPEN -> CANCELLED solo del propio usuario. Devuelve null si no existe
   * o no es suya, "NOT_OPEN" si ya no está abierta.
   */
  cancelRequest(id: string, userId: string): Promise<StoredRequest | "NOT_OPEN" | null>;
  /** Pool de abiertas para técnicos (filtro opcional por provincia). */
  listOpenRequests(province: string | null, limit: number, offset: number): Promise<StoredRequest[]>;
  /** Trabajos aceptados por el técnico (incluye terminados). */
  listAssignedRequests(techId: string, limit: number, offset: number): Promise<StoredRequest[]>;
  /**
   * Vista de trabajo para el técnico: pool (OPEN de otro) o asignado
   * (suyo o admin) con contacto del cliente. Null si no tiene acceso.
   */
  findTechRequest(id: string, techId: string, isAdmin: boolean): Promise<AssignedRequestView | null>;
  /**
   * OPEN -> ACCEPTED. Null si no existe, "OWN" si es suya,
   * "NOT_OPEN" si ya no está abierta.
   */
  acceptRequest(id: string, techId: string): Promise<StoredRequest | "OWN" | "NOT_OPEN" | null>;
  /**
   * ACCEPTED -> DONE. Solo quien la aceptó o admin. Null si no existe
   * o sin acceso, "NOT_ACCEPTED" si no está en curso.
   */
  completeRequest(id: string, techId: string, isAdmin: boolean): Promise<StoredRequest | "NOT_ACCEPTED" | null>;
  /**
   * Dueño o técnico asignado, con solicitud en OPEN/ACCEPTED.
   * Para subir fotos (cliente documenta, técnico evidencia).
   */
  findRequestForAttachment(id: string, userId: string): Promise<StoredRequest | null>;
  addRequestPhotos(requestId: string, keys: string[]): Promise<StoredPhoto[]>;
  listRequestPhotos(requestId: string): Promise<StoredPhoto[]>;
  countPhotosByRequest(ids: string[]): Promise<Record<string, number>>;
  /** Primera foto de cada solicitud (para portadas de lista, una query). */
  firstPhotoByRequest(ids: string[]): Promise<Record<string, StoredPhoto>>;
  /**
   * Crea la valoración (una por solicitud). Null si la request no existe
   * o no es del cliente; "NOT_DONE" si no está terminada o no tiene
   * técnico; "DUPLICATE" si ya se valoró.
   */
  createRating(clientId: string, requestId: string, score: number, comment: string | null): Promise<StoredRating | "NOT_DONE" | "DUPLICATE" | null>;
  findRatingByRequest(requestId: string): Promise<StoredRating | null>;
  getTechRatingStats(techId: string): Promise<{ avg: number; count: number }>;
  /**
   * Postulación a una OPEN ajena. Null si no existe, "OWN" si es suya,
   * "NOT_OPEN" si ya no está abierta, "DUPLICATE" si ya se postuló.
   */
  applyToRequest(requestId: string, techId: string): Promise<StoredApplication | "OWN" | "NOT_OPEN" | "DUPLICATE" | null>;
  hasApplied(requestId: string, techId: string): Promise<boolean>;
  /** Postulaciones de una solicitud, más antiguas primero. */
  listApplications(requestId: string): Promise<StoredApplication[]>;
  countApplicationsByRequest(ids: string[]): Promise<Record<string, number>>;
  /**
   * El dueño elige a un técnico postulado: OPEN -> ACCEPTED.
   * Null si no existe o no es suya, "NOT_OPEN" si ya no está
   * abierta, "NO_APPLICATION" si ese técnico no se postuló.
   */
  chooseApplication(requestId: string, clientId: string, techId: string): Promise<StoredRequest | "NOT_OPEN" | "NO_APPLICATION" | null>;
  /**
   * Perfil público mínimo de técnicos (nombre visible para elegir).
   * Sin teléfono/email/dirección por privacidad.
   */
  getApplicantProfiles(techIds: string[]): Promise<Array<{ id: string; firstName: string; username: string }>>;
  getTechsRatingStats(techIds: string[]): Promise<Record<string, { avg: number; count: number }>>;
  /** Token push Expo (uno por usuario, se sobrescribe al reinstalar). */
  setPushToken(userId: string, token: string): Promise<void>;
  deletePushToken(userId: string): Promise<void>;
  getPushToken(userId: string): Promise<string | null>;
  /** Dueño, asignado y estado (para notificar y autorizar chat sin exponer datos). */
  findRequestParties(requestId: string): Promise<{ userId: string; acceptedBy: string | null; status: string } | null>;
  /** Historial del chat, cronológico. */
  listMessages(requestId: string, limit: number, offset: number): Promise<StoredMessage[]>;
  createMessage(requestId: string, senderId: string, body: string): Promise<StoredMessage>;
}

export interface CreateRequestInput {
  userId: string;
  category: RequestCategory;
  description: string;
  province: string;
  locality: string;
  address: string;
  availability: string | null;
}

export interface StoredRequest extends CreateRequestInput {
  id: string;
  status: RequestStatus;
  acceptedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignedRequestView extends StoredRequest {
  clientFirstName: string;
  clientPhone: string;
}

export interface StoredPhoto {
  id: string;
  requestId: string;
  objectKey: string;
  createdAt: Date;
}

export interface CreateRatingInput {
  requestId: string;
  techId: string;
  clientId: string;
  score: number;
  comment: string | null;
}

export interface StoredRating extends CreateRatingInput {
  id: string;
  createdAt: Date;
}

export interface StoredApplication {
  id: string;
  requestId: string;
  techId: string;
  createdAt: Date;
}

export interface StoredMessage {
  id: string;
  requestId: string;
  senderId: string;
  body: string;
  createdAt: Date;
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class MemoryStore implements Store {
  usersById = new Map<string, StoredUser>();
  usersByEmail = new Map<string, StoredUser>();
  refreshByHash = new Map<string, StoredRefresh>();
  requestsById = new Map<string, StoredRequest>();
  photosById = new Map<string, StoredPhoto>();

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    if (this.usersByEmail.has(input.email)) throw Object.assign(new Error("Email ya registrado"), { code: "EMAIL_TAKEN" });
    for (const u of this.usersById.values()) {
      if (u.username === input.username) throw Object.assign(new Error("Username ya registrado"), { code: "USERNAME_TAKEN" });
    }
    const user: StoredUser = { ...input, id: uid(), avatar: null, createdAt: new Date() };
    this.usersById.set(user.id, user);
    this.usersByEmail.set(user.email, user);
    return user;
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    return this.usersByEmail.get(email) ?? null;
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    return this.usersById.get(id) ?? null;
  }

  async createRefresh(userId: string, tokenHash: string, expiresAt: Date): Promise<StoredRefresh> {
    const row: StoredRefresh = {
      id: uid(),
      userId,
      tokenHash,
      expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    };
    this.refreshByHash.set(tokenHash, row);
    return row;
  }

  async findRefreshByHash(tokenHash: string): Promise<StoredRefresh | null> {
    return this.refreshByHash.get(tokenHash) ?? null;
  }

  async revokeRefresh(tokenHash: string): Promise<void> {
    const row = this.refreshByHash.get(tokenHash);
    if (row && !row.revokedAt) row.revokedAt = new Date();
  }

  clear(): void {
    this.usersById.clear();
    this.usersByEmail.clear();
    this.refreshByHash.clear();
    this.requestsById.clear();
    this.photosById.clear();
    this.ratingsByRequest.clear();
    this.applications = [];
    this.pushTokens.clear();
    this.messages = [];
  }

  async createRequest(input: CreateRequestInput): Promise<StoredRequest> {
    const now = new Date();
    const row: StoredRequest = { ...input, id: uid(), status: "OPEN", acceptedBy: null, createdAt: now, updatedAt: now };
    this.requestsById.set(row.id, row);
    return row;
  }

  async listRequestsByUser(userId: string, limit: number, offset: number): Promise<StoredRequest[]> {
    const mine = [...this.requestsById.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return mine.slice(offset, offset + limit);
  }

  async findRequestById(id: string, userId: string): Promise<StoredRequest | null> {
    const row = this.requestsById.get(id);
    if (!row || row.userId !== userId) return null;
    return row;
  }

  async cancelRequest(id: string, userId: string): Promise<StoredRequest | "NOT_OPEN" | null> {
    const row = this.requestsById.get(id);
    if (!row || row.userId !== userId) return null;
    if (row.status !== "OPEN") return "NOT_OPEN";
    row.status = "CANCELLED";
    row.updatedAt = new Date();
    return row;
  }

  async listOpenRequests(province: string | null, limit: number, offset: number): Promise<StoredRequest[]> {
    const open = [...this.requestsById.values()]
      .filter((r) => r.status === "OPEN" && (!province || r.province === province))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return open.slice(offset, offset + limit);
  }

  async listAssignedRequests(techId: string, limit: number, offset: number): Promise<StoredRequest[]> {
    const mine = [...this.requestsById.values()]
      .filter((r) => r.acceptedBy === techId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return mine.slice(offset, offset + limit);
  }

  async findTechRequest(id: string, techId: string, isAdmin: boolean): Promise<AssignedRequestView | null> {
    const row = this.requestsById.get(id);
    if (!row) return null;
    // Pool: abierta de otro técnico/cliente -> vista sin contacto
    if (row.status === "OPEN" && row.userId !== techId) return this.withClient(row);
    // Asignada: solo quien la aceptó o admin
    if (row.acceptedBy === techId || isAdmin) return this.withClient(row);
    return null;
  }

  private withClient(row: StoredRequest): AssignedRequestView {
    const client = this.usersById.get(row.userId);
    return {
      ...row,
      clientFirstName: client?.firstName ?? "",
      clientPhone: client?.phone ?? "",
    };
  }

  async acceptRequest(id: string, techId: string): Promise<StoredRequest | "OWN" | "NOT_OPEN" | null> {
    const row = this.requestsById.get(id);
    if (!row) return null;
    if (row.userId === techId) return "OWN";
    if (row.status !== "OPEN") return "NOT_OPEN";
    row.status = "ACCEPTED";
    row.acceptedBy = techId;
    row.updatedAt = new Date();
    return row;
  }

  async completeRequest(id: string, techId: string, isAdmin: boolean): Promise<StoredRequest | "NOT_ACCEPTED" | null> {
    const row = this.requestsById.get(id);
    if (!row) return null;
    if (row.acceptedBy !== techId && !isAdmin) return null;
    if (row.status !== "ACCEPTED") return "NOT_ACCEPTED";
    row.status = "DONE";
    row.updatedAt = new Date();
    return row;
  }

  async findRequestForAttachment(id: string, userId: string): Promise<StoredRequest | null> {
    const row = this.requestsById.get(id);
    if (!row) return null;
    if (row.status !== "OPEN" && row.status !== "ACCEPTED") return null;
    if (row.userId === userId || row.acceptedBy === userId) return row;
    return null;
  }

  async addRequestPhotos(requestId: string, keys: string[]): Promise<StoredPhoto[]> {
    const rows: StoredPhoto[] = keys.map((objectKey) => ({
      id: uid(),
      requestId,
      objectKey,
      createdAt: new Date(),
    }));
    for (const r of rows) this.photosById.set(r.id, r);
    return rows;
  }

  async listRequestPhotos(requestId: string): Promise<StoredPhoto[]> {
    return [...this.photosById.values()]
      .filter((p) => p.requestId === requestId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async countPhotosByRequest(ids: string[]): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const id of ids) counts[id] = 0;
    for (const p of this.photosById.values()) {
      if (p.requestId in counts) counts[p.requestId]! += 1;
    }
    return counts;
  }

  async firstPhotoByRequest(ids: string[]): Promise<Record<string, StoredPhoto>> {
    const firsts: Record<string, StoredPhoto> = {};
    const wanted = new Set(ids);
    const ordered = [...this.photosById.values()]
      .filter((p) => wanted.has(p.requestId))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const p of ordered) {
      if (!(p.requestId in firsts)) firsts[p.requestId] = p;
    }
    return firsts;
  }

  ratingsByRequest = new Map<string, StoredRating>();

  async createRating(
    clientId: string,
    requestId: string,
    score: number,
    comment: string | null,
  ): Promise<StoredRating | "NOT_DONE" | "DUPLICATE" | null> {
    const row = this.requestsById.get(requestId);
    if (!row || row.userId !== clientId) return null;
    if (row.status !== "DONE" || !row.acceptedBy) return "NOT_DONE";
    if (this.ratingsByRequest.has(requestId)) return "DUPLICATE";
    const rating: StoredRating = {
      id: uid(),
      requestId,
      techId: row.acceptedBy,
      clientId,
      score,
      comment,
      createdAt: new Date(),
    };
    this.ratingsByRequest.set(requestId, rating);
    return rating;
  }

  async findRatingByRequest(requestId: string): Promise<StoredRating | null> {
    return this.ratingsByRequest.get(requestId) ?? null;
  }

  async getTechRatingStats(techId: string): Promise<{ avg: number; count: number }> {
    const scores = [...this.ratingsByRequest.values()]
      .filter((r) => r.techId === techId)
      .map((r) => r.score);
    if (scores.length === 0) return { avg: 0, count: 0 };
    return { avg: scores.reduce((a, b) => a + b, 0) / scores.length, count: scores.length };
  }

  applications: StoredApplication[] = [];

  async applyToRequest(
    requestId: string,
    techId: string,
  ): Promise<StoredApplication | "OWN" | "NOT_OPEN" | "DUPLICATE" | null> {
    const row = this.requestsById.get(requestId);
    if (!row) return null;
    if (row.userId === techId) return "OWN";
    if (row.status !== "OPEN") return "NOT_OPEN";
    if (this.applications.some((a) => a.requestId === requestId && a.techId === techId)) {
      return "DUPLICATE";
    }
    const app: StoredApplication = { id: uid(), requestId, techId, createdAt: new Date() };
    this.applications.push(app);
    return app;
  }

  async hasApplied(requestId: string, techId: string): Promise<boolean> {
    return this.applications.some((a) => a.requestId === requestId && a.techId === techId);
  }

  async listApplications(requestId: string): Promise<StoredApplication[]> {
    return this.applications
      .filter((a) => a.requestId === requestId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async countApplicationsByRequest(ids: string[]): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const id of ids) counts[id] = 0;
    for (const a of this.applications) {
      if (a.requestId in counts) counts[a.requestId]! += 1;
    }
    return counts;
  }

  async chooseApplication(
    requestId: string,
    clientId: string,
    techId: string,
  ): Promise<StoredRequest | "NOT_OPEN" | "NO_APPLICATION" | null> {
    const row = this.requestsById.get(requestId);
    if (!row || row.userId !== clientId) return null;
    if (row.status !== "OPEN") return "NOT_OPEN";
    if (!this.applications.some((a) => a.requestId === requestId && a.techId === techId)) {
      return "NO_APPLICATION";
    }
    row.status = "ACCEPTED";
    row.acceptedBy = techId;
    row.updatedAt = new Date();
    return row;
  }

  async getApplicantProfiles(techIds: string[]): Promise<Array<{ id: string; firstName: string; username: string }>> {
    const out: Array<{ id: string; firstName: string; username: string }> = [];
    for (const id of techIds) {
      const u = this.usersById.get(id);
      if (u) out.push({ id: u.id, firstName: u.firstName, username: u.username });
    }
    return out;
  }

  async getTechsRatingStats(techIds: string[]): Promise<Record<string, { avg: number; count: number }>> {
    const stats: Record<string, { avg: number; count: number }> = {};
    for (const id of techIds) stats[id] = await this.getTechRatingStats(id);
    return stats;
  }

  pushTokens = new Map<string, string>();

  async setPushToken(userId: string, token: string): Promise<void> {
    this.pushTokens.set(userId, token);
  }

  async deletePushToken(userId: string): Promise<void> {
    this.pushTokens.delete(userId);
  }

  async getPushToken(userId: string): Promise<string | null> {
    return this.pushTokens.get(userId) ?? null;
  }

  async findRequestParties(requestId: string): Promise<{ userId: string; acceptedBy: string | null; status: string } | null> {
    const row = this.requestsById.get(requestId);
    if (!row) return null;
    return { userId: row.userId, acceptedBy: row.acceptedBy, status: row.status };
  }

  messages: StoredMessage[] = [];

  async listMessages(requestId: string, limit: number, offset: number): Promise<StoredMessage[]> {
    return this.messages
      .filter((m) => m.requestId === requestId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(offset, offset + limit);
  }

  async createMessage(requestId: string, senderId: string, body: string): Promise<StoredMessage> {
    const msg: StoredMessage = { id: uid(), requestId, senderId, body, createdAt: new Date() };
    this.messages.push(msg);
    return msg;
  }
}
