import type { User } from "@reformapp/shared";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { getMe, logoutRemote } from "@/services/auth-service";
import { unregisterPushToken } from "@/services/push-service";

type AuthState = {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  /**
   * Sesión iniciada: guarda ambos tokens, hidrata con GET /users/me
   * y marca isAuthenticated. Si /me falla, limpia y propaga el error.
   */
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  /** Hidrata la sesión al arrancar: token guardado -> GET /users/me. */
  restore: () => Promise<void>;
  /** Relee /users/me con la sesión actual. */
  refreshProfile: () => Promise<void>;
  /** Revoca el refresh (best-effort) y borra ambos tokens. */
  logout: () => Promise<void>;
};

async function clearTokens(): Promise<void> {
  // Borrado por clave con try/catch propio: en algunos dispositivos
  // deleteItemAsync rechaza si la clave ya no existe y no debe romper el flujo.
  try {
    await SecureStore.deleteItemAsync("accessToken");
  } catch {
    /* ya ausente: nada que borrar */
  }
  try {
    await SecureStore.deleteItemAsync("refreshToken");
  } catch {
    /* ya ausente: nada que borrar */
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  isLoading: true,

  setUser: (user) => set({ user }),

  login: async (accessToken, refreshToken) => {
    await SecureStore.setItemAsync("accessToken", accessToken);
    await SecureStore.setItemAsync("refreshToken", refreshToken);
    try {
      const { user } = await getMe();
      set({ user, isAuthenticated: true });
    } catch {
      await clearTokens();
      set({ user: null, isAuthenticated: false });
      throw new Error("No se pudo cargar el perfil tras iniciar sesión");
    }
  },

  restore: async () => {
    set({ isLoading: true });
    try {
      const token = await SecureStore.getItemAsync("accessToken");
      if (!token) {
        set({ user: null, isAuthenticated: false });
        return;
      }
      const { user } = await getMe();
      set({ user, isAuthenticated: true });
    } catch {
      await clearTokens();
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshProfile: async () => {
    const { user } = await getMe();
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    // Local primero: el cierre nunca depende de la red. Si el backend
    // está dormido (Neon scale-to-zero) o SecureStore falla, la sesión
    // local se cierra igual y el guard te lleva a sign-in.
    let refreshToken: string | null = null;
    try {
      refreshToken = await SecureStore.getItemAsync("refreshToken");
    } catch {
      refreshToken = null;
    }
    // El token push se borra ANTES de limpiar la sesión (necesita
    // auth). Si falla, se sobrescribe al entrar el siguiente usuario.
    await unregisterPushToken();
    await clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false });
    // Revocación best-effort en segundo plano, con tope de 8s.
    try {
      if (refreshToken) {
        await Promise.race([
          logoutRemote(refreshToken),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("logout timeout")), 8000),
          ),
        ]);
      }
    } catch {
      // best-effort: el refresh sin revocar caduca solo en 30d y ya no
      // está en el dispositivo, así que no puede reutilizarse aquí
    }
  },
}));
