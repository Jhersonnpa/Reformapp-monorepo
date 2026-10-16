import { CustomButton } from "@/components/CustomButton";
import { FormInput } from "@/components/FormInput";
import { useToast } from "@/components/Toast";
import { es } from "@/i18n/es";
import { signIn, serverMessage } from "@/services/auth-service";
import { useAuthStore } from "@/store/auth.store";
import { colors, radius } from "@/theme/tokens";
import { signInSchema, type SignInInput } from "@reformapp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { StyleSheet, Text, TextInput, View } from "react-native";

export default function SignIn() {
  const router = useRouter();
  const { notify } = useToast();
  const params = useLocalSearchParams<{ email?: string }>();
  const passwordRef = useRef<TextInput>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: typeof params.email === "string" ? params.email : "",
      password: "",
    },
    mode: "onTouched",
  });

  const submit = async (form: SignInInput) => {
    setServerError(null);
    try {
      const { accessToken, refreshToken } = await signIn(form);
      await useAuthStore.getState().login(accessToken, refreshToken);
      const name = useAuthStore.getState().user?.firstName;
      notify(name ? `${es.home.greeting}, ${name}` : es.auth.signIn, "success");
      router.replace("/(tabs)");
    } catch (error: unknown) {
      setServerError(serverMessage(error, es.auth.signInError));
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {es.auth.welcomeBack}
        </Text>
        <Text style={styles.subtitle}>{es.auth.signInSubtitle}</Text>
      </View>
      <FormInput
        control={control}
        name="email"
        label={es.auth.email}
        placeholder="tucorreo@ejemplo.com"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        blurOnSubmit={false}
      />
      <FormInput
        control={control}
        name="password"
        label={es.auth.password}
        placeholder="Tu contraseña"
        togglePassword
        textContentType="password"
        autoComplete="password"
        returnKeyType="done"
        inputRef={passwordRef}
        onSubmitEditing={() => void handleSubmit(submit)()}
      />
      <Link href="./forgot-password" style={styles.forgot}>
        {es.auth.forgot}
      </Link>
      {serverError ? (
        <Text style={styles.serverError} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {serverError}
        </Text>
      ) : null}
      <CustomButton title={es.auth.signIn} isLoading={isSubmitting} onPress={() => void handleSubmit(submit)()} />
      <View style={styles.footer}>
        <Text style={styles.muted}>{es.auth.noAccount} </Text>
        <Link href="./sign-up" style={styles.link}>
          {es.auth.signUp}
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 32, marginTop: 16, gap: 16, backgroundColor: colors.card, borderRadius: radius.lg, padding: 24 },
  head: { gap: 4, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted },
  forgot: { color: colors.primary, fontWeight: "700", alignSelf: "flex-end", fontSize: 14 },
  serverError: { fontSize: 13, color: colors.error },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 4 },
  muted: { fontSize: 15, color: colors.muted },
  link: { fontSize: 15, fontWeight: "700", color: colors.accent },
});
