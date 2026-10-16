import { CustomButton } from "@/components/CustomButton";
import { ChatBox } from "@/components/ChatBox";
import { CustomInput } from "@/components/CustomInput";
import { RequestPhotos } from "@/components/RequestPhotos";
import { StarsDisplay, StarsInput } from "@/components/Stars";
import { useToast } from "@/components/Toast";
import { es } from "@/i18n/es";
import { statusMeta } from "@/lib/request-ui";
import { serverMessage } from "@/services/auth-service";
import { cancelRequest, chooseTechnician, createRating, getRequest, listApplications } from "@/services/requests-service";
import { colors, radius } from "@/theme/tokens";
import type { Applicant, ServiceRequest } from "@reformapp/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.kv, !last && styles.divider]}>
      <Text style={styles.k}>{label}</Text>
      <Text style={styles.v}>{value}</Text>
    </View>
  );
}

function DetailRows({ data }: { data: ServiceRequest }) {
  const rows: Array<[string, string]> = [
    [es.auth.province, data.province],
    [es.auth.locality, data.locality],
    [es.auth.address, data.address],
  ];
  if (data.availability) rows.push([es.request.availability, data.availability]);
  rows.push(["Creada", new Date(data.createdAt).toLocaleDateString("es-ES")]);
  return (
    <>
      {rows.map(([label, value], i) => (
        <Row key={label} label={label} value={value} last={i === rows.length - 1} />
      ))}
    </>
  );
}

