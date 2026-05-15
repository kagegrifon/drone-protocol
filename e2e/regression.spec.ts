import { test, expect } from '@playwright/test';

// Ждём появления canvas Phaser с непустыми размерами
async function waitForCanvas(page: import('@playwright/test').Page) {
  const canvas = page.locator('canvas');
  await canvas.waitFor({ state: 'visible', timeout: 15_000 });
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);
}

// Пропускает интро-экран (кнопка «Press Start»)
async function skipIntro(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Press Start' }).click();
}

// Запускает миссию с заданным индексом (0-based)
async function startMission(page: import('@playwright/test').Page, index: number) {
  await page.locator(`[data-testid="mission-card-${index}"]`).click();
  await page.getByRole('button', { name: 'ЗАПУСТИТЬ' }).click();
}

// ─── БАГ 1: canvas уничтожался сразу после загрузки ──────────────────────────
//
// До фикса: useEffect-cleanup вызывал ctrl.destroy() при переходе
// loading→game, Phaser уничтожался, canvas оставался пустым.
// После фикса: cleanup вынесен в отдельный unmount-эффект.

test('Bug 1: canvas виден и имеет размер после загрузки миссии', async ({ page }) => {
  await page.goto('/');
  await skipIntro(page);
  await startMission(page, 0);

  await waitForCanvas(page);

  // Sidebar (SimControls) тоже должен появиться — он рендерится только
  // в gamePhase === 'game', т.е. только после успешного onReady от Phaser
  await expect(page.getByRole('button', { name: /Play/i })).toBeVisible({ timeout: 15_000 });
});

// ─── БАГ 2: утечка слушателей gameEvents при смене миссии ────────────────────
//
// До фикса: при уничтожении GameScene её слушатели gameEvents оставались.
// При запуске второй миссии оба набора слушателей срабатывали, старый
// AudioManager обращался к уже уничтоженному Phaser → console error с 'cache'.
// После фикса: gameEvents.clearAll() вызывается в destroy() и initWorld().

test('Bug 2: нет console-ошибок при переключении миссий и запуске симуляции', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await skipIntro(page);

  // Запуск миссии 1
  await startMission(page, 0);
  await waitForCanvas(page);

  // Возврат к выбору миссий через модалку настроек
  await page.getByTitle('Настройки').click();
  await page.getByRole('button', { name: '← ВЫБОР МИССИЙ' }).click();
  await expect(page.getByRole('button', { name: 'ЗАПУСТИТЬ' })).toBeVisible();

  // Запуск миссии 3
  await startMission(page, 2);
  await waitForCanvas(page);

  // Запускаем симуляцию, чтобы сработали игровые события (ore:mined и др.)
  await page.getByRole('button', { name: /Play/i }).click();
  await page.waitForTimeout(1_500);

  const cacheErrors = errors.filter((e) => e.includes('cache') || e.includes('null'));
  expect(cacheErrors, `Обнаружены ошибки: ${cacheErrors.join('\n')}`).toHaveLength(0);
});

// ─── БАГ 3: тики не сбрасывались при reset/смене миссии ──────────────────────
//
// До фикса: store.init() не сбрасывал _tickCount и stats.
// После reset или смены миссии счётчик тиков продолжал с прежнего значения.
// После фикса: init() явно обнуляет _tickCount и stats.

test('Bug 3: счётчик тиков сбрасывается в 0 при смене миссии', async ({ page }) => {
  await page.goto('/');
  await skipIntro(page);

  // Запуск миссии 1
  await startMission(page, 0);
  await waitForCanvas(page);

  // Проверяем, что начальное значение — 0
  await expect(page.getByText('Tick: 0')).toBeVisible();

  // Делаем несколько шагов симуляции
  const stepBtn = page.getByRole('button', { name: /Step/i });
  await stepBtn.click();
  await stepBtn.click();
  await stepBtn.click();
  await expect(page.getByText('Tick: 3')).toBeVisible();

  // Возвращаемся и запускаем другую миссию через модалку настроек
  await page.getByTitle('Настройки').click();
  await page.getByRole('button', { name: '← ВЫБОР МИССИЙ' }).click();
  await expect(page.getByRole('button', { name: 'ЗАПУСТИТЬ' })).toBeVisible();

  await startMission(page, 1);
  await waitForCanvas(page);

  // Счётчик должен сброситься в 0, а не продолжаться с 3
  await expect(page.getByText('Tick: 0')).toBeVisible();
});
