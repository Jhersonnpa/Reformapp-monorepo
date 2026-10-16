import { useState, type Ref } from "react";
import {
  Control,
  Controller,
  type FieldValues,
  type Path,
} from "react-hook-form";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from "react-native";
import { CustomInput, type CustomInputProps } from "./CustomInput";
import { colors } from "@/theme/tokens";

type FormInputProps<T extends FieldValues> = Omit<
  CustomInputProps,
  "value" | "onChangeText" | "isError" | "errorMessage"
> & {
  control: Control<T>;
  name: Path<T>;
  togglePassword?: boolean;
  inputRef?: Ref<TextInput>;
};

/**
 * Campo de formulario: react-hook-form + CustomInput + error por campo.
 * Solo re-renderiza este campo al escribir, no el formulario completo.
 */
export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  togglePassword = false,
  inputRef,
  secureTextEntry = false,
  ...rest
}: FormInputProps<T>) {
  const [hidden, setHidden] = useState(true);
  const secured = togglePassword ? hidden : secureTextEntry;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
        <View style={styles.wrap}>
          <CustomInput
            ref={inputRef}
            label={label}
            value={value ?? ""}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry={secured}
            isError={!!error}
            errorMessage={error?.message}
            {...rest}
          />
          {togglePassword ? (
            <Pressable
              onPress={() => setHidden((h) => !h)}
              accessibilityRole="button"
              accessibilityLabel={hidden ? "Mostrar contraseña" : "Ocultar contraseña"}
              hitSlop={8}
              style={styles.eye}
            >
              <Text style={styles.eyeText}>{hidden ? "Ver" : "Ocultar"}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", position: "relative" },
  eye: { position: "absolute", right: 8, top: 30, padding: 8 },
  eyeText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
});
