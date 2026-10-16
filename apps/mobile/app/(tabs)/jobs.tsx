import { EmptyState, ErrorBanner } from "@/components/Feedback";
import { es } from "@/i18n/es";
import { statusMeta } from "@/lib/request-ui";
import { serverMessage } from "@/services/auth-service";
import { listPoolRequests } from "@/services/requests-service";
import { useAuthStore } from "@/store/auth.store";
import { colors, radius, shadow } from "@/theme/tokens";
import type { PoolRequest } from "@reformapp/shared";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function Jobs() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isTech = user?.role === "TECH" || user?.role === "ADMIN";
  const [zoneOnly, setZoneOnly] = useState(true);
  const [jobs, setJobs] = useState<PoolRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const province = zoneOnly ? (user?.province ?? undefined) : undefined;
      const { requests } = await listPoolRequests(province);
      setJobs(requests);
    } catch (e: unknown) {
      setError(serverMessage(e, es.request.loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [zoneOnly, user?.province]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const insets = useSafeAreaInsets();

  if (!isTech) return <Redirect href="/(tabs)" />;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} translucent={false} />
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.kicker}>{es.app.name}</Text>
        <Text style={styles.greeting} accessibilityRole="header">
          {es.tech.pool}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.filters} accessibilityRole="radiogroup" accessibilityLabel="Zona">
          <Pressable
            onPress={() => setZoneOnly(true)}
            accessibilityRole="radio"
            accessibilityState={{ checked: zoneOnly }}
            style={[styles.chip, zoneOnly && styles.chipOn]}
          >
            <Text style={[styles.chipText, zoneOnly && styles.chipTextOn]}>
              {es.tech.myZone} ({user?.province})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setZoneOnly(false)}
            accessibilityRole="radio"
            accessibilityState={{ checked: !zoneOnly }}
            style={[styles.chip, !zoneOnly && styles.chipOn]}
          >
            <Text style={[styles.chipText, !zoneOnly && styles.chipTextOn]}>{es.tech.all}</Text>
          </Pressable>
        </View>
        {loading ? (
          <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={es.home.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <ErrorBanner
              message={error}
              retryLabel={es.request.retry}
              onRetry={() => { setLoading(true); void load(); }}
            />
          </View>
        ) : (
          <FlatList
            data={jobs}
            keyExtractor={(r) => r.id}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState title={es.tech.pool} body={es.tech.emptyPool} />
            }
            renderItem={({ item }) => {
              const meta = statusMeta(item.status);
              return (
                <Pressable
                  onPress={() => router.push({ pathname: "/jobs/[id]", params: { id: item.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${es.categories[item.category]} en ${item.locality}`}
                  style={styles.card}
                >
                  <View style={styles.coverWrap}>
                    {item.coverUrl ? (
                      <Image source={{ uri: item.coverUrl }} style={styles.cover} accessibilityIgnoresInvertColors />
                    ) : (
                      <View style={styles.coverEmpty}>
                        <Text style={styles.coverLetter}>
                          {es.categories[item.category].charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.status, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusText, { color: meta.fg }]}>{meta.label}</Text>
                    </View>
                    {item.applicationCount > 0 ? (
                      <View style={styles.candsBadge}>
                        <Text style={styles.candsBadgeText}>
                          {item.applicationCount} {item.applicationCount === 1 ? es.tech.applicant : es.tech.applicants}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.cardTitle}>{es.categories[item.category]}</Text>
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {item.locality} ({item.province})
                      {item.availability ? ` · ${item.availability}` : ""}
                    </Text>
                    {item.photoCount > 0 ? (
                      <Text style={styles.cands}>
                        {item.photoCount} {item.photoCount === 1 ? "foto" : "fotos"}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primary },
  hero: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingBottom: 24 },
  kicker: { fontSize: 13, color: "#BCD0E4" },
  greeting: { fontSize: 24, fontWeight: "700", color: colors.white },
  body: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 12 },
  filters: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.text },
  chipTextOn: { color: colors.white },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  error: { fontSize: 14, color: colors.error, textAlign: "center" },
  list: { flexGrow: 1, gap: 12, paddingBottom: 24 },
  empty: { gap: 12, paddingVertical: 24 },
  muted: { fontSize: 14, color: colors.muted },
  card: { backgroundColor: colors.card, borderRadius: radius.md, overflow: "hidden", ...shadow.card },
  coverWrap: { position: "relative", height: 150, backgroundColor: colors.primarySoft },
  cover: { width: "100%", height: "100%" },
  coverEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverLetter: { fontSize: 56, fontWeight: "700", color: colors.primary, opacity: 0.35 },
  status: {
    position: "absolute",
    top: 10,
    left: 10,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 12, fontWeight: "700" },
  candsBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(15,43,72,0.75)",
  },
  candsBadgeText: { fontSize: 12, fontWeight: "700", color: colors.white },
  info: { padding: 16, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardDesc: { fontSize: 14, color: colors.text },
  cardMeta: { fontSize: 12, color: colors.muted },
  cands: { fontSize: 12, fontWeight: "700", color: colors.primary },
});
