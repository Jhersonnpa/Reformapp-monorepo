import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    files: ["app/**/*.ts", "app/**/*.tsx", "components/**/*.tsx", "services/**/*.ts", "store/**/*.ts", "i18n/**/*.ts", "theme/**/*.ts", "lib/**/*.ts"],
    extends: [...tseslint.configs.recommended],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    ignores: ["dist/**", "node_modules/**"],
  },
);
