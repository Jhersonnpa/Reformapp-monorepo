import { CustomButton } from "./CustomButton";
import { colors, fontSize, radius, shadow } from "@/theme/tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";

/** Tarjeta de error con reintento (listas y detalles). */
export function ErrorBanner({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.card} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.title}>Algo no salió bien</Text>
      <Text style={styles.message}>{message}</Text>
      <CustomButton title={retryLabel} variant="secondary" onPress={onRetry} />
    </View>
  );
}

/** Estado vacío con acción opcional. */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.mark} accessible={false}>
        <Text style={styles.markText}>○</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{body}</Text>
      {actionLabel && onAction ? (
        <CustomButton title={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

/** Fila de sugerencia rápida: rellena un campo con un toque. */
export function SuggestionChips({
  label,
  options,
  onPick,
}: {
  label: string;
  options: string[];
  onPick: (value: string) => void;
}) {
  return (
    <View style={styles.chipsWrap}>
      <Text style={styles.chipsLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <Pressable
            key={o}
            onPress={() => onPick(o)}
            accessibilityRole="button"
            accessibilityLabel={`Usar: ${o}`}
            hitSlop={4}
            style={styles.chip}
          >
            <Text style={styles.chipText}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 20,
    gap: 10,
    alignItems: "stretch",
    ...shadow.card,
  },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { fontSize: 22, color: colors.primary, fontWeight: "700" },
  title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, textAlign: "center" },
  message: { fontSize: fontSize.md, color: colors.muted, textAlign: "center" },
  chipsWrap: { gap: 8 },
  chipsLabel: { fontSize: fontSize.sm, color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  chipText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.primary },
});
