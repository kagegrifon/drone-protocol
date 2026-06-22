import { test, expect } from "@playwright/test";

// Пропускает интро-экран (кнопка «Press Start»)
async function skipIntro(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Press Start" }).click();
}

// Запускает миссию с заданным индексом (0-based)
async function startMission(
  page: import("@playwright/test").Page,
  index: number,
) {
  await page.locator(`[data-testid="mission-card-${index}"]`).click();
  await page.getByRole("button", { name: "ЗАПУСТИТЬ" }).click();
}

async function waitForGame(page: import("@playwright/test").Page) {
  await expect(page.getByRole("button", { name: /Play/i })).toBeVisible({
    timeout: 30_000,
  });
}

async function selectFirstDrone(page: import("@playwright/test").Page) {
  const firstDrone = page.locator('[data-testid^="drone-item-"]').first();
  await firstDrone.waitFor({ state: "visible", timeout: 20_000 });
  await firstDrone.click();
}

// Объектный World API: шахта/база берутся из World.mines[0]/World.bases[0],
// а moveTo ведёт строго к position сущности — числовые id больше не нужны.
// moveTo вызывается рядом с mine/drop в каждой итерации, чтобы дрон гарантированно
// доехал до цели перед действием (одного moveTo на дальнюю цель недостаточно —
// он лишь задаёт путь, а проезд занимает несколько тиков).
const MINING_CODE = `while (true) {
  while (self.inventory < self.inventoryMax) {
    await self.moveTo(World.mines[0].position);
    await self.mine();
  }
  while (self.inventory > 0) {
    await self.moveTo(World.bases[0].position);
    await self.drop();
  }
}`;

test.use({
  permissions: ["clipboard-read", "clipboard-write"],
});

test("ввод кода в Code Mode → запуск миссии → дрон добывает руду", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await skipIntro(page);
  await startMission(page, 0);
  await waitForGame(page);

  await selectFirstDrone(page);

  // Вкладка DRONE по умолчанию активна, ждём появления Monaco
  const editor = page.locator(".monaco-editor").first();
  await editor.waitFor({ state: "visible", timeout: 15_000 });

  // Вводим код добычи в редактор через буфер обмена — insertText/type()
  // проходят через автозакрытие скобок и автоотступы Monaco и дублируют
  // символы при многострочном вводе.
  await editor.click();
  await page.keyboard.press("Control+a");
  await page.evaluate((code) => navigator.clipboard.writeText(code), MINING_CODE);
  await page.keyboard.press("Control+v");

  // Запускаем симуляцию
  await page.getByRole("button", { name: /Play/i }).click();

  // Ошибок выполнения кода быть не должно
  await expect(page.locator("text=/Error|SyntaxError/")).not.toBeVisible({
    timeout: 1_000,
  });

  // Дрон доезжает до шахты и добывает руду — ORE в инспекторе становится > 0
  await expect(page.getByText(/^[1-9]\d*\/10$/)).toBeVisible({
    timeout: 50_000,
  });
});
