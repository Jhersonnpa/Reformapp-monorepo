/** @reformapp/shared — tipos + schemas compartidos mobile/api/web */
import { z } from "zod";

export const Role = {
  CLIENT: "CLIENT",
  TECH: "TECH",
  ADMIN: "ADMIN",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** Rol normalizado para UI (minúsculas). */
export type UiRole = "client" | "tech" | "admin";

export function toUiRole(role: Role): UiRole {
  switch (role) {
    case Role.CLIENT:
      return "client";
    case Role.TECH:
      return "tech";
    case Role.ADMIN:
      return "admin";
  }
}

export function toDbRole(role: UiRole): Role {
  switch (role) {
    case "client":
      return Role.CLIENT;
    case "tech":
      return Role.TECH;
    case "admin":
      return Role.ADMIN;
  }
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "El email es obligatorio")
  .email("Email no válido")
  .max(254, "Email demasiado largo");

const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(128, "Máximo 128 caracteres")
  .regex(/[a-z]/, "Debe incluir una minúscula")
  .regex(/[A-Z]/, "Debe incluir una mayúscula")
  .regex(/[0-9]/, "Debe incluir un número")
  .regex(/[^a-zA-Z0-9]/, "Debe incluir un símbolo");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "La contraseña es obligatoria").max(128),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(30, "Máximo 30 caracteres")
    .regex(/^[a-zA-Z0-9_.]+$/, "Solo letras, números, _ y ."),
  firstName: z.string().trim().min(1, "El nombre es obligatorio").max(50),
  lastName: z.string().trim().min(1, "Los apellidos son obligatorios").max(80),
  phone: z
    .string()
    .trim()
    .min(6, "Teléfono no válido")
    .max(20, "Teléfono no válido")
    .regex(/^[+0-9][0-9\s.-]*$/, "Teléfono no válido"),
  province: z.string().trim().min(1, "La provincia es obligatoria").max(80),
  locality: z.string().trim().min(1, "La localidad es obligatoria").max(80),
  address: z.string().trim().min(1, "La dirección es obligatoria").max(160),
  // NOTA: role NUNCA se acepta del cliente. El servidor fuerza CLIENT.
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  province: string;
  locality: string;
  address: string;
  role: Role;
  avatar?: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/* ---------- Solicitudes de reforma (Fase 3) ---------- */

export const RequestCategory = {
  PLUMBING: "PLUMBING",
  ELECTRICAL: "ELECTRICAL",
  CLIMATE: "CLIMATE",
  MASONRY: "MASONRY",
  PAINTING: "PAINTING",
  CARPENTRY: "CARPENTRY",
  OTHER: "OTHER",
} as const;
export type RequestCategory =
  (typeof RequestCategory)[keyof typeof RequestCategory];

export const RequestStatus = {
  OPEN: "OPEN",
  ACCEPTED: "ACCEPTED",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
} as const;
export type RequestStatus = (typeof RequestStatus)[keyof typeof RequestStatus];

export const requestCreateSchema = z.object({
  category: z.nativeEnum(RequestCategory, {
    errorMap: () => ({ message: "Elige una categoría" }),
  }),
  description: z
    .string()
    .trim()
    .min(10, "Cuéntanos un poco más (mínimo 10 caracteres)")
    .max(2000, "Máximo 2000 caracteres"),
  province: z.string().trim().min(1, "La provincia es obligatoria").max(80),
  locality: z.string().trim().min(1, "La localidad es obligatoria").max(80),
  address: z.string().trim().min(1, "La dirección es obligatoria").max(160),
  availability: z
    .string()
    .trim()
    .max(160, "Máximo 160 caracteres")
    .optional()
    .transform((s) => (s ? s : null)),
});
export type RequestCreateInput = z.infer<typeof requestCreateSchema>;

