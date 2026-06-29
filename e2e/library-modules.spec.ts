import { test, expect, type Page } from "@playwright/test";

// Пропускает интро-экран (кнопка «Press Start»)
async function skipIntro(page: Page) {
  await page.getByRole("button", { name: "Press Start" }).click();
}

// Запускает миссию с заданным индексом (0-based)
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

// Создаёт новую программу с заданным именем во вкладке LIBRARY и возвращает её id.
// id берётся из data-testid кнопки редактирования (program-edit-btn-<id>).
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

// Открывает программу в редакторе (вкладка PROGRAM), вставляет код через буфер
// обмена (insertText/type ломаются об автозакрытие скобок Monaco) и применяет.
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

// Модуль-библиотека: экспортирует функцию полного цикла добычи. self/World
// доступны в склеенном коде как замыкание — параметрами не передаются. moveTo
// зовётся рядом с действием в каждой итерации (один moveTo лишь задаёт путь).
const MINER_MODULE = `export async function harvest() {
  while (self.inventory < self.inventoryMax) {
    await self.moveTo(World.mines[0].position);
    await self.mine();
  }
  while (self.inventory > 0) {
    await self.moveTo(World.bases[0].position);
    await self.drop();
  }
}`;

const MAIN_PROGRAM = `import { harvest } from "miner";
while (true) {
  await harvest();
}`;

// Программа с импортом несуществующего модуля — линковка должна упасть.
const BROKEN_IMPORT = `import { nope } from "ghost-module";
await nope();`;

test.use({
  permissions: ["clipboard-read", "clipboard-write"],
});

test("программа-модуль импортируется в другую и дрон выполняет её", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await skipIntro(page);
  await startMission(page, 0);
  await waitForGame(page);
  await selectFirstDrone(page);

  // Модуль-библиотека с export-функцией.
  const minerId = await createProgram(page, "miner");
  await setProgramCode(page, minerId, MINER_MODULE);

  // В LIBRARY у модуля появляется бейдж «exports».
  await page.getByRole("button", { name: "LIBRARY" }).click();
  const minerRow = page
    .locator(`[data-testid="program-edit-btn-${minerId}"]`)
    .locator("xpath=..");
  await expect(minerRow.getByText("exports")).toBeVisible({ timeout: 5_000 });

  // Программа-потребитель, импортирующая модуль.
  const mainId = await createProgram(page, "main");
  await setProgramCode(page, mainId, MAIN_PROGRAM);

  // Назначаем main выбранному дрону и запускаем.
  await page.getByRole("button", { name: "LIBRARY" }).click();
  const mainRow = page
    .locator(`[data-testid="program-edit-btn-${mainId}"]`)
    .locator("xpath=..");
  await mainRow.getByRole("button", { name: "Assign" }).click();

  await page.getByRole("button", { name: /Play/i }).click();

  // Ошибок линковки/выполнения быть не должно.
  await expect(page.locator("text=/Error|SyntaxError/")).not.toBeVisible({
    timeout: 1_000,
  });

  // Дрон доезжает до шахты и добывает руду — ORE в инспекторе становится > 0.
  await expect(page.getByText(/^[1-9]\d*\/10$/)).toBeVisible({
    timeout: 50_000,
  });
});

test("импорт неизвестного модуля показывает ошибку линковки", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await skipIntro(page);
  await startMission(page, 0);
  await waitForGame(page);
  await selectFirstDrone(page);

  const brokenId = await createProgram(page, "broken");
  await setProgramCode(page, brokenId, BROKEN_IMPORT);

  // Назначаем дрону и запускаем — линковка падает на неизвестном specifier.
  await page.getByRole("button", { name: "LIBRARY" }).click();
  const brokenRow = page
    .locator(`[data-testid="program-edit-btn-${brokenId}"]`)
    .locator("xpath=..");
  await brokenRow.getByRole("button", { name: "Assign" }).click();

  await page.getByRole("button", { name: /Play/i }).click();

  // На вкладке DRONE у активной программы появляется бейдж ошибки «⚠»
  // с текстом про неизвестный модуль. exact — иначе матчит кнопку «drone-N ↗».
  await page.getByRole("button", { name: "DRONE", exact: true }).click();
  // Бейдж «⚠» с этим title показывается и в списке дронов, и в редакторе —
  // достаточно убедиться, что он есть.
  const errorBadge = page.locator('span[title*="ghost-module"]').first();
  await expect(errorBadge).toBeVisible({ timeout: 10_000 });
});
