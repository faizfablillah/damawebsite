import { defineConfig } from "@playwright/test";

// End-to-end tests run against a dev server with its own empty database (.data-test).
// Uses the Microsoft Edge already installed on the machine (no browser download).
const PORT = 3100;

export default defineConfig({
  testDir: "./tests",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "msedge",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    // E2E_PROD=1 tests the production build (run `npx next build` first)
    command: process.env.E2E_PROD ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      DATA_DIR: ".data-test",
      APP_URL: `http://localhost:${PORT}`,
      SUPER_ADMIN_EMAILS: "admin@test.dama.my",
      BANK_ACCOUNT_NUMBER: "1234567890",
      CRON_SECRET: "test-cron-secret",
      SMTP_HOST: "",
      DATABASE_URL: "",
      S3_BUCKET: "",
    },
  },
});
