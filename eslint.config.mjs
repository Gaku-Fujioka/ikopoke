import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // work/ contains local previews and temporary verification helpers.
  globalIgnores([".next/**", "node_modules/**", "out/**", "build/**", "next-env.d.ts", "work/**"]),
]);
