/** Las 52 provincias/ciudades autónomas (INE). Fuente de sugerencias del autocompletado. */
export const PROVINCES = [
  "A Coruña",
  "Álava",
  "Albacete",
  "Alicante",
  "Almería",
  "Asturias",
  "Ávila",
  "Badajoz",
  "Barcelona",
  "Burgos",
  "Cáceres",
  "Cádiz",
  "Cantabria",
  "Castellón",
  "Ceuta",
  "Ciudad Real",
  "Córdoba",
  "Cuenca",
  "Girona",
  "Granada",
  "Guadalajara",
  "Guipúzcoa",
  "Huelva",
  "Huesca",
  "Illes Balears",
  "Jaén",
  "La Rioja",
  "Las Palmas",
  "León",
  "Lleida",
  "Lugo",
  "Madrid",
  "Málaga",
  "Melilla",
  "Murcia",
  "Navarra",
  "Ourense",
  "Palencia",
  "Pontevedra",
  "Salamanca",
  "Santa Cruz de Tenerife",
  "Segovia",
  "Sevilla",
  "Soria",
  "Tarragona",
  "Teruel",
  "Toledo",
  "Valencia",
  "Valladolid",
  "Vizcaya",
  "Zamora",
  "Zaragoza",
] as const;

/** Normaliza para comparar (minúsculas, sin tildes ni espacios extra). */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Sugiere provincias que contienen lo escrito (máx. 6,exactas primero). */
export function suggestProvinces(query: string, limit = 6): string[] {
  const q = norm(query);
  if (!q) return [...PROVINCES].slice(0, limit);
  const starts = PROVINCES.filter((p) => norm(p).startsWith(q));
  const contains = PROVINCES.filter((p) => !norm(p).startsWith(q) && norm(p).includes(q));
  return [...starts, ...contains].slice(0, limit);
}
