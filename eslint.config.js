import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/generated/**",
      "**/*.cjs",
      "**/*.mjs",
      "packages/embed/**",
    ],
  },
  {
    rules: {
      // Allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Allow explicit any in pragmatic cases (tighten later)
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow require() in CJS files
      "@typescript-eslint/no-require-imports": "off",
      // Disallow console in backend code
      "no-console": "warn",
    },
  },
  // Issue #170 OD-5: API code must go through the IdentityProvider abstraction
  // for any Clerk interaction. Direct @clerk/* imports are only allowed in the
  // single concrete implementation (clerk-identity-provider.ts).
  {
    files: ["apps/api/src/**/*.ts"],
    ignores: [
      "apps/api/src/auth/clerk-identity-provider.ts",
      "apps/api/src/**/*.test.ts",
      "apps/api/src/**/*.spec.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@clerk/*"],
              message:
                "Import the IdentityProvider abstraction from apps/api/src/auth/identity-provider.ts (or use fastify.identityProvider) instead. Direct @clerk/* imports are only allowed in clerk-identity-provider.ts.",
            },
          ],
        },
      ],
    },
  },
  // Relax no-console for frontend (Next.js client-side logging is acceptable)
  {
    files: ["apps/web/**/*.ts", "apps/web/**/*.tsx"],
    rules: {
      "no-console": "off",
    },
  },
  // Relax no-console for test files
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/test/**/*.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/triple-slash-reference": "off",
    },
  }
);
