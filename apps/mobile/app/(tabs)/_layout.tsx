import { es } from "@/i18n/es";
import { useAuthStore } from "@/store/auth.store";
import { colors } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName, outlineName: IconName) {
  return ({ color, size, focused }: { color: unknown; size: number; focused: boolean }) => (
    <Ionicons name={focused ? name : outlineName} size={size} color={String(color)} />
  );
}

export default function TabsLayout() {
  const role = useAuthStore((s) => s.user?.role);
  const isTech = role === "TECH" || role === "ADMIN";
  // El inset inferior aparta la barra de los botones/gestos de Android.
  const bottom = useSafeAreaInsets().bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#8A97A6",
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: "#E5EAF0",
          height: 60 + bottom,
          paddingTop: 8,
          paddingBottom: bottom,
          // Sombra superior sutil (flota sobre el contenido)
          shadowColor: "#0F2B48",
          shadowOpacity: 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarIconStyle: { marginBottom: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: es.tabs.home, tabBarIcon: tabIcon("home", "home-outline") }}
      />
      {/* Solo cliente: pedir reformas. Solo técnico: pool de trabajos. */}
      <Tabs.Screen
        name="request"
        options={{
          title: es.tabs.request,
          href: isTech ? null : "/(tabs)/request",
          tabBarIcon: tabIcon("add-circle", "add-circle-outline"),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: es.tabs.jobs,
          href: isTech ? "/(tabs)/jobs" : null,
          tabBarIcon: tabIcon("briefcase", "briefcase-outline"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: es.tabs.profile, tabBarIcon: tabIcon("person", "person-outline") }}
      />
    </Tabs>
  );
}
