import astro from "eslint-plugin-astro";
import ts from "typescript-eslint";
import { defineConfig } from "eslint/config";
export default defineConfig(
  { ignores: ["dist/**", ".astro/**", "node_modules/**", "test-results/**"] },
  ...ts.configs.recommended,
  ...astro.configs.recommended,
);
