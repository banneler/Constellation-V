import type { Page } from '@playwright/test';

/** Verbose step logging for Guardian / self-healing agents to trace failures in CI logs. */
export function guardianStep(step: string, detail?: string): void {
  const msg = detail ? `${step} — ${detail}` : step;
  console.log(`[Guardian E2E] ▶ ${msg}`);
}

/** Agentic breadcrumbs: `guardian.step('…')` in specs. */
export const guardian = { step: guardianStep };

export async function guardianScreenshot(page: Page, label: string): Promise<void> {
  try {
    await page.screenshot({ path: `test-results/guardian-${label}-${Date.now()}.png`, fullPage: true });
    console.log(`[Guardian E2E] 📷 Screenshot: ${label}`);
  } catch {
    console.log(`[Guardian E2E] ⚠ Screenshot failed: ${label}`);
  }
}

/** Wait until the CRM global loader overlay is inactive (shared_constants.hideGlobalLoader). */
export async function waitForAppReady(page: import('@playwright/test').Page, timeout = 90_000): Promise<void> {
  guardianStep('waitForAppReady', 'waiting for #global-loader-overlay to lose .active');
  await page.waitForFunction(
    () => {
      const el = document.getElementById('global-loader-overlay');
      return el && !el.classList.contains('active');
    },
    null,
    { timeout }
  );
}

/**
 * Run an async step; on failure log a clear reason and capture a Guardian screenshot
 * (in addition to Playwright’s built-in failure screenshot).
 */
export async function guardianRun<T>(
  page: import('@playwright/test').Page,
  stepLabel: string,
  fn: () => Promise<T>
): Promise<T> {
  guardianStep(stepLabel);
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : '';
    console.error(`[Guardian E2E] ✖ ${stepLabel}`);
    console.error(`[Guardian E2E]   Reason: ${msg}`);
    if (stack) console.error(`[Guardian E2E]   Trace: ${stack}`);
    const safe = stepLabel.replace(/[^a-z0-9]+/gi, '-').slice(0, 48);
    await guardianScreenshot(page, `fail-${safe}`);
    throw err;
  }
}
