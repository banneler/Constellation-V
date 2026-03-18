import { test, expect } from '@playwright/test';
import { guardian, guardianCaptureFailure } from '../helpers/guardian-log';
import { ProposalsPage } from '../pages/proposals.page';

test.describe('Proposals (functional)', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      await guardianCaptureFailure(page, testInfo.title);
    }
  });

  test('proposal module toggles update main UI; properties filled', async ({ page }) => {
    const p = new ProposalsPage(page);
    guardian.step('Loading Proposals builder');
    await p.goto();

    const impactToggle = page.locator('#toggle-impact-roi');
    await impactToggle.scrollIntoViewIfNeeded();
    guardian.step('Enabling Impact & ROI module');
    await impactToggle.check({ force: true });
    await page.locator('#toggle-impact-roi').dispatchEvent('change');
    await expect(p.impactRoiSection()).toBeVisible({ timeout: 12_000 });

    const customToggle = page.locator('#toggle-custom-text');
    await customToggle.scrollIntoViewIfNeeded();
    guardian.step('Enabling Custom Page module');
    await customToggle.check({ force: true });
    await customToggle.dispatchEvent('change');
    await expect(p.customTextSection()).toBeVisible({ timeout: 12_000 });

    guardian.step('Filling RFP / Business name');
    await p.fillProposalProperties(`RFP ${Date.now()}`, 'E2E Business');
    await expect(p.globalRfp()).toHaveValue(/RFP/);
    await expect(p.globalBiz()).toHaveValue('E2E Business');
  });
});
