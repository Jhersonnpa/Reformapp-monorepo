import { CustomButton } from "@/components/CustomButton";
import { FormAutocomplete } from "@/components/FormAutocomplete";
import { FormInput } from "@/components/FormInput";
import { es } from "@/i18n/es";
import { suggestProvinces } from "@/lib/provinces";
import { signUp, serverMessage } from "@/services/auth-service";
import { colors, radius } from "@/theme/tokens";
import { signUpSchema, type SignUpInput } from "@reformapp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { StyleSheet, Text, TextInput, View } from "react-native";

export default function SignUp() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const provinceRef = useRef<TextInput>(null);
  const localityRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      username: "",
      firstName: "",
      lastName: "",
      phone: "",
      province: "",
      locality: "",
      address: "",
    },
    mode: "onTouched",
  });

  const submit = async (form: SignUpInput) => {
    setServerError(null);
    try {
      await signUp(form);
      // Sin sesión todavía: a sign-in con el email precargado.
      router.replace({ pathname: "/(auth)/sign-in", params: { email: form.email } });
    } catch (error: unknown) {
      setServerError(serverMessage(error, es.auth.signUpError));
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {es.auth.createAccount}
        </Text>
        <Text style={styles.subtitle}>{es.auth.signUpSubtitle}</Text>
      </View>
      <FormInput control={control} name="username" label={es.auth.username} placeholder="tu_usuario" textContentType="username" autoComplete="username" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} blurOnSubmit={false} />
      <FormInput control={control} name="email" label={es.auth.email} placeholder="tucorreo@ejemplo.com" keyboardType="email-address" textContentType="emailAddress" autoComplete="email" returnKeyType="next" inputRef={emailRef} onSubmitEditing={() => passwordRef.current?.focus()} blurOnSubmit={false} />
      <FormInput control={control} name="password" label={es.auth.password} placeholder="Mínimo 8 caracteres" togglePassword textContentType="newPassword" autoComplete="password-new" returnKeyType="next" inputRef={passwordRef} onSubmitEditing={() => firstNameRef.current?.focus()} blurOnSubmit={false} />
      <FormInput control={control} name="firstName" label={es.auth.firstName} placeholder="Tu nombre" textContentType="givenName" returnKeyType="next" inputRef={firstNameRef} onSubmitEditing={() => lastNameRef.current?.focus()} blurOnSubmit={false} />
      <FormInput control={control} name="lastName" label={es.auth.lastName} placeholder="Tus apellidos" textContentType="familyName" returnKeyType="next" inputRef={lastNameRef} onSubmitEditing={() => phoneRef.current?.focus()} blurOnSubmit={false} />
      <FormInput control={control} name="phone" label={es.auth.phone} placeholder="600 123 456" keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" returnKeyType="next" inputRef={phoneRef} onSubmitEditing={() => provinceRef.current?.focus()} blurOnSubmit={false} />
      <FormAutocomplete
        control={control}
        name="province"
        label={es.auth.province}
        placeholder={es.form.provincePh}
        suggest={suggestProvinces}
        suggestionsLabel={es.form.suggestions}
        noMatchLabel={es.form.noProvinceMatch}
        returnKeyType="next"
        inputRef={provinceRef}
        onSubmitEditing={() => localityRef.current?.focus()}
        blurOnSubmit={false}
      />
      <FormInput control={control} name="locality" label={es.auth.locality} placeholder="Localidad" returnKeyType="next" inputRef={localityRef} onSubmitEditing={() => addressRef.current?.focus()} blurOnSubmit={false} />
      <FormInput control={control} name="address" label={es.auth.address} placeholder="Calle y número" returnKeyType="done" inputRef={addressRef} onSubmitEditing={() => void handleSubmit(submit)()} />
      {serverError ? (
        <Text style={styles.serverError} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {serverError}
        </Text>
      ) : null}
      <CustomButton title={es.auth.signUp} isLoading={isSubmitting} onPress={() => void handleSubmit(submit)()} />
      <View style={styles.footer}>
        <Text style={styles.muted}>{es.auth.hasAccount} </Text>
        <Link href="./sign-in" style={styles.link}>
          {es.auth.signIn}
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
  serverError: { fontSize: 13, color: colors.error },
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 4 },
  muted: { fontSize: 15, color: colors.muted },
  link: { fontSize: 15, fontWeight: "700", color: colors.accent },
});
