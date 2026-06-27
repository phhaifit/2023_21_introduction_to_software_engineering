import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: [
      "tests/component/**/*.test.{ts,tsx}",
      "apps/**/*.test.{ts,tsx}",
      "packages/**/*.test.{ts,tsx}"
    ],
    setupFiles: ["tests/component/setup.ts"],
    environmentMatchGlobs: [
      ["apps/backend/**", "node"],
      ["packages/**", "node"]
    ],
    deps: {
      moduleDirectories: ["node_modules", "apps/frontend/node_modules"]
    },
    restoreMocks: true,
    testTimeout: 30000
  }
});
