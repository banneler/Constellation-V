import { expect, type Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/guardian-log';

/** Patterns treated as non-blocking noise in browser console. */
export function isBenignConsoleMessage(text: string): boolean {
  const m = text.toLowerCase();
  if (m.includes('favicon')) return true;
  if (m.includes('resizeobserver')) return true;
  if (m.includes('.map')) return true; // source map 404s
  if (m.includes('source map')) return true;
  return false;
}

export function attachConsoleErrorCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    errors.push(`[pageerror] ${err.message}`);
  });
  return errors;
}

export async function waitForCrmLoaderIfPresent(page: Page): Promise<void> {
  const n = await page.locator('#global-loader-overlay').count();
  if (n > 0) await waitForAppReady(page);
}

export async function assertTitleConstellation(page: Page): Promise<void> {
  await expect(page).toHaveTitle(/Constellation/i);
}

export function assertNoCriticalConsoleErrors(errors: string[]): void {
  const critical = errors.filter((e) => !isBenignConsoleMessage(e));
  expect(critical, `Critical console errors:\n${critical.join('\n')}`).toEqual([]);
}

export async function runSmoke(
  page: Page,
  path: string,
  options: { shell: 'nav' | 'auth' }
): Promise<void> {
  const errors = attachConsoleErrorCollector(page);
  await page.goto(`/${path}`, { waitUntil: 'load', timeout: 60_000 });
  await waitForCrmLoaderIfPresent(page);
  await page.waitForTimeout(1000);

  await assertTitleConstellation(page);
  if (options.shell === 'nav') {
    await expect(page.locator('nav.nav-sidebar')).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(page.locator('#auth-container')).toBeVisible({ timeout: 15_000 });
  }
  assertNoCriticalConsoleErrors(errors);
}
