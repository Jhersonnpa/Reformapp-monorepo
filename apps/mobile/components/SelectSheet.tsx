import { colors, radius } from "@/theme/tokens";
import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * Selector en hoja inferior con buscador opcional.
 * Sustituye a los desplegables nativos (sin dependencias).
 */
export function SelectSheet<T extends string = string>({
  visible,
  title,
  options,
  selected,
  searchable = false,
  searchPlaceholder = "Buscar…",
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: Array<SelectOption<T>>;
  selected?: T | null;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q))
    : options;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <SafeAreaView style={styles.sheet} edges={["bottom"]}>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {searchable ? (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor="#6E7882"
            autoFocus={false}
            accessibilityLabel={searchPlaceholder}
            style={styles.search}
          />
        ) : null}
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.value}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          ListEmptyComponent={<Text style={styles.muted}>Sin coincidencias.</Text>}
          renderItem={({ item }) => {
            const active = item.value === selected;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.value);
                  setQuery("");
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={item.label}
                style={[styles.option, active && styles.optionActive]}
              >
                <View style={styles.optionText}>
                  <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
                  {item.hint ? <Text style={styles.hint}>{item.hint}</Text> : null}
                </View>
                {active ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,43,72,0.5)" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    maxHeight: "70%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 12 },
  search: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
    marginBottom: 8,
  },
  list: { flexGrow: 0 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  optionActive: { backgroundColor: colors.primaryLight, borderRadius: radius.sm },
  optionText: { flex: 1, gap: 2 },
  label: { fontSize: 16, color: colors.text },
  labelActive: { fontWeight: "700", color: colors.primary },
  hint: { fontSize: 13, color: colors.muted },
  check: { fontSize: 18, fontWeight: "700", color: colors.primary },
  muted: { fontSize: 14, color: colors.muted, paddingVertical: 16, textAlign: "center" },
});
