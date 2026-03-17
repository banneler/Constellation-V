import { test, expect } from '@playwright/test';
import { guardianRun } from '../helpers/guardian-log';
import { CommandCenterPage } from '../pages/command-center.page';

test.describe('Command Center', () => {
  test('dashboard: briefing, tasks, sequences, activities', async ({ page }) => {
    const cc = new CommandCenterPage(page);

    await guardianRun(page, 'goto command-center', () => cc.goto());

    await guardianRun(page, 'click AI briefing refresh', async () => {
      await cc.briefingRefresh().click();
    });

    await guardianRun(page, 'expand quick-add if needed', async () => {
      const form = cc.quickAddForm();
      if (!(await form.isVisible().catch(() => false))) {
        await cc.myTasksAdd().click();
      }
      await expect(form).toBeVisible({ timeout: 10_000 });
    });

    await guardianRun(page, 'sequence toggles', async () => {
      await cc.sequenceToggleUpcoming().click();
      await cc.sequenceToggleDue().click();
      await expect(cc.sequenceToggleDue()).toHaveClass(/active/);
    });

    await guardianRun(page, 'recent activities list present', async () => {
      await expect(cc.recentActivities()).toBeAttached();
    });

    await guardianRun(page, 'dashboard grid visible', async () => {
      await expect(cc.dashboardGrid()).toBeVisible();
    });
  });
});
