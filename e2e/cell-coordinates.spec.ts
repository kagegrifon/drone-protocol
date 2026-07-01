import { test, expect, type Page } from "@playwright/test";

async function skipIntro(page: Page) {
  await page.getByRole("button", { name: "Press Start" }).click();
}

async function startMission(page: Page, index: number) {
  const missionCard = page.locator(`[data-testid="mission-card-${index}"]`);
  await missionCard.waitFor({ state: "visible", timeout: 10_000 });
  await missionCard.click();
  await page.getByRole("button", { name: "ЗАПУСТИТЬ" }).click();
}

async function waitForGame(page: Page) {
  await expect(page.getByRole("button", { name: /Play/i })).toBeVisible({
    timeout: 30_000,
  });
}

async function enterGame(page: Page) {
  await page.goto("");
  await skipIntro(page);
  await startMission(page, 0);
  await waitForGame(page);
}

/**
 * Точка в верхней четверти канваса над полем.
 * BottomPanel занимает нижние 50% (DEFAULT_HEIGHT=360 при 720px), поэтому
 * держимся выше — в верхних 25%.
 */
function playfieldPoint(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height * 0.25,
  };
}

async function clickPlayfield(page: Page) {
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas not found");
  const { x, y } = playfieldPoint(box);
  await page.mouse.click(x, y);
}

test("клик по клетке показывает координаты в INSPECTOR и копирует {x,y}", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await enterGame(page);

  await clickPlayfield(page);

  const inspector = page.locator('[data-testid="cell-inspector"]');
  await expect(inspector).toBeVisible({ timeout: 5_000 });
  await expect(
    page.locator('[data-testid="cell-inspector-pos"]'),
  ).toContainText(/x:\s*\d+\s*y:\s*\d+/);

  await page.locator('[data-testid="cell-inspector-copy"]').click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toMatch(/^\{ x: \d+, y: \d+ \}$/);
});

test("выбор дрона и клетки взаимоисключающи", async ({ page }) => {
  await enterGame(page);

  // Выбираем дрона в списке → INSPECTOR показывает дрона, не клетку.
  await page.locator('[data-testid^="drone-item-"]').first().click();
  await expect(page.locator('[data-testid="drone-play-pause"]')).toBeVisible();
  await expect(page.locator('[data-testid="cell-inspector"]')).toBeHidden();

  // Клик по клетке поля → дрон сбрасывается, показывается клетка.
  await clickPlayfield(page);
  await expect(page.locator('[data-testid="cell-inspector"]')).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.locator('[data-testid="drone-play-pause"]')).toBeHidden();
});

// TODO(tech-debt): добавить e2e на клик по спрайту дрона/здания на канвасе
// (регрессия для "выбор дрона не переходит на клетку" и REF-копирования).
// Актуальный zoom camera (minZoom считается из viewport/worldSize в рантайме)
// не даёт надёжно предсказать экранные координаты спрайта без доступа к
// Phaser-инстансу из теста — нужен debug-хук или computed-локатор по цвету.
