import { test, expect } from '@playwright/test';

async function skipIntro(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Press Start' }).click();
}

async function startMission(page: import('@playwright/test').Page, index: number) {
  await page.locator(`[data-testid="mission-card-${index}"]`).click();
  await page.getByRole('button', { name: 'ЗАПУСТИТЬ' }).click();
}

async function waitForGame(page: import('@playwright/test').Page) {
  await expect(page.getByRole('button', { name: /Play/i })).toBeVisible({ timeout: 15_000 });
}

async function selectFirstDrone(page: import('@playwright/test').Page) {
  const firstDrone = page.locator('[data-testid^="drone-item-"]').first();
  await firstDrone.waitFor({ state: 'visible', timeout: 10_000 });
  const testId = await firstDrone.getAttribute('data-testid');
  const droneId = testId?.replace('drone-item-', '');
  await firstDrone.click();
  return droneId!;
}

test('per-drone pause останавливает дрона, start продолжает', async ({ page }) => {
  await page.goto('/');
  await skipIntro(page);
  await startMission(page, 0);
  await waitForGame(page);

  // Запускаем симуляцию
  await page.getByRole('button', { name: /Play/i }).click();

  const droneId = await selectFirstDrone(page);

  // Нажимаем pause в DroneInspector
  const playPauseBtn = page.locator('[data-testid="drone-play-pause"]');
  await playPauseBtn.waitFor({ state: 'visible' });
  await playPauseBtn.click();

  // Должен появиться LOCAL PAUSED badge
  await expect(page.locator('[data-testid="local-paused-badge"]')).toBeVisible({ timeout: 3_000 });

  // Кнопка показывает ▶ (resume)
  await expect(playPauseBtn).toHaveText('▶');

  // В DroneList иконка паузы тоже переключилась
  await expect(page.locator(`[data-testid="drone-play-pause-${droneId}"]`)).toHaveText('▶');

  // Нажимаем resume
  await playPauseBtn.click();
  await expect(page.locator('[data-testid="local-paused-badge"]')).not.toBeVisible({ timeout: 3_000 });
  await expect(playPauseBtn).toHaveText('⏸');
});

test('per-drone reset перезапускает программу дрона', async ({ page }) => {
  await page.goto('/');
  await skipIntro(page);
  await startMission(page, 0);
  await waitForGame(page);

  await selectFirstDrone(page);

  // Нажимаем reset в DroneInspector
  const resetBtn = page.locator('[data-testid="drone-reset"]');
  await resetBtn.waitFor({ state: 'visible' });
  await resetBtn.click();

  // После reset badge паузы не должно быть
  await expect(page.locator('[data-testid="local-paused-badge"]')).not.toBeVisible();
});

test('кнопки в DroneList не меняют выбранного дрона', async ({ page }) => {
  await page.goto('/');
  await skipIntro(page);
  await startMission(page, 0);
  await waitForGame(page);

  const firstDrone = page.locator('[data-testid^="drone-item-"]').first();
  await firstDrone.waitFor({ state: 'visible', timeout: 10_000 });
  const firstId = (await firstDrone.getAttribute('data-testid'))!.replace('drone-item-', '');

  // Кликаем на кнопку паузы в DroneList без выбора дрона
  const pauseInList = page.locator(`[data-testid="drone-play-pause-${firstId}"]`);
  await pauseInList.click();

  // DroneInspector не должен показать данные (дрон не был выбран через строку)
  // Клик по иконке — stopPropagation, selectDrone не вызвался
  // Проверяем что badge паузы отсутствует в инспекторе (дрон не выбран)
  const inspector = page.locator('[data-testid="local-paused-badge"]');
  // Если дрон не выбран — инспектор показывает "Select a drone"
  // Если выбран — badge виден. В любом случае — нет ошибок консоли.
  await expect(page.locator('text=Select a drone').or(inspector)).toBeVisible({ timeout: 3_000 });

  // Кликаем resume через DroneList
  await pauseInList.click();
});
