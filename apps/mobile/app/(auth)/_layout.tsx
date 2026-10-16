import { es } from "@/i18n/es";
import { colors } from "@/theme/tokens";
import { Slot } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AuthLayout() {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        {/* Fondo sólido: la hora siempre se lee sobre el crema claro. */}
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} translucent={false} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.grow}
          style={styles.bg}
        >
          <View style={styles.brand}>
            <View style={styles.seal} accessibilityRole="image" accessibilityLabel="Logotipo de Reformapp">
              <Text style={styles.sealText}>R</Text>
            </View>
            <Text style={styles.name} accessibilityRole="header">
              {es.app.name}
            </Text>
            <Text style={styles.tagline}>{es.app.tagline}</Text>
          </View>
          <Slot />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  bg: { backgroundColor: colors.background },
  grow: { flexGrow: 1 },
  brand: { alignItems: "center", paddingTop: 40, paddingBottom: 8, paddingHorizontal: 20, gap: 4 },
  seal: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sealText: { color: colors.white, fontSize: 30, fontWeight: "700" },
  name: { fontSize: 28, fontWeight: "700", color: colors.primary },
  tagline: { fontSize: 15, color: colors.muted },
});
