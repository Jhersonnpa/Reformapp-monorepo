import { CustomButton } from "@/components/CustomButton";
import { es } from "@/i18n/es";
import { colors, radius } from "@/theme/tokens";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function ForgotPassword() {
  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        {es.auth.forgotTitle}
      </Text>
      <Text style={styles.body}>{es.auth.forgotBody}</Text>
      <Link href="./sign-in" asChild>
        <CustomButton title={es.auth.backToSignIn} />
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 32, marginTop: 16, gap: 16, backgroundColor: colors.card, borderRadius: radius.lg, padding: 24 },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  body: { fontSize: 15, color: colors.muted },
});
