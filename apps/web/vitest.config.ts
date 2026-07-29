import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: [".next/**", ".open-next/**", "node_modules/**"]
  }
});
