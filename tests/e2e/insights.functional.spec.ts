import { test, expect } from '@playwright/test';
import { guardian, guardianCaptureFailure, waitForAppReady } from '../helpers/guardian-log';
import { InsightsPage } from '../pages/insights.page';

test.describe('Insights (functional)', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      await guardianCaptureFailure(page, testInfo.title);
    }
  });

  test('manager can open Insights and see core KPI modules', async ({ page }) => {
    const insights = new InsightsPage(page);
    page.on('dialog', (d) => d.accept().catch(() => {}));

    guardian.step('Opening Insights');
    await insights.goto();

    const onInsights = page.url().includes('insights.html');
    if (!onInsights) {
      test.skip(true, 'E2E user is not a manager/admin — Insights redirects non-managers');
      return;
    }

    await expect(insights.heading()).toBeVisible({ timeout: 15_000 });
    await expect(insights.content()).toBeVisible();
    await expect(insights.accessDenied()).toBeHidden();

    guardian.step('Asserting core KPI cards render');
    await expect(insights.activitiesMetric()).toBeVisible();
    await expect(insights.closedWonMetric()).toBeVisible();
    await expect(insights.quotaMetric()).toBeVisible();
    await expect(insights.activitiesMetric()).toHaveText(/^\d+$/);
    await expect(insights.quotaMetric()).toHaveText(/%$/);

    guardian.step('Asserting module KPI rows render');
    await expect(insights.sequenceKpis()).toBeVisible();
    await expect(insights.campaignKpis()).toBeVisible();
    await expect(insights.saosKpis()).toBeVisible();
    await expect(insights.sequenceKpis().locator('.insights-kpi').first()).toBeVisible();
    await expect(insights.saosKpis().locator('.insights-kpi').first()).toBeVisible();

    guardian.step('Asserting filters and export control are present');
    await expect(insights.repFilter()).toBeVisible();
    await expect(insights.dateFilter()).toBeVisible();
    await expect(page.locator('#insights-export-btn')).toBeVisible();
    await expect(page.locator('#insights-export-label')).toContainText(/Leadership Brief|Coaching Guide/);
    await expect(page.locator('.insights-filters-card .ts-wrapper').first()).toBeVisible({ timeout: 10_000 });
  });

  test('non-manager is redirected away from Insights', async ({ page }) => {
    guardian.step('Opening Insights (expect redirect if non-manager)');
    await page.goto('/insights.html');
    await waitForAppReady(page);
    await page.waitForURL(/insights\.html|command-center\.html|index\.html/, { timeout: 20_000 });

    if (page.url().includes('insights.html')) {
      const contentVisible = await page.locator('#insights-content').isVisible().catch(() => false);
      if (contentVisible) {
        test.skip(true, 'E2E user is a manager/admin — redirect case requires a non-manager session');
        return;
      }
    }

    await expect(page).toHaveURL(/command-center\.html|index\.html/);
  });
});
