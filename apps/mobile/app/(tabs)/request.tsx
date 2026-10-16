import { CustomButton } from "@/components/CustomButton";
import { SuggestionChips } from "@/components/Feedback";
import { FormAutocomplete } from "@/components/FormAutocomplete";
import { FormInput } from "@/components/FormInput";
import { PhotoViewer } from "@/components/PhotoViewer";
import { SelectSheet } from "@/components/SelectSheet";
import { useToast } from "@/components/Toast";
import { es } from "@/i18n/es";
import { suggestProvinces } from "@/lib/provinces";
import { serverMessage } from "@/services/auth-service";
import { createRequest, preparePhoto, uploadRequestPhotos, type PickedPhoto } from "@/services/requests-service";
import { useAuthStore } from "@/store/auth.store";
import { colors, radius } from "@/theme/tokens";
import { RequestCategory, requestCreateSchema } from "@reformapp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import * as ImagePicker from "expo-image-picker";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

const formSchema = requestCreateSchema.omit({ category: true });
type Form = z.infer<typeof formSchema>;

const CATEGORIES = Object.values(RequestCategory);

export default function Request() {
  const router = useRouter();
  const { notify } = useToast();
  const user = useAuthStore((s) => s.user);
  const [category, setCategory] = useState<RequestCategory | null>(null);
  const [categoryError, setCategoryError] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedPhoto[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting, isDirty },
  } = useForm<Form>({
    resolver: zodResolver(formSchema),
    defaultValues: { description: "", province: "", locality: "", address: "", availability: "" },
    mode: "onTouched",
  });

  // Pre-rellena con la dirección del perfil si el formulario está intacto.
  useEffect(() => {
    if (user && !isDirty) {
      reset({
        description: "",
        province: user.province,
        locality: user.locality,
        address: user.address,
        availability: "",
      });
    }
  }, [user, isDirty, reset]);

  // El formulario de solicitud es solo de cliente.
  if (user?.role === "TECH" || user?.role === "ADMIN") {
    return <Redirect href="/(tabs)/jobs" />;
  }

  const pickPhotos = async () => {
    setServerError(null);
    setOptimizing(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 5,
        quality: 1,
      });
      if (res.canceled) return;
      const next: PickedPhoto[] = [];
      for (const a of res.assets) {
        next.push(await preparePhoto(a.uri, a.width ?? 0));
      }
      setPicked((prev) => [...prev, ...next].slice(0, 5));
    } catch {
      setServerError(es.photos.pickError);
    } finally {
      setOptimizing(false);
    }
  };

  const submit = async (form: Form) => {
    if (!category) {
      setCategoryError(true);
      return;
    }
    setServerError(null);
    setUploadFailed(false);
    try {
      const { request } = await createRequest({ ...form, category });
      if (picked.length > 0) {
        try {
          await uploadRequestPhotos(request.id, picked, (done, total) =>
            setProgress(`${es.photos.uploading} ${done}/${total}…`),
          );
        } catch (e: unknown) {
          // La solicitud ya existe: avisa y deja continuar al listado.
          setProgress(null);
          setUploadFailed(true);
          setServerError(serverMessage(e, es.photos.uploadError));
          return;
        } finally {
          setProgress(null);
        }
      }
      router.replace("/(tabs)");
      notify(es.feedback.created, "success");
    } catch (error: unknown) {
      setServerError(serverMessage(error, es.request.createError));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          {es.request.title}
        </Text>

        <View style={styles.group}>
          <Text style={styles.label}>{es.request.category}</Text>
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="combobox"
            accessibilityLabel={es.request.category}
            accessibilityValue={{ text: category ? es.categories[category] : es.form.pickCategory }}
            accessibilityHint="Abre el selector de categoría"
            style={[styles.select, categoryError && styles.selectError]}
          >
            <Text style={[styles.selectText, !category && styles.selectPlaceholder]}>
              {category ? es.categories[category] : es.form.pickCategory}
            </Text>
            <Text style={styles.selectChevron}>⌄</Text>
          </Pressable>
          {categoryError ? (
            <Text style={styles.fieldError} accessibilityLiveRegion="polite">
              {es.request.categoryRequired}
            </Text>
          ) : null}
        </View>
        <SelectSheet
          visible={sheetOpen}
          title={es.request.category}
          options={CATEGORIES.map((c) => ({ value: c, label: es.categories[c] }))}
          selected={category}
          searchable
          searchPlaceholder="Buscar categoría…"
          onSelect={(v) => {
            setCategory(v);
            setCategoryError(false);
          }}
          onClose={() => setSheetOpen(false)}
        />

        <FormInput
          control={control}
          name="description"
          label={es.request.description}
          placeholder={es.request.descriptionPh}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        <Text style={styles.section}>{es.request.addressSection}</Text>
        <FormAutocomplete
          control={control}
          name="province"
          label={es.auth.province}
          placeholder={es.form.provincePh}
          suggest={suggestProvinces}
          suggestionsLabel={es.form.suggestions}
          noMatchLabel={es.form.noProvinceMatch}
        />
        <FormInput control={control} name="locality" label={es.auth.locality} placeholder="Localidad" />
        <FormInput control={control} name="address" label={es.auth.address} placeholder="Calle y número" />
        <FormInput
          control={control}
          name="availability"
          label={es.request.availability}
          placeholder={es.request.availabilityPh}
        />
        <SuggestionChips
          label={es.form.availabilityHint}
          options={[...es.form.slots]}
          onPick={(v) => setValue("availability", v, { shouldDirty: true, shouldValidate: true })}
        />

        <View style={styles.group}>
          <Text style={styles.label}>{es.photos.title} (máx. 5)</Text>
          {picked.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
              {picked.map((p, i) => (
                <View key={p.uri} style={styles.pickedWrap}>
                  <Pressable onPress={() => setViewer(i)} accessibilityRole="button" accessibilityLabel={`Ampliar foto ${i + 1}`}>
                    <Image source={{ uri: p.uri }} style={styles.thumb} />
                  </Pressable>
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
          <CustomButton
            title={optimizing ? "Optimizando…" : es.photos.add}
            variant="secondary"
            disabled={optimizing}
            onPress={() => void pickPhotos()}
          />
        </View>

        {progress ? <Text style={styles.progress}>{progress}</Text> : null}

        {serverError ? (
          <Text style={styles.serverError} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {serverError}
          </Text>
        ) : null}

        {uploadFailed ? (
          <CustomButton title="Continuar a mis solicitudes" onPress={() => router.replace("/(tabs)")} />
        ) : (
          <CustomButton
            title={es.request.submit}
            isLoading={isSubmitting}
            onPress={() => void handleSubmit(submit)()}
          />
        )}
        <PhotoViewer
          photos={picked.map((p) => ({ uri: p.uri }))}
          index={viewer ?? 0}
          visible={viewer !== null}
          onClose={() => setViewer(null)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { flexGrow: 1, padding: 20, gap: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  section: { fontSize: 16, fontWeight: "700", color: colors.primary, marginTop: 4 },
  group: { gap: 8 },
  label: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  select: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  selectError: { borderColor: colors.error },
  selectText: { fontSize: 16, color: colors.text },
  selectPlaceholder: { color: "#6E7882" },
  selectChevron: { fontSize: 18, color: colors.primary, fontWeight: "700" },
  fieldError: { fontSize: 13, color: colors.error },
  serverError: { fontSize: 13, color: colors.error },
  progress: { fontSize: 13, color: colors.primary },
  thumbs: { gap: 8 },
  thumb: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: "#F1F5F9" },
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
});
