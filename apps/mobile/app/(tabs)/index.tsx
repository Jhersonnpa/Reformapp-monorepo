import { EmptyState, ErrorBanner } from "@/components/Feedback";
import { es } from "@/i18n/es";
import { statusMeta } from "@/lib/request-ui";
import { listAssignedRequests, listRequests } from "@/services/requests-service";
import { serverMessage } from "@/services/auth-service";
import { useAuthStore } from "@/store/auth.store";
import { colors, radius, shadow } from "@/theme/tokens";
import type { ServiceRequest } from "@reformapp/shared";
import { useFocusEffect, useRouter } from "expo-router";
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

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isTech = user?.role === "TECH" || user?.role === "ADMIN";
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { requests } = isTech ? await listAssignedRequests() : await listRequests(20, 0);
      setItems(requests);
    } catch (e: unknown) {
      setError(serverMessage(e, es.request.loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isTech]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const section = isTech ? es.tech.myJobs : es.request.myRequests;
  const empty = isTech ? es.tech.emptyJobs : es.request.empty;
  const detailPath = isTech ? "/jobs/[id]" : "/request/[id]";
  // El hero azul sangra hasta el borde superior: el inset se pinta
  // a mano para que la hora (blanca) siempre pise azul.
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} translucent={false} />
      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.kicker}>{es.app.name}</Text>
        <Text style={styles.greeting} accessibilityRole="header">
          {es.home.greeting}, {user?.firstName ?? ""}
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.section}>{section}</Text>
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
            data={items}
            keyExtractor={(r) => r.id}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <EmptyState
                title={section}
                body={empty}
                actionLabel={!isTech ? es.request.emptyCta : es.tech.viewJobs}
                onAction={() => router.push(!isTech ? "/(tabs)/request" : "/(tabs)/jobs")}
              />
            }
            renderItem={({ item }) => {
              const meta = statusMeta(item.status);
              return (
                <Pressable
                  onPress={() => router.push({ pathname: detailPath, params: { id: item.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={`${es.categories[item.category]}: ${meta.label}`}
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
                    <View style={[styles.chip, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.chipText, { color: meta.fg }]}>{meta.label}</Text>
                    </View>
                    {item.photoCount > 0 ? (
                      <View style={styles.photoBadge}>
                        <Text style={styles.photoBadgeText}>
                          {item.photoCount} {item.photoCount === 1 ? "foto" : "fotos"}
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
                      {item.locality} · {new Date(item.createdAt).toLocaleDateString("es-ES")}
                    </Text>
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
  section: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 12 },
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
  chip: {
    position: "absolute",
    top: 10,
    left: 10,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  photoBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(15,43,72,0.75)",
  },
  photoBadgeText: { fontSize: 12, fontWeight: "700", color: colors.white },
  info: { padding: 16, gap: 4 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardDesc: { fontSize: 14, color: colors.text },
  cardMeta: { fontSize: 12, color: colors.muted },
});
