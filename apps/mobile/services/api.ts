import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

/**
 * Única fuente de la URL del backend. Cero hardcodes: sale de
 * EXPO_PUBLIC_API_URL (ver .env.example). Falla en arranque si falta.
 */
const baseURL = process.env.EXPO_PUBLIC_API_URL;
if (!baseURL) {
  throw new Error(
    "Falta EXPO_PUBLIC_API_URL. Copia apps/mobile/.env.example a apps/mobile/.env con la URL del API.",
  );
}

const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: { "Content-Type": "application/json", "X-Client-Type": "mobile" },
});

api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync("accessToken");
    if (token) config.headers["Authorization"] = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

type RetryConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/** Cola single-flight: un solo refresh en vuelo, el resto espera el resultado. */
let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const refreshToken = await SecureStore.getItemAsync("refreshToken");
  if (!refreshToken) throw new Error("Sin refreshToken");
  const res = await axios.post<{ accessToken: string; refreshToken: string }>(
    `${baseURL}/auth/refresh`,
    { refreshToken },
    { timeout: 10000 },
  );
  await SecureStore.setItemAsync("accessToken", res.data.accessToken);
  await SecureStore.setItemAsync("refreshToken", res.data.refreshToken);
  return res.data.accessToken;
}

async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync("accessToken");
  await SecureStore.deleteItemAsync("refreshToken");
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const status = error.response?.status;
    // Solo un reintento, solo 401, nunca en los propios endpoints de auth
    // (evita bucles: signIn/refresh/logout fallidos no se reintentan).
    const url = config?.url ?? "";
    const isAuthCall =
      url.includes("/auth/signIn") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/logout");
    if (!config || status !== 401 || config._retried || isAuthCall) {
      throw error;
    }
    config._retried = true;
    try {
      if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      const accessToken = await refreshPromise;
      config.headers["Authorization"] = `Bearer ${accessToken}`;
      return api(config);
    } catch {
      await clearSession();
      throw error;
    }
  },
);

export default api;
