import { es } from "@/i18n/es";
import type { RequestStatus } from "@reformapp/shared";

/** Etiqueta y colores del chip de estado (reutilizable en listas y detalle). */
export function statusMeta(status: RequestStatus): { label: string; bg: string; fg: string } {
  switch (status) {
    case "OPEN":
      return { label: es.request.open, bg: "#E6F4EA", fg: "#15803D" };
    case "ACCEPTED":
      return { label: es.tech.accepted, bg: "#E3F0FF", fg: "#1D4ED8" };
    case "DONE":
      return { label: es.tech.done, bg: "#EDE9FE", fg: "#6D28D9" };
    case "CANCELLED":
      return { label: es.request.cancelled, bg: "#F3F4F6", fg: "#4B5563" };
  }
}
