import { CustomButton } from "@/components/CustomButton";
import { es } from "@/i18n/es";
import { colors } from "@/theme/tokens";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFound() {
  return (
    <View style={styles.center}>
      <Text style={styles.title} accessibilityRole="header">
        {es.notFound.title}
      </Text>
      <Text style={styles.body}>{es.notFound.body}</Text>
      <Link href="/" asChild>
        <CustomButton title={es.notFound.back} />
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: colors.white, padding: 20 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text },
  body: { fontSize: 15, color: colors.muted, textAlign: "center" },
});
