import { test, expect } from '@playwright/test';
import { guardian, guardianCaptureFailure } from '../helpers/guardian-log';
import { CampaignsPage } from '../pages/campaigns.page';

test.describe('Campaigns (functional)', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      await guardianCaptureFailure(page, testInfo.title);
    }
  });
  test('selecting Guided Email shows email builder UI', async ({ page }) => {
    const c = new CampaignsPage(page);
    guardian.step('Opening Campaigns');
    await c.goto();

    guardian.step('Switching to Guided Email campaign type');
    await c.selectGuidedEmailFlow();

    await expect(c.emailSubject()).toBeVisible({ timeout: 10_000 });
    await expect(c.emailBody()).toBeVisible({ timeout: 10_000 });
  });
});
