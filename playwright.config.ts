import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

// В CI гоняем e2e против production-сборки (vite preview), а не dev-сервера.
// Причина: под Vite dev Monaco тянет 2300+ ESM-модулей по отдельности, что в
// headless-CI дросселирует event loop и тормозит игровой game loop — дрон не
// успевает добыть руду за отведённое время. Собранный бандл отдаёт Monaco
// готовыми чанками и заодно ближе к тому, во что реально играет пользователь.
// Локально оставляем dev-сервер ради быстрой итерации (HMR).
//
// Production-сборка использует base "/drone-protocol/" (см. vite.config.ts),
// поэтому baseURL в CI включает этот префикс.
const PORT = isCI ? 4173 : 5174;
const BASE_PATH = isCI ? "/drone-protocol/" : "/";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // В CI Playwright сам подбирает workers по числу CPU; локально ограничиваем 3,
  // чтобы параллельный запуск Phaser не перегружал машину.
  workers: isCI ? undefined : 3,
  // В CI один ретрай + HTML-отчёт рядом со списком — чтобы при падении
  // остался трейс и отчёт для выгрузки в артефакты.
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
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
    command: isCI
      ? `npm run preview -- --port ${PORT} --base ${BASE_PATH}`
      : `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !isCI,
    // Сборка перед preview уже выполнена отдельным шагом CI; подъём preview быстрый.
    timeout: 30_000,
  },
});
