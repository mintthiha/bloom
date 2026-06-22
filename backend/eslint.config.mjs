import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      // Body parsing in Express routes requires casting unknown JSON to typed objects
      "@typescript-eslint/no-explicit-any": "off",
      // Allow _-prefixed params that are required by a signature (e.g. Express error handlers)
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  }
);
