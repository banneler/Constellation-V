import { test, expect } from '@playwright/test';
import { guardian, guardianCaptureFailure } from '../helpers/guardian-log';
import { CampaignsPage } from '../pages/campaigns.page';

test.describe('Campaigns (functional)', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      await guardianCaptureFailure(page, testInfo.title);
    }
  });
  test('selecting email template shows preview UI', async ({ page }) => {
    const c = new CampaignsPage(page);
    guardian.step('Opening Campaigns');
    await c.goto();

    guardian.step('Switching to Email Merge + Use Template');
    await c.selectEmailTemplateFlow();

    const optCount = await c.templateSelector().locator('option').count();
    if (optCount <= 1) {
      guardian.step('Skipping — no templates in org (need email_templates rows)');
      test.skip();
      return;
    }

    guardian.step('Selecting first template — expect subject/body preview');
    await c.selectFirstAvailableTemplate();
    await expect(c.templateEmailPreview()).toBeVisible({ timeout: 10_000 });
    await expect(c.previewTemplateSubject()).not.toBeEmpty();
  });
});