export interface ServiceRequest {
  id: string;
  userId: string;
  category: RequestCategory;
  description: string;
  province: string;
  locality: string;
  address: string;
  availability: string | null;
  status: RequestStatus;
  acceptedBy: string | null;
  /** Solo en detalle (lista trae photoCount para no engordar). */
  photos?: RequestPhoto[];
  photoCount: number;
  /**
   * Primera foto (URL presignada ~1h). Solo en listas; el detalle
   * usa `photos`. Null si no hay fotos o R2 no configurado.
   */
  coverUrl?: string | null;
  /** Nº de técnicos postulados (listas y detalle). */
  applicationCount: number;
  /** Solo en detalle (null si aún no se valoró). */
  rating?: Rating | null;
  /** Solo en detalle del dueño cuando hay técnico asignado. */
  technician?: { firstName: string; phone: string } | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Vista de pool para técnicos: sin dirección exacta ni userId.
 * La dirección y el contacto solo se revelan al aceptar.
 */
export interface PoolRequest {
  id: string;
  category: RequestCategory;
  description: string;
  province: string;
  locality: string;
  availability: string | null;
  status: RequestStatus;
  photoCount: number;
  /**
   * Primera foto (URL presignada ~1h). Null si no hay fotos o R2 no configurado.
   */
  coverUrl?: string | null;
  /** Nº de técnicos ya postulados (sin revelar quiénes). */
  applicationCount: number;
  createdAt: string;
}

/** Foto con URL presignada GET lista para mostrar (caduca en ~1h). */
export interface RequestPhoto {
  id: string;
  key: string;
  url: string;
  createdAt: string;
}

/** Vista de trabajo asignado: completa + contacto del cliente. */
export interface AssignedRequest extends ServiceRequest {
  photos: RequestPhoto[];
  client: {
    firstName: string;
    phone: string;
  };
}

/** Límite de fotos por solicitud (coste R2 + egress). */
export const MAX_REQUEST_PHOTOS = 10;
/** Tipos aceptados (el cliente comprime a WebP/JPEG antes de subir). */
export const PHOTO_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

/* ---------- Valoraciones (cliente -> técnico, al terminar) ---------- */

export const ratingCreateSchema = z.object({
  score: z.number().int().min(1, "Mínimo 1 estrella").max(5, "Máximo 5 estrellas"),
  comment: z
    .string()
    .trim()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .transform((s) => (s ? s : null)),
});
export type RatingCreateInput = z.infer<typeof ratingCreateSchema>;

export interface Rating {
  id: string;
  requestId: string;
  techId: string;
  clientId: string;
  score: number;
  comment: string | null;
  createdAt: string;
}

export interface TechRatingStats {
  avg: number;
  count: number;
}

/* ---------- Postulaciones (técnico se postula, cliente elige) ---------- */

/** Una postulación de un técnico a una solicitud OPEN. */
export interface Application {
  id: string;
  requestId: string;
  techId: string;
  createdAt: string;
}

/**
 * Candidato visible para el cliente dueño: nombre + valoración.
 * Sin teléfono/email/dirección hasta que el cliente lo elige.
 */
export interface Applicant extends TechRatingStats {
  techId: string;
  firstName: string;
  username: string;
  appliedAt: string;
}

export const chooseTechSchema = z.object({
  // Sin formato uuid: el MemoryStore (tests/dev offline) usa ids opacos
  // no-uuid; lo inexistente se responde 404 en el store igualmente.
  techId: z.string().trim().min(1, "Técnico no válido").max(64),
});
export type ChooseTechInput = z.infer<typeof chooseTechSchema>;

/* ---------- Push (tokens Expo, coste cero vía Expo Push API) ---------- */

export const pushTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(10, "Token no válido")
    .max(256, "Token no válido")
    .regex(/^ExponentPushToken\[[^\]]+\]$/, "Token no válido"),
});
export type PushTokenInput = z.infer<typeof pushTokenSchema>;

/* ---------- Chat del trabajo (solo aceptado; texto, sin polling) ---------- */

export const messageCreateSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Escribe un mensaje")
    .max(1000, "Máximo 1000 caracteres"),
});
export type MessageCreateInput = z.infer<typeof messageCreateSchema>;

export interface ChatMessage {
  id: string;
  requestId: string;
  senderId: string;
  /** true si lo envió quien lo está leyendo. */
  mine: boolean;
  body: string;
  createdAt: string;
}
