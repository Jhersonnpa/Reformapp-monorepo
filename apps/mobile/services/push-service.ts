import api from "./api";
import Constants from "expo-constants";

/**
 * El push remoto no existe en Expo Go (SDK 53+): solo development build.
 * Aquí devolvemos false para no pedir permisos ni importar el módulo
 * (así tampoco sale el warning amarillo).
 */
export function isPushSupported(): boolean {
  // Doble señal: en Expo Go no hay push remoto (SDK 53+).
  return Constants.appOwnership !== "expo" && Constants.executionEnvironment !== "storeClient";
}

/** Carga perezosa: si el Expo Go es antiguo y no trae el módulo nativo, la app sigue sin push. */
async function loadNotifications(): Promise<typeof import("expo-notifications") | null> {
  try {
    return await import("expo-notifications");
  } catch {
    return null;
  }
}

async function loadDevice(): Promise<typeof import("expo-device") | null> {
  try {
    return await import("expo-device");
  } catch {
    return null;
  }
}

/**
 * Registra el token push en el backend (solo dispositivo físico).
 * Silencioso: sin permiso, en emulador o sin módulo nativo no hace nada.
 */
export async function registerPushToken(): Promise<void> {
  try {
    if (!isPushSupported()) return;
    const [Device, Notifications] = await Promise.all([loadDevice(), loadNotifications()]);
    if (!Device || !Notifications || !Device.isDevice) return;
    await Notifications.setNotificationChannelAsync("reformas", {
      name: "Reformas",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => undefined);
    const { status: current } = await Notifications.getPermissionsAsync();
    const status =
      current === "granted" ? current : (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    if (!token) return;
    await api.post("/users/me/push-token", { token });
  } catch {
    // best-effort: la app funciona sin push
  }
}

/** Borra el token al cerrar sesión (no avisar al siguiente usuario). */
export async function unregisterPushToken(): Promise<void> {
  try {
    await api.delete("/users/me/push-token");
  } catch {
    // best-effort
  }
}

export type PushPayload = { requestId?: string };

/**
 * Suscribe eventos push. Resuelve null si no hay módulo nativo.
 * En primer plano mostramos nuestro toast (no el banner del sistema).
 */
export async function subscribePushEvents(callbacks: {
  onForeground: (title: string, body: string) => void;
  onTap: (requestId?: string) => void;
}): Promise<(() => void) | null> {
  // El guard VA ANTES del import: en Expo Go evaluar el módulo
  // lanza Uncaught Error (fuera del try/catch del import dinámico).
  if (!isPushSupported()) return null;
  const Notifications = await loadNotifications();
  if (!Notifications) return null;
  try {
    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      }),
    });
    const readId = (data: unknown): string | undefined =>
      typeof (data as Record<string, unknown> | null)?.["requestId"] === "string"
        ? ((data as Record<string, string>)["requestId"] as string)
        : undefined;
    // App cerrada: la notificación que la abrió.
    const last = await Notifications.getLastNotificationResponseAsync().catch(() => null);
    if (last) callbacks.onTap(readId(last.notification.request.content.data));
    const fg = Notifications.addNotificationReceivedListener((n) => {
      const title = n.request.content.title ?? "Reformapp";
      const body = n.request.content.body ?? "";
      callbacks.onForeground(title, body);
    });
    const tap = Notifications.addNotificationResponseReceivedListener((res) => {
      callbacks.onTap(readId(res.notification.request.content.data));
    });
    return () => {
      fg.remove();
      tap.remove();
    };
  } catch {
    return null;
  }
}
