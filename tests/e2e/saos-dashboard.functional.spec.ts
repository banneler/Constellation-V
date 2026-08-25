import { test, expect } from '@playwright/test';
import { guardian, guardianCaptureFailure, waitForAppReady } from '../helpers/guardian-log';

test.describe('SAOS Dashboard (functional)', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      await guardianCaptureFailure(page, testInfo.title);
    }
  });

  test('authenticated navigation exposes the role-scoped SAOS dashboard', async ({ page }) => {
    page.on('pageerror', (error) => console.error(`[SAOS page error] ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') console.error(`[SAOS console error] ${message.text()}`);
    });
    guardian.step('Opening SAOS dashboard');
    await page.goto('/saos-dashboard.html');
    await waitForAppReady(page);

    await expect(page.getByRole('heading', { name: 'Strategic Account OS' })).toBeVisible();
    await expect(page.locator('a[href="saos-dashboard.html"]')).toBeVisible();
    await expect(page.locator('#saos-dashboard-content')).toBeVisible();
    await expect(page.locator('#saos-kpi-grid')).toBeVisible();
    await expect(page.locator('#saos-account-list')).toBeVisible();

    const isManager = await page.locator('#manager-view-select-wrap').count() > 0;
    if (isManager) {
      await expect(page.locator('#saos-view-eyebrow')).toHaveText('Manager View');
      await expect(page.locator('#saos-list-title')).toHaveText('Team SAOS Plans');
      await expect(page.locator('#saos-owner-filter-wrap')).toBeVisible();
    } else {
      await expect(page.locator('#saos-view-eyebrow')).toHaveText('My Workspace');
      await expect(page.locator('#saos-list-title')).toHaveText('My SAOS Plans');
      await expect(page.locator('#saos-owner-filter-wrap')).toBeHidden();
    }
  });

  test('an inaccessible account deep link is rejected before SAOS is queried', async ({ page }) => {
    const invalidAccountId = '999999999';
    const accountPlanRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/rest/v1/account_plans')) {
        accountPlanRequests.push(request.url());
      }
    });

    await page.goto(`/accounts.html?accountId=${invalidAccountId}&saos=1`);
    await waitForAppReady(page);

    await expect(page).not.toHaveURL(new RegExp(`accountId=${invalidAccountId}`));
    expect(accountPlanRequests.some((url) => url.includes(invalidAccountId))).toBe(false);
  });
});
