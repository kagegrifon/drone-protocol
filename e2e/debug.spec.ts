import { test } from '@playwright/test';

test('debug: что на странице', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  const title = await page.title();
  const body = await page.locator('body').innerHTML();
  console.log('=== TITLE:', title);
  console.log('=== BODY (first 500):', body.slice(0, 500));
  console.log('=== LOGS:', logs.join('\n'));
  await page.screenshot({ path: 'test-results/debug.png' });
});
