import { CustomButton } from "@/components/CustomButton";
import { PhotoViewer } from "@/components/PhotoViewer";
import { es } from "@/i18n/es";
import { serverMessage } from "@/services/auth-service";
import { uploadRequestPhotos, preparePhoto, type PickedPhoto } from "@/services/requests-service";
import { colors, radius } from "@/theme/tokens";
import { MAX_REQUEST_PHOTOS, type RequestPhoto } from "@reformapp/shared";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const SELECTION_LIMIT = 5;

/**
 * Galería + subida de fotos de una solicitud existente.
 * El padre aporta las fotos del detalle y fusiona las nuevas.
 */
export function RequestPhotos({
  requestId,
  photos,
  canAdd,
  onUploaded,
}: {
  requestId: string;
  photos: RequestPhoto[];
  canAdd: boolean;
  onUploaded: (fresh: RequestPhoto[]) => void;
}) {
  const [picked, setPicked] = useState<PickedPhoto[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  const remaining = MAX_REQUEST_PHOTOS - photos.length - picked.length;

  const pick = async () => {
    setError(null);
    setOptimizing(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: Math.min(SELECTION_LIMIT, Math.max(remaining, 0)),
        quality: 1,
      });
      if (res.canceled) return;
      const next: PickedPhoto[] = [];
      for (const a of res.assets) {
        next.push(await preparePhoto(a.uri, a.width ?? 0));
      }
      setPicked((prev) => [...prev, ...next].slice(0, MAX_REQUEST_PHOTOS - photos.length));
    } catch {
      setError(es.photos.pickError);
    } finally {
      setOptimizing(false);
    }
  };

  const upload = async () => {
    if (picked.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const fresh = await uploadRequestPhotos(requestId, picked, (done, total) =>
        setProgress(`${es.photos.uploading} ${done}/${total}…`),
      );
      setPicked([]);
      setProgress(null);
      onUploaded(fresh);
    } catch (e: unknown) {
      setError(serverMessage(e, es.photos.uploadError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {es.photos.title} ({photos.length})
      </Text>
      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {photos.map((p, i) => (
            <Pressable key={p.id} onPress={() => setViewer(i)} accessibilityRole="button" accessibilityLabel={`Ampliar foto ${i + 1}`}>
              <Image source={{ uri: p.url }} style={styles.thumb} accessibilityRole="image" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {canAdd ? (
        <>
          {picked.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {picked.map((p) => (
                <View key={p.uri} style={styles.pickedWrap}>
                  <Image source={{ uri: p.uri }} style={styles.thumb} />
                  <Pressable
                    onPress={() => setPicked((prev) => prev.filter((x) => x.uri !== p.uri))}
                    accessibilityRole="button"
                    accessibilityLabel="Quitar foto"
                    hitSlop={8}
                    style={styles.remove}
                  >
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}
          {progress ? <Text style={styles.progress}>{progress}</Text> : null}
          {error ? (
            <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <CustomButton
              title={optimizing ? "Optimizando…" : es.photos.add}
              variant="secondary"
              disabled={busy || optimizing || remaining <= 0}
              onPress={() => void pick()}
            />
            {picked.length > 0 ? (
              <CustomButton
                title={`${es.photos.upload} (${picked.length})`}
                isLoading={busy}
                onPress={() => void upload()}
              />
            ) : null}
          </View>
          {remaining <= 0 ? <Text style={styles.muted}>{es.photos.maxReached}</Text> : null}
        </>
      ) : null}
      <PhotoViewer
        photos={photos.map((p) => ({ uri: p.url }))}
        index={viewer ?? 0}
        visible={viewer !== null}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, gap: 12 },
  title: { fontSize: 16, fontWeight: "700", color: colors.primary },
  row: { gap: 8 },
  thumb: { width: 120, height: 120, borderRadius: radius.md, backgroundColor: "#F1F5F9" },
  pickedWrap: { position: "relative" },
  remove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  progress: { fontSize: 13, color: colors.primary },
  error: { fontSize: 13, color: colors.error },
  muted: { fontSize: 13, color: colors.muted },
  actions: { gap: 8 },
});
