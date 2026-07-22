import { test, expect } from '@playwright/test';
import { guardian, guardianCaptureFailure, waitForAppReady } from '../helpers/guardian-log';

test.describe('SAOS Dashboard (functional)', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      await guardianCaptureFailure(page, testInfo.title);
    }
  });

  test('manager dashboard route initializes with gated content', async ({ page }) => {
    guardian.step('Opening SAOS dashboard');
    await page.goto('/saos-dashboard.html');
    await waitForAppReady(page);

    await expect(page.getByRole('heading', { name: 'Strategic Account OS' })).toBeVisible();

    const dashboardContent = page.locator('#saos-dashboard-content');
    const accessDenied = page.locator('#saos-access-denied');
    const visibleState = await Promise.race([
      dashboardContent.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'dashboard'),
      accessDenied.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'denied'),
    ]);

    if (visibleState === 'dashboard') {
      await expect(page.locator('#saos-kpi-grid')).toBeVisible();
      await expect(page.locator('#saos-account-list')).toBeVisible();
    } else {
      await expect(accessDenied).toContainText('Manager access required');
    }
  });
});
