import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // В CI Playwright сам подбирает workers по числу CPU; локально ограничиваем 3,
  // чтобы параллельный запуск Phaser не перегружал машину.
  workers: process.env.CI ? undefined : 3,
  // В CI один ретрай + HTML-отчёт рядом со списком — чтобы при падении
  // остался трейс и отчёт для выгрузки в артефакты.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5174",
    screenshot: "only-on-failure",
    // Трейс на первом ретрае — даёт полную запись действий и DOM при падении.
    trace: "on-first-retry",
    // Разрешаем AudioContext без жеста пользователя
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5174",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
