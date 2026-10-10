import { defineConfig, devices } from "@playwright/test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const dataDirectory = mkdtempSync(`${tmpdir()}/soedirman-e2e-`);
export default defineConfig({
  testDir: "./tests/browser", fullyParallel: false, workers: 1, timeout: 60000,
  expect: { timeout: 15000 }, reporter: "list",
  use: { baseURL: "http://localhost:3137", trace: "retain-on-failure", screenshot: "only-on-failure", launchOptions: { executablePath: existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined } },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: { command: "npm run start -- --port 3137", url: "http://localhost:3137", reuseExistingServer: false, timeout: 120000,
    env: { DATA_BACKEND: "local", DATA_DIRECTORY: dataDirectory, APP_URL: "http://localhost:3137", SESSION_SECRET: "test-session-secret-not-for-production-123456", ADMIN_PASSWORD: "test-admin-not-for-production" } },
});
