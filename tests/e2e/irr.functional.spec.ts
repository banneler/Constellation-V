import { test, expect } from '@playwright/test';
import { guardian, guardianCaptureFailure } from '../helpers/guardian-log';
import { IrrPage } from '../pages/irr.page';

test.describe('IRR calculator (functional)', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      await guardianCaptureFailure(page, testInfo.title);
    }
  });

  test('changing site MRR recomputes global aggregates', async ({ page }) => {
    const irr = new IrrPage(page);
    guardian.step('Opening Multi-Site IRR');
    await irr.goto();

    await page.locator('#site-forms-container .mrr-input').first().scrollIntoViewIfNeeded();
    const before = (await irr.globalTcv().textContent())?.trim() ?? '';
    guardian.step(`Baseline TCV: ${before}`);

    guardian.step('Setting MRR to 99999 then 5000 — expect TCV to change');
    const mrr = page.locator('#site-forms-container .mrr-input').first();
    await mrr.fill('99999');
    await mrr.dispatchEvent('input');
    await expect
      .poll(async () => (await irr.globalTcv().textContent())?.trim(), { timeout: 10_000 })
      .not.toBe(before);

    await mrr.fill('5000');
    await mrr.dispatchEvent('input');
    await page.waitForTimeout(600);

    await expect(irr.globalTcv()).not.toHaveText('$0');
    const irrText = await irr.globalAnnualIrr().textContent();
    expect(irrText).toMatch(/%|pending|--/i);
  });
});
