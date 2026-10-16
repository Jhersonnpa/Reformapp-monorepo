import type { Applicant, Application, AssignedRequest, ChatMessage, PoolRequest, Rating, RequestPhoto, ServiceRequest, TechRatingStats } from "@reformapp/shared";
import api from "./api";

export interface RequestList {
  requests: ServiceRequest[];
  hasMore: boolean;
}

export async function createRequest(input: {
  category: string;
  description: string;
  province: string;
  locality: string;
  address: string;
  availability: string | null;
}): Promise<{ request: ServiceRequest }> {
  const res = await api.post<{ request: ServiceRequest }>("/requests", input);
  return res.data;
}

export async function listRequests(limit = 20, offset = 0): Promise<RequestList> {
  const res = await api.get<RequestList>("/requests", { params: { limit, offset } });
  return res.data;
}

export async function getRequest(id: string): Promise<{ request: ServiceRequest }> {
  const res = await api.get<{ request: ServiceRequest }>(`/requests/${id}`);
  return res.data;
}

export async function cancelRequest(id: string): Promise<{ request: ServiceRequest }> {
  const res = await api.post<{ request: ServiceRequest }>(`/requests/${id}/cancel`);
  return res.data;
}

export async function listPoolRequests(province?: string): Promise<{ requests: PoolRequest[]; hasMore: boolean }> {
  const res = await api.get<{ requests: PoolRequest[]; hasMore: boolean }>("/requests/open", {
    params: province ? { province, limit: 20, offset: 0 } : { limit: 20, offset: 0 },
  });
  return res.data;
}

export async function listAssignedRequests(): Promise<RequestList> {
  const res = await api.get<RequestList>("/requests/assigned", { params: { limit: 20, offset: 0 } });
  return res.data;
}

export async function getPoolRequest(id: string): Promise<{ request: PoolRequest; applied: boolean }> {
  const res = await api.get<{ request: PoolRequest; applied: boolean }>(`/requests/open/${id}`);
  return res.data;
}

export async function getAssignedRequest(id: string): Promise<{ request: AssignedRequest }> {
  const res = await api.get<{ request: AssignedRequest }>(`/requests/assigned/${id}`);
  return res.data;
}

export async function applyToRequest(id: string): Promise<{ application: Application }> {
  const res = await api.post<{ application: Application }>(`/requests/${id}/apply`);
  return res.data;
}

/** Candidatos (dueño): nombre + valoración, sin contacto. */
export async function listApplications(id: string): Promise<{ applications: Applicant[] }> {
  const res = await api.get<{ applications: Applicant[] }>(`/requests/${id}/applications`);
  return res.data;
}

/** Estado del técnico: si ya se postuló y cuántos van (sin identidades). */
export async function getApplicationStatus(id: string): Promise<{ applied: boolean; applicationCount: number }> {
  const res = await api.get<{ applied: boolean; applicationCount: number }>(`/requests/${id}/applications`);
  return res.data;
}

export async function chooseTechnician(id: string, techId: string): Promise<{ request: ServiceRequest }> {
  const res = await api.post<{ request: ServiceRequest }>(`/requests/${id}/choose`, { techId });
  return res.data;
}

export async function listMessages(id: string): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const res = await api.get<{ messages: ChatMessage[]; hasMore: boolean }>(`/requests/${id}/messages`);
  return res.data;
}

export async function sendMessage(id: string, body: string): Promise<{ message: ChatMessage }> {
  const res = await api.post<{ message: ChatMessage }>(`/requests/${id}/messages`, { body });
  return res.data;
}

export async function completeRequest(id: string): Promise<{ request: ServiceRequest }> {
  const res = await api.post<{ request: ServiceRequest }>(`/requests/${id}/complete`);
  return res.data;
}

export async function createRating(
  id: string,
  input: { score: number; comment: string | null },
): Promise<{ rating: Rating }> {
  const res = await api.post<{ rating: Rating }>(`/requests/${id}/rating`, input);
  return res.data;
}

export async function getMyRatingStats(): Promise<{ stats: TechRatingStats }> {
  const res = await api.get<{ stats: TechRatingStats }>("/users/me/rating-stats");
  return res.data;
}

export interface PickedPhoto {
  uri: string;
  contentType: string;
}

const JPEG = "image/jpeg";
const MAX_EDGE = 1280;

/**
 * Optimiza antes de subir: reescala a máx 1280px (sin ampliar),
 * comprime y normaliza a JPEG. Esto además convierte HEIC (iPhone)
 * que Android no muestra, y recorta el gasto R2 ~80-90%.
 */
export async function preparePhoto(
  uri: string,
  srcWidth: number,
): Promise<PickedPhoto> {
  const { manipulateAsync, SaveFormat } = await import("expo-image-manipulator");
  const actions = srcWidth > MAX_EDGE ? [{ resize: { width: MAX_EDGE } }] : [];
  const out = await manipulateAsync(uri, actions, {
    compress: 0.7,
    format: SaveFormat.JPEG,
  });
  return { uri: out.uri, contentType: JPEG };
}

/**
 * Sube fotos a R2 con PUT presignado: presign -> PUT directo -> confirm.
 * Sin reintentos automáticos: si un PUT falla, aborta con error visible
 * (tope de coste: máx 10 objetos por solicitud, ver AGENTS.md).
 */
export async function uploadRequestPhotos(
  requestId: string,
  picked: PickedPhoto[],
  onProgress?: (done: number, total: number) => void,
): Promise<RequestPhoto[]> {
  const { File } = await import("expo-file-system");
  const total = picked.length;

  const presign = await api.post<{ uploads: Array<{ key: string; url: string }> }>(
    `/requests/${requestId}/photos/presign`,
    { contentType: JPEG, count: total },
  );
  const uploads = presign.data.uploads;

  const keys: string[] = [];
  for (let i = 0; i < total; i++) {
    // Upload nativo (stream del fichero): fetch+Blob truncaba el cuerpo a 14B.
    const res = await new File(picked[i]!.uri).upload(uploads[i]!.url, {
      httpMethod: "PUT",
      headers: { "Content-Type": JPEG },
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Subida fallida (${res.status})`);
    }
    keys.push(uploads[i]!.key);
    onProgress?.(i + 1, total);
  }

  const confirmed = await api.post<{ photos: RequestPhoto[] }>(`/requests/${requestId}/photos`, { keys });
  return confirmed.data.photos;
}
