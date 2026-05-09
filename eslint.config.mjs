import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ["scripts/*.js", "codex/skills/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off"
    }
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".basecamp-data/**",
    ".ingest/**"
  ])
]);
