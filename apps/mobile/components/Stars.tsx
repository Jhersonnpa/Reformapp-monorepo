import { colors } from "@/theme/tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";

const STAR = "★";

/** Selector accesible de 1-5 estrellas (grupo radio). */
export function StarsInput({
  value,
  onChange,
  label = "Puntuación",
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = n <= value;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="radio"
            accessibilityState={{ checked: n === value }}
            accessibilityLabel={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
            hitSlop={4}
            style={styles.star}
          >
            <Text style={[styles.glyph, !selected && styles.off]}>{STAR}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Lectura: estrellas + texto (p. ej. "4,5 · 12 valoraciones"). */
export function StarsDisplay({ value, text }: { value: number; text?: string }) {
  const rounded = Math.round(value);
  return (
    <View style={styles.display} accessibilityRole="summary" accessibilityLabel={text ?? `${value} de 5`}>
      <View style={styles.glyphRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Text key={n} style={[styles.glyphSm, n > rounded && styles.off]}>
            {STAR}
          </Text>
        ))}
      </View>
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </View>
  );
}

// Evita anidar <Text> con estilos de fila (RN lo permite, pero el
// resumen usa una sola cadena accesible igualmente descriptiva).

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 4 },
  star: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  glyph: { fontSize: 36, color: "#F59E0B" },
  glyphSm: { fontSize: 18, color: "#F59E0B" },
  off: { color: "#D1D5DB" },
  display: { flexDirection: "row", alignItems: "center", gap: 8 },
  glyphRow: { flexDirection: "row" },
  text: { fontSize: 14, color: colors.muted },
});
