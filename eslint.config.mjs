import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // Keep existing Hooks checks as errors. These newly added compiler diagnostics
    // stay visible while UI refactors are reviewed separately; React Compiler is not enabled.
    rules: {
      "react-hooks/error-boundaries": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // work/ contains local previews and temporary verification helpers.
  globalIgnores([".next/**", "node_modules/**", "out/**", "build/**", "next-env.d.ts", "work/**"]),
]);
