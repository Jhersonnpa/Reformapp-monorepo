/**
 * Envío best-effort vía Expo Push API (gratis, sin dependencias).
 * Nunca bloquea ni rompe la petición: cualquier fallo se ignora.
 * Se desactiva con PUSH_ENABLED=0 (tests).
 */
export async function sendPush(
  token: string | null,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (!token || process.env["PUSH_ENABLED"] === "0") return;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      await fetch("https://exp.push.expo.dev/v1/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: token, title, body, data, sound: "default" }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // best-effort: sin push no hay error visible
  }
}

/** Notifica al usuario si tiene token registrado (una consulta). */
export async function notifyUser(
  getToken: (userId: string) => Promise<string | null>,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  try {
    await sendPush(await getToken(userId), title, body, data);
  } catch {
    // best-effort
  }
}
