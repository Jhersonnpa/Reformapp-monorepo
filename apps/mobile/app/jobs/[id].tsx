import { CustomButton } from "@/components/CustomButton";
import { ChatBox } from "@/components/ChatBox";
import { RequestPhotos } from "@/components/RequestPhotos";
import { StarsDisplay } from "@/components/Stars";
import { useToast } from "@/components/Toast";
import { es } from "@/i18n/es";
import { statusMeta } from "@/lib/request-ui";
import { serverMessage } from "@/services/auth-service";
import {
  applyToRequest,
  completeRequest,
  getApplicationStatus,
  getAssignedRequest,
  getPoolRequest,
} from "@/services/requests-service";
import { colors, radius } from "@/theme/tokens";
import type { AssignedRequest, PoolRequest, RequestPhoto } from "@reformapp/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type JobView = { kind: "pool"; request: PoolRequest; applied: boolean } | { kind: "assigned"; request: AssignedRequest };

export default function JobDetail() {
  const router = useRouter();
  const { notify } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [view, setView] = useState<JobView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"apply" | "complete" | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Asignada primero (con contacto); si 404, probar pool (abierta).
      try {
        const { request } = await getAssignedRequest(id);
        setView({ kind: "assigned", request });
        return;
      } catch {
        const { request, applied } = await getPoolRequest(id);
        let status: { applied: boolean; applicationCount: number } | null = null;
        try {
          status = await getApplicationStatus(id);
        } catch {
          status = null;
        }
        setView({
          kind: "pool",
          request: {
            ...request,
            applicationCount: status?.applicationCount ?? request.applicationCount,
          },
          applied: status?.applied ?? applied,
        });
      }
    } catch {
      setError(es.request.notFound);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (kind: "apply" | "complete") => {
    if (confirm !== kind) {
      setConfirm(kind);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (kind === "apply") {
        await applyToRequest(id);
        notify(es.feedback.applied, "success");
      } else {
        await completeRequest(id);
        notify(es.feedback.completed, "success");
      }
      setConfirm(null);
      setLoading(true);
      await load();
    } catch (e: unknown) {
      setError(serverMessage(e, kind === "apply" ? es.tech.applyError : es.tech.completeError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Atrás"
          hitSlop={8}
          style={styles.back}
        >
          <Text style={styles.backText}>‹ Atrás</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {es.request.detailTitle}
        </Text>
        {loading ? (
          <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={es.home.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : view?.kind === "pool" ? (
          <PoolBody
            request={view.request}
            applied={view.applied}
            confirming={confirm === "apply"}
            busy={busy}
            error={error}
            onApply={() => void act("apply")}
          />
        ) : view?.kind === "assigned" ? (
          <AssignedBody
            requestId={id}
            request={view.request}
            confirming={confirm === "complete"}
            busy={busy}
            error={error}
            onComplete={() => void act("complete")}
            onUploaded={(fresh) =>
              setView((prev) =>
                prev?.kind === "assigned"
                  ? { kind: "assigned", request: { ...prev.request, photos: [...prev.request.photos, ...fresh] } }
                  : prev,
              )
            }
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.error}>{error ?? es.request.notFound}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ request }: { request: PoolRequest | AssignedRequest }) {
  const meta = statusMeta(request.status);
  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.category}>{es.categories[request.category]}</Text>
        <View style={[styles.chip, { backgroundColor: meta.bg }]}>
          <Text style={[styles.chipText, { color: meta.fg }]}>{meta.label}</Text>
        </View>
      </View>
      <Text style={styles.desc}>{request.description}</Text>
    </View>
  );
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.kv, !last && styles.divider]}>
      <Text style={styles.k}>{label}</Text>
      <Text style={styles.v}>{value}</Text>
    </View>
  );
}

function PoolBody({
  request,
  applied,
  confirming,
  busy,
  error,
  onApply,
}: {
  request: PoolRequest;
  applied: boolean;
  confirming: boolean;
  busy: boolean;
  error: string | null;
  onApply: () => void;
}) {
  const n = request.applicationCount;
  return (
    <>
      <Header request={request} />
      <View style={styles.card}>
        <Row label={es.auth.province} value={request.province} />
        <Row label={es.auth.locality} value={request.locality} />
        {request.availability ? <Row label={es.request.availability} value={request.availability} /> : null}
        <Row
          label={es.photos.title}
          value={request.photoCount > 0 ? `${request.photoCount} fotos` : "Sin fotos"}
        />
        <Row
          label="Candidatos"
          value={n === 0 ? "Sé el primero en postularte" : `${n} ${n === 1 ? es.tech.applicant : es.tech.applicants}`}
        />
        <Row label="Publicada" value={new Date(request.createdAt).toLocaleDateString("es-ES")} last />
      </View>
      <Text style={styles.note}>{es.tech.poolNote}</Text>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {applied ? (
        <View style={styles.card} accessibilityRole="summary" accessibilityLabel={es.tech.applied}>
          <Text style={styles.appliedTitle}>{es.tech.applied}</Text>
          <Text style={styles.note}>{es.tech.appliedNote}</Text>
        </View>
      ) : (
        <CustomButton
          title={confirming ? es.tech.confirmApply : es.tech.apply}
          variant={confirming ? "danger" : "primary"}
          isLoading={busy}
          onPress={onApply}
        />
      )}
    </>
  );
}

function AssignedBody({
  requestId,
  request,
  confirming,
  busy,
  error,
  onComplete,
  onUploaded,
}: {
  requestId: string;
  request: AssignedRequest;
  confirming: boolean;
  busy: boolean;
  error: string | null;
  onComplete: () => void;
  onUploaded: (fresh: RequestPhoto[]) => void;
}) {
  return (
    <>
      <Header request={request} />
      <View style={styles.card}>
        <Row label={es.auth.province} value={request.province} />
        <Row label={es.auth.locality} value={request.locality} />
        <Row label={es.auth.address} value={request.address} />
        {request.availability ? <Row label={es.request.availability} value={request.availability} /> : null}
        <Row label="Publicada" value={new Date(request.createdAt).toLocaleDateString("es-ES")} last />
      </View>
      <RequestPhotos
        requestId={requestId}
        photos={request.photos}
        canAdd={request.status === "ACCEPTED"}
        onUploaded={onUploaded}
      />
      <View style={styles.card}>
        <Text style={styles.contactTitle}>{es.tech.contact}</Text>
        <Row label={es.auth.firstName} value={request.client.firstName} />
        <Row label={es.auth.phone} value={request.client.phone} last />
      </View>
      {request.rating ? (
        <View style={styles.card}>
          <Text style={styles.contactTitle}>{es.ratings.clientRated}</Text>
          <StarsDisplay value={request.rating.score} />
          {request.rating.comment ? <Text style={styles.desc}>{request.rating.comment}</Text> : null}
        </View>
      ) : null}
      {request.status === "ACCEPTED" ? (
        <ChatBox requestId={requestId} />
      ) : request.status === "DONE" ? (
        <ChatBox requestId={requestId} readOnly />
      ) : null}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {request.status === "ACCEPTED" ? (
        <CustomButton
          title={confirming ? es.tech.confirmComplete : es.tech.complete}
          variant={confirming ? "danger" : "primary"}
          isLoading={busy}
          onPress={onComplete}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flexGrow: 1, padding: 20, gap: 16, paddingBottom: 32 },
  back: { alignSelf: "flex-start", paddingVertical: 4 },
  backText: { fontSize: 16, fontWeight: "700", color: colors.primary },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, gap: 8 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  category: { fontSize: 18, fontWeight: "700", color: colors.text },
  desc: { fontSize: 15, color: colors.text },
  contactTitle: { fontSize: 16, fontWeight: "700", color: colors.primary },
  appliedTitle: { fontSize: 16, fontWeight: "700", color: "#15803D" },
  note: { fontSize: 13, color: colors.muted },
  kv: { paddingVertical: 8, gap: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  k: { fontSize: 12, color: colors.muted },
  v: { fontSize: 16, color: colors.text },
  chip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: "700" },
  error: { fontSize: 14, color: colors.error },
});
