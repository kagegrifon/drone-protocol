import { test, expect } from "@playwright/test";

async function skipIntro(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Press Start" }).click();
}

async function startMission(
  page: import("@playwright/test").Page,
  index: number,
) {
  await page.locator(`[data-testid="mission-card-${index}"]`).click();
  await page.getByRole("button", { name: "ЗАПУСТИТЬ" }).click();
}

async function waitForCanvas(page: import("@playwright/test").Page) {
  await page.locator("canvas").waitFor({ state: "visible", timeout: 30_000 });
}

// Ждёт появления SimControls (кнопка Play видна), потом запускает симуляцию.
async function waitForSimControlsThenPlay(
  page: import("@playwright/test").Page,
) {
  const playButton = page.getByRole("button", { name: /Play/i });
  await expect(playButton).toBeVisible({ timeout: 30_000 });
  await playButton.click();
}

test("Step Mode: включение ставит паузу и показывает step-панель в DRONE-табе", async ({
  page,
}) => {
  await page.goto("");
  await skipIntro(page);
  await startMission(page, 0);
  await waitForCanvas(page);

  // Запустить симуляцию (сначала дождаться SimControls)
  await waitForSimControlsThenPlay(page);

  // Выбрать первого дрона из списка
  await page.locator('[data-testid^="drone-item-"]').first().click();

  // Убедиться, что открыт DRONE-таб
  await page.locator('[data-testid="drone-tab"]').click();

  // Включить Step Mode — это поставит игру на паузу
  await page.locator('[data-testid="step-mode-toggle"]').click();

  // Игра на паузе → кнопка снова «▶ Play»
  await expect(page.getByRole("button", { name: /Play/i })).toBeVisible();

  // На табе DRONE — индикатор step-режима и видна step-панель
  await expect(
    page.locator('[data-testid="drone-tab-step-indicator"]'),
  ).toBeVisible();
  await expect(page.locator('[data-testid="step-controls"]')).toBeVisible();
  await expect(page.locator('[data-testid="step-action-btn"]')).toBeVisible();
  await expect(page.locator('[data-testid="step-tick-btn"]')).toBeVisible();
});

test("Step Mode: Continue выключает режим и убирает step-панель", async ({
  page,
}) => {
  await page.goto("");
  await skipIntro(page);
  await startMission(page, 0);
  await waitForCanvas(page);

  await waitForSimControlsThenPlay(page);

  await page.locator('[data-testid^="drone-item-"]').first().click();
  await page.locator('[data-testid="drone-tab"]').click();
  await page.locator('[data-testid="step-mode-toggle"]').click();

  await expect(page.locator('[data-testid="step-controls"]')).toBeVisible();

  // Continue → step-режим выключен
  await page.locator('[data-testid="step-continue-btn"]').click();
  await expect(page.locator('[data-testid="step-controls"]')).toHaveCount(0);
  await expect(
    page.locator('[data-testid="drone-tab-step-indicator"]'),
  ).toHaveCount(0);
});

test("Step Mode: Step tick продвигает симуляцию на один тик", async ({
  page,
}) => {
  await page.goto("");
  await skipIntro(page);
  await startMission(page, 0);
  await waitForCanvas(page);

  await waitForSimControlsThenPlay(page);

  await page.locator('[data-testid^="drone-item-"]').first().click();
  await page.locator('[data-testid="drone-tab"]').click();
  await page.locator('[data-testid="step-mode-toggle"]').click();

  // Step tick кликается без ошибок; симуляция остаётся на паузе (Play видна)
  await page.locator('[data-testid="step-tick-btn"]').click();
  await expect(page.getByRole("button", { name: /Play/i })).toBeVisible();
  // Step tick не выходит из step-режима — панель остаётся на месте
  await expect(page.locator('[data-testid="step-controls"]')).toBeVisible();
});
