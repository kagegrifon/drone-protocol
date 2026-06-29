import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers (copied from library-modules.spec.ts)
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
// Programs
// ---------------------------------------------------------------------------

// Submodule: loops mining so it keeps running long enough to observe the
// call-site highlight in the main program while harvest() body executes.
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

// Main program — line 3 ("  await harvest();") is the call site.
// While harvest() body executes the lineStack maps back to this line and
// drone.currentLine is set to 3, so the Monaco decoration appears on it.
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
  "call line in main stays highlighted while subprogram body executes",
  async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await skipIntro(page);
    await startMission(page, 0);
    await waitForGame(page);
    await selectFirstDrone(page);

    // Create the submodule library program.
    const harvestId = await createProgram(page, "harvest");
    await setProgramCode(page, harvestId, HARVEST_MODULE);

    // Create the main entry program that imports harvest.
    const mainId = await createProgram(page, "main");
    await setProgramCode(page, mainId, MAIN_PROGRAM);

    // Assign main to the selected drone.
    await page.getByRole("button", { name: "LIBRARY" }).click();
    const mainRow = page
      .locator(`[data-testid="program-edit-btn-${mainId}"]`)
      .locator("xpath=..");
    await mainRow.getByRole("button", { name: "Assign" }).click();

    // Switch back to the DRONE tab so the assigned-program code block with
    // highlightLine is visible (the LIBRARY tab editor does not pass highlightLine).
    await page.getByRole("button", { name: "DRONE", exact: true }).click();

    // Start the simulation.
    await page.getByRole("button", { name: /Play/i }).click();

    // The DRONE tab shows the assigned program's Monaco editor with the
    // drone-line-highlight decoration. The editor is expanded by default.
    // We wait up to 30 s for the drone to reach the mine and enter harvest().
    const editor = page.locator(".monaco-editor").first();
    await editor.waitFor({ state: "visible", timeout: 15_000 });

    const highlightedLine = editor.locator(".drone-line-highlight");
    await expect(highlightedLine).toBeVisible({ timeout: 30_000 });
  },
);
