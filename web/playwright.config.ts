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
      // The second address checks that a listed email is not made admin once a super admin exists
      SUPER_ADMIN_EMAILS: "admin@test.dama.my,late-admin@test.dama.my",
      BANK_ACCOUNT_NUMBER: "1234567890",
      CRON_SECRET: "test-cron-secret",
      SMTP_HOST: "",
      // next start also loads .env.production.local: blank the real email and storage settings
      MS_TENANT_ID: "",
      MS_CLIENT_ID: "",
      MS_CLIENT_SECRET: "",
      MS_SENDER: "",
      DATABASE_URL: "",
      NEWS_EXTRA_DIR: "tests/fixtures/news",
      S3_BUCKET: "",
    },
  },
});
