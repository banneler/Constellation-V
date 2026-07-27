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

  test('free months preserve paid TCV while applying MCOS drag and global overwrite confirmation', async ({ page }) => {
    const irr = new IrrPage(page);
    guardian.step('Opening Multi-Site IRR for free-month promo test');
    await irr.goto();

    const firstSite = page.locator('#site-forms-container .site-form-wrapper').first();
    await firstSite.locator('.construction-cost-input').fill('10000');
    await firstSite.locator('.construction-cost-input').dispatchEvent('input');
    await firstSite.locator('.monthly-cost-input').fill('1000');
    await firstSite.locator('.monthly-cost-input').dispatchEvent('input');
    await firstSite.locator('.mrr-input').fill('5000');
    await firstSite.locator('.mrr-input').dispatchEvent('input');
    await firstSite.locator('.term-input').fill('36');
    await firstSite.locator('.term-input').dispatchEvent('input');

    await expect(irr.globalTcv()).toHaveText('$180,000');
    await expect(page.locator('#global-mrc')).toHaveText('$5,000');
    const npvBefore = Number(((await page.locator('#global-npv').textContent()) || '').replace(/[$,]/g, ''));

    guardian.step('Enabling two free months on the first site');
    await firstSite.locator('.free-months-toggle').check();
    await firstSite.locator('select.free-months-select').selectOption('2');

    await expect(irr.globalTcv()).toHaveText('$180,000');
    await expect(page.locator('#global-mrc')).toHaveText('$5,000');
    const npvAfter = Number(((await page.locator('#global-npv').textContent()) || '').replace(/[$,]/g, ''));
    expect(npvAfter).toBeLessThan(npvBefore);

    guardian.step('Creating conflicting site-level promo settings');
    await page.locator('#add-site-btn').click();
    const secondSite = page.locator('#site-forms-container .site-form-wrapper').nth(1);
    await secondSite.locator('.free-months-toggle').check();
    await secondSite.locator('select.free-months-select').selectOption('3');

    guardian.step('Global promo toggle should confirm overwrite of site settings');
    await page.locator('#global-free-months-toggle').check();
    await expect(page.locator('#modal-title')).toHaveText('Overwrite Site Promo Settings?');
    await page.locator('#modal-confirm-btn').click();

    await expect(firstSite.locator('select.free-months-select')).toHaveValue('1');
    await expect(secondSite.locator('select.free-months-select')).toHaveValue('1');
  });
});
