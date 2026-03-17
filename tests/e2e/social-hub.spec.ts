import { test, expect } from '@playwright/test';
import { guardianRun } from '../helpers/guardian-log';
import { SocialHubPage } from '../pages/social-hub.page';

test.describe('Social Hub', () => {
  test('feeds and page chrome', async ({ page }) => {
    const sh = new SocialHubPage(page);
    await guardianRun(page, 'goto social hub', () => sh.goto());

    await guardianRun(page, 'Social Hub heading', async () => {
      await expect(page.getByRole('heading', { name: 'Social Hub' })).toBeVisible();
    });

    await guardianRun(page, 'AI articles container', async () => {
      await expect(sh.aiArticles()).toBeAttached();
    });

    await guardianRun(page, 'marketing posts container', async () => {
      await expect(sh.marketingPosts()).toBeAttached();
    });
  });
});
