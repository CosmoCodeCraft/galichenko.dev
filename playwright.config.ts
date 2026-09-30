import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4322", browserName: "chromium" },
  webServer: {
    command: "pnpm exec astro preview --host 127.0.0.1 --port 4322",
    url: "http://127.0.0.1:4322",
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