export default function RequestDetail() {
  const router = useRouter();
  const { notify } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let alive = true;
    getRequest(id)
      .then(({ request }) => {
        if (alive) setData(request);
      })
      .catch(() => {
        if (alive) setError(es.request.notFound);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const onCancel = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setCancelling(true);
    setError(null);
    try {
      const { request } = await cancelRequest(id);
      setData(request);
      setConfirming(false);
      notify(es.feedback.cancelled, "success");
    } catch (e: unknown) {
      setError(serverMessage(e, es.request.cancelError));
    } finally {
      setCancelling(false);
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
        ) : !data ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error ?? es.request.notFound}</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.headRow}>
                <Text style={styles.category}>{es.categories[data.category]}</Text>
                {(() => {
                  const meta = statusMeta(data.status);
                  return (
                    <View style={[styles.chip, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.chipText, { color: meta.fg }]}>{meta.label}</Text>
                    </View>
                  );
                })()}
              </View>
              <Text style={styles.desc}>{data.description}</Text>
            </View>
            <View style={styles.card}>
              <DetailRows data={data} />
            </View>
            <RequestPhotos
              requestId={data.id}
              photos={data.photos ?? []}
              canAdd={data.status === "OPEN"}
              onUploaded={(fresh) =>
                setData((prev) =>
                  prev ? { ...prev, photos: [...(prev.photos ?? []), ...fresh], photoCount: (prev.photoCount ?? 0) + fresh.length } : prev,
                )
              }
            />
            {error ? (
              <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            {data.status === "OPEN" ? (
              <>
                <CandidatesSection
                  requestId={data.id}
                  onChosen={(fresh) => setData(fresh)}
                />
                <CustomButton
                  title={confirming ? es.request.confirmCancel : es.request.cancel}
                  variant={confirming ? "danger" : "secondary"}
                  isLoading={cancelling}
                  onPress={() => void onCancel()}
                />
              </>
            ) : null}
            {data.technician && (data.status === "ACCEPTED" || data.status === "DONE") ? (
              <View style={styles.card}>
                <Text style={styles.ratingTitle}>{es.choose.technician}</Text>
                <Row label={es.auth.firstName} value={data.technician.firstName} />
                <Row label={es.auth.phone} value={data.technician.phone} last />
              </View>
            ) : null}
            {data.status === "ACCEPTED" ? (
              <ChatBox requestId={data.id} />
            ) : data.status === "DONE" ? (
              <ChatBox requestId={data.id} readOnly />
            ) : null}
            {data.status === "DONE" ? (
              <RatingSection
                requestId={data.id}
                initial={data.rating ?? null}
                onRated={(rating) => setData((prev) => (prev ? { ...prev, rating } : prev))}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CandidatesSection({
  requestId,
  onChosen,
}: {
  requestId: string;
  onChosen: (fresh: ServiceRequest) => void;
}) {
  const [cands, setCands] = useState<Applicant[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();

  useEffect(() => {
    let alive = true;
    listApplications(requestId)
      .then(({ applications }) => {
        if (alive) setCands(applications);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, [requestId]);

  const choose = async (techId: string) => {
    if (confirmId !== techId) {
      setConfirmId(techId);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await chooseTechnician(requestId, techId);
      // Refresca el detalle completo (contacto del técnico incluido)
      const full = await getRequest(requestId);
      onChosen(full.request);
      notify(es.feedback.chosen, "success");
    } catch (e: unknown) {
      setError(serverMessage(e, es.choose.chooseError));
    } finally {
      setBusy(false);
      setConfirmId(null);
    }
  };

  if (cands === null) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.ratingTitle}>{es.choose.title}</Text>
      {cands.length === 0 ? (
        <Text style={styles.muted}>{loadError ? es.request.loadError : es.choose.empty}</Text>
      ) : (
        <>
          <Text style={styles.muted}>
            {cands.length} {cands.length === 1 ? es.choose.countOne : es.choose.count}
          </Text>
          {cands.map((c) => (
            <View key={c.techId} style={styles.cand}>
              <View style={styles.candInfo}>
                <Text style={styles.candName}>{c.firstName}</Text>
                {c.count > 0 ? (
                  <StarsDisplay value={c.avg} text={`${c.avg.toLocaleString("es-ES")} · ${c.count} ${c.count === 1 ? es.ratings.review : es.ratings.reviews}`} />
                ) : (
                  <Text style={styles.muted}>{es.ratings.noRatings}</Text>
                )}
              </View>
              <CustomButton
                title={confirmId === c.techId ? es.choose.confirmChoose : es.choose.choose}
                variant={confirmId === c.techId ? "danger" : "primary"}
                isLoading={busy && confirmId === c.techId}
                onPress={() => void choose(c.techId)}
              />
            </View>
          ))}
          {error ? (
            <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function RatingSection({  requestId,
  initial,
  onRated,
}: {
  requestId: string;
  initial: ServiceRequest["rating"];
  onRated: (rating: NonNullable<ServiceRequest["rating"]>) => void;
}) {
  const [rating, setRating] = useState(initial);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [scoreError, setScoreError] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { notify } = useToast();

  const send = async () => {
    if (score < 1) {
      setScoreError(true);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { rating: fresh } = await createRating(requestId, {
        score,
        comment: comment.trim() ? comment.trim() : null,
      });
      setRating(fresh);
      setSent(true);
      onRated(fresh);
      notify(es.feedback.rated, "success");
    } catch (e: unknown) {
      setError(serverMessage(e, es.ratings.rateError));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.ratingTitle}>{es.ratings.title}</Text>
      {rating ? (
        <>
          <StarsDisplay value={rating.score} />
          {rating.comment ? <Text style={styles.comment}>{rating.comment}</Text> : null}
          {sent ? <Text style={styles.sent}>{es.ratings.sent}</Text> : null}
        </>
      ) : (
        <>
          <Text style={styles.muted}>{es.ratings.select}</Text>
          <StarsInput value={score} onChange={(v) => { setScore(v); setScoreError(false); }} />
          {scoreError ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {es.ratings.required}
            </Text>
          ) : null}
          <CustomInput
            value={comment}
            onChangeText={setComment}
            label={es.ratings.comment}
            placeholder={es.ratings.commentPh}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <CustomButton title={es.ratings.send} isLoading={sending} onPress={() => void send()} />
        </>
      )}
    </View>
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
  kv: { paddingVertical: 8, gap: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  k: { fontSize: 12, color: colors.muted },
  v: { fontSize: 16, color: colors.text },
  chip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: "700" },
  error: { fontSize: 14, color: colors.error },
  ratingTitle: { fontSize: 16, fontWeight: "700", color: colors.primary },
  muted: { fontSize: 14, color: colors.muted },
  cand: { gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  candInfo: { gap: 4 },
  candName: { fontSize: 16, fontWeight: "700", color: colors.text },
  comment: { fontSize: 15, color: colors.text, fontStyle: "italic" },
  sent: { fontSize: 13, color: "#15803D", fontWeight: "600" },
});
