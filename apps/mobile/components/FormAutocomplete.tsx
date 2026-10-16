import type { Control, FieldValues, Path } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { TextInput } from "react-native";
import { AutocompleteInput } from "./AutocompleteInput";
import type { Ref } from "react";

/**
 * Autocompletado conectado a react-hook-form (igual que FormInput).
 * Muestra el error de validación bajo el campo.
 */
export function FormAutocomplete<T extends FieldValues>({
  control,
  name,
  suggest,
  suggestionsLabel,
  noMatchLabel,
  inputRef,
  ...rest
}: Omit<React.ComponentProps<typeof AutocompleteInput>, "value" | "onChangeText" | "isError" | "errorMessage"> & {
  control: Control<T>;
  name: Path<T>;
  suggest: (query: string) => string[];
  suggestionsLabel?: string;
  noMatchLabel?: string;
  inputRef?: Ref<TextInput>;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
        <AutocompleteInput
          ref={inputRef}
          value={value ?? ""}
          onChangeText={onChange}
          onBlur={onBlur}
          suggest={suggest}
          suggestionsLabel={suggestionsLabel}
          noMatchLabel={noMatchLabel}
          isError={!!error}
          errorMessage={error?.message}
          {...rest}
        />
      )}
    />
  );
}