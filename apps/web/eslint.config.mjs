import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // Pre-compressed local WebP art avoids the optional Cloudflare Images runtime.
      "@next/next/no-img-element": "off"
    }
  },
  globalIgnores([
    ".next/**",
    ".open-next/**",
    "worker-configuration.d.ts",
    "next-env.d.ts"
  ])
]);
