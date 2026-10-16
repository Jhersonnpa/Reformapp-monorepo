import type { Context, Next } from "hono";

const hits = new Map<string, number[]>();

export function rateLimit(maxPerMinute: number) {
  return async function rateLimitMiddleware(c: Context, next: Next): Promise<Response | void> {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("cf-connecting-ip") ||
      "unknown";
    // Cubo por ruta+IP: el tráfico de refresh/logout no consume el
    // presupuesto anti-fuerza-bruta de signIn/signUp.
    const key = `${c.req.path}|${ip}`;
    const now = Date.now();
    const windowStart = now - 60_000;
    const list = (hits.get(key) ?? []).filter((t) => t > windowStart);
    if (list.length >= maxPerMinute) {
      return c.json({ message: "Demasiadas peticiones. Inténtalo en un minuto." }, 429);
    }
    list.push(now);
    hits.set(key, list);
    await next();
  };
}

/** Solo tests: limpia el contador en memoria. */
export function __resetRateLimit(): void {
  hits.clear();
}
