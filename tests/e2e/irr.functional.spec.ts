import { test, expect } from '@playwright/test';
import { guardian } from '../helpers/guardian-log';
import { IrrPage } from '../pages/irr.page';

test.describe('IRR calculator (functional)', () => {
  test('changing site MRR recomputes global aggregates', async ({ page }) => {
    const irr = new IrrPage(page);
    guardian.step('Opening Multi-Site IRR');
    await irr.goto();

    const before = await irr.globalTcv().textContent();
    guardian.step(`Baseline TCV: ${before}`);

    guardian.step('Increasing MRR on first site — expecting TCV / capital to update');
    await irr.calculateIRRByMrrChange('8000');
    await page.waitForTimeout(800);

    const after = await irr.globalTcv().textContent();
    expect(after).not.toBe(before);
    await expect(irr.globalTcv()).not.toHaveText('$0');
    const irrText = await irr.globalAnnualIrr().textContent();
    expect(irrText).toMatch(/%|pending|--/i);
  });
});
