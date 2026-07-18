import { test, expect } from '@playwright/test';
import { guardian, guardianCaptureFailure } from '../helpers/guardian-log';
import { AdminPage } from '../pages/admin.page';

async function ensureAdminPage(page: import('@playwright/test').Page): Promise<boolean> {
  await page.waitForURL(/admin\.html|command-center\.html|index\.html/, { timeout: 20_000 });
  return page.url().includes('admin.html');
}

test.describe('Admin + AI Admin (functional)', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      await guardianCaptureFailure(page, testInfo.title);
    }
  });

  test('content management: templates vs marketing sequences table', async ({ page }) => {
    const admin = new AdminPage(page);
    page.on('dialog', (d) => d.accept().catch(() => {}));

    guardian.step('Admin portal → Content Management');
    await page.goto('/admin.html#content-management');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);

    if (!(await ensureAdminPage(page))) {
      test.skip(true, 'E2E user lacks user_metadata.is_admin — admin tests require admin user');
      return;
    }

    await expect(admin.viewTemplatesBtn()).toHaveClass(/active/, { timeout: 15_000 });
    await expect(admin.contentManagementTable().locator('thead')).toContainText('Template Name');

    guardian.step('Switching to Marketing Sequences view');
    await admin.viewSequencesBtn().click();
    await expect(admin.viewSequencesBtn()).toHaveClass(/active/);
    await expect(admin.contentManagementTable().locator('thead')).toContainText('Sequence Name');
  });

  test('content share toggle triggers Supabase update when rows exist', async ({ page }) => {
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await page.goto('/admin.html#content-management');
    await page.waitForTimeout(2500);
    if (!page.url().includes('admin.html')) {
      test.skip(true, 'Not an admin user');
      return;
    }

    const admin = new AdminPage(page);
    const toggle = admin.firstShareToggle();
    if ((await toggle.count()) === 0) {
      test.skip(true, 'No template/sequence rows');
      return;
    }

    guardian.step('Toggling share — expect REST update');
    const req = page.waitForRequest(
      (r) =>
        /rest\/v1\/(email_templates|marketing_sequences)/i.test(r.url()) &&
        ['PATCH', 'POST'].includes(r.method()),
      { timeout: 25_000 }
    );
    await toggle.click();
    await req;
  });

  test('AI Admin: scoped memory profile loads without legacy override editor', async ({ page }) => {
    const admin = new AdminPage(page);
    guardian.step('Opening AI Admin');
    await admin.gotoAiAdmin();

    guardian.step('Checking scoped memory admin layout');
    await expect(page.getByRole('heading', { name: 'AI Voice Administration' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Scoped AI Memory Profiles' })).toBeVisible();
    await expect(admin.aiMemoryCard()).toBeVisible();
    await expect(admin.memoryFunctionSelect()).toBeVisible();
    await expect(admin.memoryFunctionSelect()).toContainText(/Contacts Email Drafts|Cognito Outreach|Sequence Generation/);
    await expect(admin.memoryScopeSummary()).toContainText(/captured response/i);
    await expect(admin.aiMemoryPrompt()).toBeVisible();
    await expect(admin.memoryTotalCount()).toContainText(/^\d+$/);
    await expect(admin.memoryRatedCount()).toContainText(/^\d+$/);
    await expect(admin.memoryPendingCount()).toContainText(/^\d+$/);
    await expect(admin.memoryLatestUpdate()).toContainText(/profile|feedback/i);

    await expect(page.locator('#ai-engine-tabs')).toHaveCount(0);
    await expect(page.locator('#ai-persona')).toHaveCount(0);
    await expect(page.locator('#save-config-btn')).toHaveCount(0);
  });
});
