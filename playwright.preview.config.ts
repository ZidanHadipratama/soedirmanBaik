import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

export default defineConfig({
  testDir: "./tests/preview", fullyParallel: false, workers: 1, timeout: 45000,
  expect: { timeout: 10000 }, reporter: "list", outputDir: "test-results/preview",
  use: { baseURL: "http://localhost:3138", trace: "retain-on-failure", screenshot: "only-on-failure", launchOptions: { executablePath: existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined } },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: { command: "npm run start:preview", url: "http://localhost:3138", reuseExistingServer: false, timeout: 15000 },
});
