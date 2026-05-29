import { test, expect } from '@playwright/test';

async function skipIntro(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Press Start' }).click();
}

async function waitForCanvas(page: import('@playwright/test').Page) {
  const canvas = page.locator('canvas');
  await canvas.waitFor({ state: 'visible', timeout: 15_000 });
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);
}

test('MOVE_TO picker: выбор и смена цели', async ({ page }) => {
  await page.goto('/');
  await skipIntro(page);

  // Запустить миссию 3 (индекс 2): 2 дрона, Mine 1, Mine 2, Base, Charger 1, Charger 2
  await page.locator('[data-testid="mission-card-2"]').click();
  await page.getByRole('button', { name: 'ЗАПУСТИТЬ' }).click();
  await waitForCanvas(page);

  // Выбрать первого дрона из списка
  const droneItem = page.locator('[data-testid^="drone-item-"]').first();
  await droneItem.click();

  // Перейти к редактированию назначенной библиотечной программы (LIBRARY → имя программы → PROGRAM)
  await page.getByTitle('Открыть в библиотеке').click();
  await page.locator('[data-testid^="program-edit-btn-"]').first().click();

  // MOVE_TO блок должен быть виден — найти тоггл пикера
  const toggle = page.locator('[data-testid="move-to-toggle"]').first();
  await expect(toggle).toBeVisible({ timeout: 5_000 });

  // Открыть пикер
  await toggle.click();

  // Пикер должен показать список объектов
  await expect(page.locator('[data-testid^="move-to-option-"]').first()).toBeVisible();

  // Выбрать "Mine 2"
  const mine2Option = page.locator('[data-testid="move-to-option-Mine 2"]');
  await mine2Option.click();

  // Пикер закрылся, метка обновилась
  await expect(page.locator('[data-testid^="move-to-option-"]')).not.toBeVisible();
  await expect(toggle).toHaveText(/Mine 2/);

  // Убедиться, что цель можно поменять снова
  await toggle.click();
  await expect(page.locator('[data-testid="move-to-option-Mine 1"]')).toBeVisible();
  await page.locator('[data-testid="move-to-option-Mine 1"]').click();
  await expect(toggle).toHaveText(/Mine 1/);
});
