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
 * Returns a point in the upper quarter of the canvas that is over the playfield.
 * The BottomPanel overlay starts at 50% canvas height (DEFAULT_HEIGHT=360 at 720px),
 * so we stay in the upper 25% to avoid it.
 */
function playfieldCenter(box: {
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

test("HUD координат появляется при наведении и исчезает при уходе", async ({
  page,
}) => {
  await enterGame(page);

  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas not found");

  // Навести в верхнюю четверть канваса (выше BottomPanel, которая занимает нижние 50%)
  const { x, y } = playfieldCenter(box);
  await page.mouse.move(x, y);

  const hud = page.locator('[data-testid="cell-coords-hud"]');
  await expect(hud).toBeVisible({ timeout: 5_000 });
  await expect(hud).toContainText(/x:\s*\d+\s+y:\s*\d+/);

  // Dispatch synthetic mouseout на canvas — имитирует уход курсора за пределы canvas.
  // Phaser слушает mouseout на canvas, вызывает setCanvasOut → emit "gameout" →
  // clearHover → hoveredCell=null → HUD скрывается.
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    canvas?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, cancelable: true }));
  });
  await expect(hud).toBeHidden({ timeout: 5_000 });
});

test("задержка ≥1с показывает попап, копирование кладёт {x,y} в буфер", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await enterGame(page);

  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas not found");

  // Навести в верхнюю четверть (выше BottomPanel)
  const { x, y } = playfieldCenter(box);
  await page.mouse.move(x, y);
  await expect(page.locator('[data-testid="cell-coords-hud"]')).toBeVisible({
    timeout: 5_000,
  });

  // Ждём появления попапа (таймер 1с)
  const popup = page.locator('[data-testid="cell-coords-popup"]');
  await expect(popup).toBeVisible({ timeout: 5_000 });

  // Кликаем кнопку через JS, не перемещая мышь: движение мыши к кнопке
  // (нижний правый угол) вызвало бы clearHover в Phaser → попап исчез бы.
  await page.evaluate(() => {
    const btn = document.querySelector(
      '[data-testid="cell-coords-copy"]',
    ) as HTMLButtonElement | null;
    btn?.click();
  });

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toMatch(/^\{ x: \d+, y: \d+ \}$/);
});
