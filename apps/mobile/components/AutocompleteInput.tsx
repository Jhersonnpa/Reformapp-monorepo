import { colors, fontSize, radius } from "@/theme/tokens";
import { forwardRef, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from "react-native";
import { CustomInput, type CustomInputProps } from "./CustomInput";

export interface AutocompleteInputProps extends Omit<CustomInputProps, "value" | "onChangeText"> {
  value: string;
  onChangeText: (text: string) => void;
  /** Devuelve sugerencias para lo escrito (ya limitadas). */
  suggest: (query: string) => string[];
  suggestionsLabel?: string;
  noMatchLabel?: string;
}

/**
 * Input con sugerencias mientras escribes (lista bajo el campo).
 * Al elegir una sugerencia, el valor queda exacto (sin errores de escritura).
 */
export const AutocompleteInput = forwardRef<TextInput, AutocompleteInputProps>(
  function AutocompleteInput(
    { value, onChangeText, suggest, suggestionsLabel, noMatchLabel, onBlur, onFocus, ...rest },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const suggestions = useMemo(() => suggest(value), [suggest, value]);
    const showList = open && value.trim().length > 0;
    // Si lo escrito ya es una opción exacta, no hay nada que sugerir.
    const exact = suggestions.length === 1 && suggestions[0] === value;

    return (
      <View style={styles.wrap}>
        <CustomInput
          ref={ref}
          value={value}
          onChangeText={(t) => {
            onChangeText(t);
            setOpen(true);
          }}
          onFocus={(e) => {
            setOpen(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            // Cierra tras el tap en la sugerencia (el tap llega antes).
            setTimeout(() => setOpen(false), 150);
            onBlur?.(e);
          }}
          autoCorrect={false}
          {...rest}
        />
        {showList && !exact ? (
          <View
            style={styles.list}
            accessibilityRole="menu"
            accessibilityLabel={suggestionsLabel ?? "Sugerencias"}
          >
            {suggestions.length === 0 ? (
              <Text style={styles.noMatch}>{noMatchLabel ?? "Sin coincidencias."}</Text>
            ) : (
              suggestions.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => {
                    onChangeText(s);
                    setOpen(false);
                  }}
                  accessibilityRole="menuitem"
                  accessibilityLabel={s}
                  accessibilityState={{ selected: false }}
                  style={styles.option}
                >
                  <Text style={styles.optionText}>{s}</Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  list: {
    marginTop: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  option: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  optionText: { fontSize: fontSize.base, color: colors.text },
  noMatch: { padding: 12, fontSize: fontSize.sm, color: colors.muted, textAlign: "center" },
});
