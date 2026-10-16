import { colors, radius } from "@/theme/tokens";
import { forwardRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

export interface CustomInputProps extends Omit<TextInputProps, "style"> {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  isError?: boolean;
  errorMessage?: string;
  isDisabled?: boolean;
  leftIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export const CustomInput = forwardRef<TextInput, CustomInputProps>(
  function CustomInput(
    {
      placeholder = "Introduce texto",
      value,
      onChangeText,
      label,
      secureTextEntry = false,
      keyboardType = "default",
      isError = false,
      errorMessage = "Este campo es obligatorio",
      isDisabled = false,
      style,
      inputStyle,
      leftIcon,
      accessibilityLabel,
      accessibilityHint,
      ...rest
    },
    ref,
  ) {
    const [isFocused, setIsFocused] = useState(false);
    const labelText = label ?? placeholder;
    return (
      <View style={[styles.wrap, style]}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={styles.field}>
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            placeholderTextColor="#6E7882"
            editable={!isDisabled}
            accessibilityLabel={accessibilityLabel ?? labelText}
            accessibilityHint={accessibilityHint}
            aria-invalid={isError}
            autoCapitalize="none"
            autoCorrect={false}
            allowFontScaling
            style={[
              styles.input,
              leftIcon ? styles.withIcon : null,
              isFocused && styles.focused,
              isError && styles.error,
              isDisabled && styles.disabled,
              inputStyle,
            ]}
            {...rest}
          />
        </View>
        {isError ? (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {errorMessage}
          </Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  label: { color: colors.primary, fontWeight: "700", marginBottom: 4, fontSize: 14 },
  field: { position: "relative", width: "100%" },
  icon: { position: "absolute", left: 12, top: 13, zIndex: 1 },
  input: {
    height: 48,
    width: "100%",
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
  withIcon: { paddingLeft: 42 },
  focused: { borderColor: colors.primary },
  error: { borderColor: colors.error },
  disabled: { backgroundColor: "#F3F4F6" },
  errorText: { marginTop: 4, fontSize: 13, color: colors.error },
});
