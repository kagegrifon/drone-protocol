import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers (copied from subprogram-highlight.spec.ts)
// ---------------------------------------------------------------------------

async function skipIntro(page: Page) {
  await page.getByRole("button", { name: "Press Start" }).click();
}

async function startMission(page: Page, index: number) {
  await page.locator(`[data-testid="mission-card-${index}"]`).click();
  await page.getByRole("button", { name: "ЗАПУСТИТЬ" }).click();
}

async function waitForGame(page: Page) {
  await expect(page.getByRole("button", { name: /Play/i })).toBeVisible({
    timeout: 30_000,
  });
}

async function selectFirstDrone(page: Page) {
  const firstDrone = page.locator('[data-testid^="drone-item-"]').first();
  await firstDrone.waitFor({ state: "visible", timeout: 20_000 });
  await firstDrone.click();
}

async function createProgram(page: Page, name: string): Promise<string> {
  await page.getByRole("button", { name: "LIBRARY" }).click();
  await page.getByPlaceholder("program name").fill(name);
  await page.getByRole("button", { name: "+ New" }).click();

  // После создания UI автопереходит на вкладку PROGRAM (см. коммит 3cacf78), где
  // кнопок program-edit-btn нет. Возвращаемся в LIBRARY, чтобы получить id программы.
  await page.getByRole("button", { name: "LIBRARY" }).click();
  const editBtn = page.locator(`[data-testid^="program-edit-btn-"]`, {
    hasText: name,
  });
  await editBtn.waitFor({ state: "visible", timeout: 5_000 });
  const testId = await editBtn.getAttribute("data-testid");
  return testId!.replace("program-edit-btn-", "");
}

async function setProgramCode(page: Page, programId: string, code: string) {
  await page.getByRole("button", { name: "LIBRARY" }).click();
  await page.locator(`[data-testid="program-edit-btn-${programId}"]`).click();

  const editor = page.locator(".monaco-editor").first();
  await editor.waitFor({ state: "visible", timeout: 15_000 });
  await editor.click();
  await page.keyboard.press("Control+a");
  await page.evaluate((c) => navigator.clipboard.writeText(c), code);
  await page.keyboard.press("Control+v");

  await page.locator("[data-testid='code-apply']").click();
}

// ---------------------------------------------------------------------------
// Programs (same shape as subprogram-highlight: main imports harvest module)
// ---------------------------------------------------------------------------

const HARVEST_MODULE = `export async function harvest() {
  while (self.inventory < self.inventoryMax) {
    await self.moveTo(World.mines[0].position);
    await self.mine();
  }
  while (self.inventory > 0) {
    await self.moveTo(World.bases[0].position);
    await self.drop();
  }
}`;

const MAIN_PROGRAM = `import { harvest } from "harvest";
while (true) {
  await harvest();
}`;

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.use({
  permissions: ["clipboard-read", "clipboard-write"],
});

test(
  "стек вызовов: крошки модуля, read-only превью подпрограммы, возврат по клику",
  async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await skipIntro(page);
    await startMission(page, 0);
    await waitForGame(page);
    await selectFirstDrone(page);

    const harvestId = await createProgram(page, "harvest");
    await setProgramCode(page, harvestId, HARVEST_MODULE);

    const mainId = await createProgram(page, "main");
    await setProgramCode(page, mainId, MAIN_PROGRAM);

    // Назначаем main выбранному дрону.
    await page.getByRole("button", { name: "LIBRARY" }).click();
    const mainRow = page
      .locator(`[data-testid="program-edit-btn-${mainId}"]`)
      .locator("xpath=..");
    await mainRow.getByRole("button", { name: "Assign" }).click();

    // На вкладке DRONE видны крошки стека и редактор с подсветкой.
    await page.getByRole("button", { name: "DRONE", exact: true }).click();

    await page.getByRole("button", { name: /Play/i }).click();

    // Во время исполнения внутри модуля видны ≥2 крошки: main ▸ harvest.
    const crumbOuter = page.locator('[data-testid="callstack-crumb-0"]');
    const crumbInner = page.locator('[data-testid="callstack-crumb-1"]');
    await expect(crumbOuter).toBeVisible({ timeout: 30_000 });
    await expect(crumbInner).toBeVisible({ timeout: 30_000 });

    // Внешняя крошка — вызывающая программа main, внутренняя — модуль harvest.
    await expect(crumbOuter).toContainText("main");
    await expect(crumbInner).toContainText("harvest");

    // Follow-режим: редактор автоматически показывает read-only код подпрограммы
    // (самый глубокий кадр — модуль) с подсветкой строки. Тело harvest содержит
    // уникальную строку self.inventory, которой нет в коде main.
    const highlightedLine = page.locator(".drone-line-highlight").first();
    await expect(highlightedLine).toBeVisible({ timeout: 30_000 });
    const firstEditor = page.locator(".monaco-editor").first();
    await expect(firstEditor).toContainText("self.inventory", {
      timeout: 10_000,
    });

    // Клик по внешней крошке (main) возвращает редактор к коду вызывающей программы.
    // Код main содержит уникальную строку import { harvest } from "harvest".
    await crumbOuter.click();
    await expect(firstEditor).toContainText('import { harvest }', {
      timeout: 10_000,
    });
  },
);
