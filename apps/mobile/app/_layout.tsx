import { ToastProvider, useToast } from "@/components/Toast";
import { isPushSupported, registerPushToken, subscribePushEvents } from "@/services/push-service";
import { colors } from "@/theme/tokens";
import { useAuthStore } from "@/store/auth.store";
import { Redirect, SplashScreen, Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

void SplashScreen.preventAutoHideAsync().catch(() => {});

function AuthGuard() {
  const segments = useSegments();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const inAuth = segments[0] === "(auth)";

  if (!isAuthenticated && !inAuth) {
    return <Redirect href="/(auth)/sign-in" />;
  }
  if (isAuthenticated && inAuth) {
    return <Redirect href="/(tabs)" />;
  }
  return null;
}

export default function RootLayout() {
  const restore = useAuthStore((s) => s.restore);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    restore().finally(() => setRestored(true));
  }, [restore]);

  useEffect(() => {
    if (restored) SplashScreen.hideAsync().catch(() => {});
  }, [restored]);

  if (!restored) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ToastProvider>
        {/* Base: hora oscura sobre fondo claro opaco. Las pantallas con
            cabecera oscura (hero) la sobrescriben con light-content. */}
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} translucent={false} />
        <AuthGuard />
        <PushBootstrap />
        <Stack screenOptions={{ headerShown: false }} />
      </ToastProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Registro del token + navegación al tocar la notificación.
 * Solo con sesión: el token identifica al usuario, no al aparato.
 */
function PushBootstrap() {
  const router = useRouter();
  const { notify } = useToast();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || !isPushSupported()) return;
    let cleanup: (() => void) | null = null;
    let alive = true;
    void (async () => {
      await registerPushToken();
      if (!alive) return;
      cleanup = await subscribePushEvents({
        onForeground: (title, body) => notify(body ? `${title}: ${body}` : title, "info"),
        onTap: (requestId) => {
          if (!requestId) return;
          const role = useAuthStore.getState().user?.role;
          router.push(
            role === "TECH" || role === "ADMIN"
              ? { pathname: "/jobs/[id]", params: { id: requestId } }
              : { pathname: "/request/[id]", params: { id: requestId } },
          );
        },
      });
    })();
    return () => {
      alive = false;
      cleanup?.();
    };
  }, [isAuthenticated, notify, router]);

  return null;
}
