import { colors, radius } from "@/theme/tokens";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

export interface CustomButtonProps {
  title?: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger";
  isLoading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const VARIANTS = {
  primary: { button: { backgroundColor: colors.primary }, text: { color: colors.white } },
  secondary: {
    button: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.primary },
    text: { color: colors.primary },
  },
  danger: {
    button: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.error },
    text: { color: colors.error },
  },
} as const;

export function CustomButton({
  title = "Continuar",
  onPress,
  variant = "primary",
  isLoading = false,
  disabled = false,
  leftIcon,
  style,
  textStyle,
}: CustomButtonProps) {
  const isDisabled = disabled || isLoading;
  const v = VARIANTS[variant];
  return (
    <TouchableOpacity
      style={[styles.button, v.button, isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={isLoading ? "Cargando, espera un momento" : undefined}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      hitSlop={8}
    >
      {leftIcon}
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? colors.white : colors.primary}
        />
      ) : (
        <Text style={[styles.text, v.text, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.pill,
    padding: 12,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disabled: { opacity: 0.6 },
  text: { fontSize: 16, fontWeight: "600" },
});
