import { CustomButton } from "@/components/CustomButton";
import { StarsDisplay } from "@/components/Stars";
import { es } from "@/i18n/es";
import { getMyRatingStats } from "@/services/requests-service";
import { useAuthStore } from "@/store/auth.store";
import { toUiRole } from "@reformapp/shared";
import { colors, radius } from "@/theme/tokens";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Profile() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const logout = useAuthStore((s) => s.logout);
  const [signingOut, setSigningOut] = useState(false);
  const [stats, setStats] = useState<{ avg: number; count: number } | null>(null);
  const isTech = user?.role === "TECH" || user?.role === "ADMIN";

  useEffect(() => {
    if (isTech) {
      getMyRatingStats()
        .then(({ stats: s }) => setStats(s))
        .catch(() => setStats(null));
    }
  }, [isTech]);

  const onLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
      router.replace("/(auth)/sign-in");
    }
  };

  if (isLoading || !user) {
    return (
      <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={es.home.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const rows: Array<[string, string]> = [
    ["Correo", user.email],
    ["Usuario", user.username],
    ["Teléfono", user.phone],
    ["Provincia", user.province],
    ["Localidad", user.locality],
    ["Dirección", user.address],
    ["Rol", toUiRole(user.role)],
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.firstName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.idBlock}>
              <Text style={styles.name}>
                {user.firstName} {user.lastName}
              </Text>
              <Text style={styles.email}>{user.email}</Text>
            </View>
          </View>
        </View>
        <View style={styles.card}>
          {rows.map(([label, value], i) => (
            <View key={label} style={[styles.kv, i < rows.length - 1 && styles.divider]}>
              <Text style={styles.k}>{label}</Text>
              <Text style={styles.v}>{value}</Text>
            </View>
          ))}
        </View>
        {isTech ? (
          <View style={styles.card}>
            <Text style={styles.ratingTitle}>{es.ratings.techTitle}</Text>
            {stats && stats.count > 0 ? (
              <StarsDisplay
                value={stats.avg}
                text={`${stats.avg.toLocaleString("es-ES")} · ${stats.count} ${stats.count === 1 ? es.ratings.review : es.ratings.reviews}`}
              />
            ) : (
              <Text style={styles.muted}>{es.ratings.noRatings}</Text>
            )}
          </View>
        ) : null}
        <View style={styles.actions}>
          <CustomButton title={es.home.signOut} variant="danger" isLoading={signingOut} onPress={() => void onLogout()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flexGrow: 1, padding: 20, gap: 16 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontSize: 24, fontWeight: "700" },
  idBlock: { gap: 2, flex: 1 },
  name: { fontSize: 18, fontWeight: "700", color: colors.text },
  email: { fontSize: 14, color: colors.muted },
  kv: { paddingVertical: 8, gap: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  k: { fontSize: 12, color: colors.muted },
  v: { fontSize: 16, color: colors.text },
  ratingTitle: { fontSize: 16, fontWeight: "700", color: colors.primary },
  muted: { fontSize: 14, color: colors.muted },
  actions: { gap: 12, marginTop: "auto", paddingBottom: 8 },
});
