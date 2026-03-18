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

  test('AI Admin: save config upserts ai_configs', async ({ page }) => {
    const admin = new AdminPage(page);
    guardian.step('Opening AI Admin');
    await admin.gotoAiAdmin();

    guardian.step('Selecting first engine tab (required before save)');
    const firstTab = page.locator('#ai-engine-tabs .irr-tab').first();
    await firstTab.waitFor({ state: 'visible', timeout: 15_000 });
    await firstTab.click();
    await expect(admin.aiPersona()).toBeVisible({ timeout: 10_000 });

    const marker = `E2E ${Date.now()}`;
    await admin.aiPersona().fill(marker);

    const req = page.waitForRequest(
      (r) => /rest\/v1\/ai_configs/i.test(r.url()) && ['POST', 'PATCH'].includes(r.method()),
      { timeout: 30_000 }
    );
    await admin.saveConfigBtn().click();
    await req;

    await expect(admin.configStatusBadge()).toContainText(/PERSONAL|SYSTEM|VOICE/i, { timeout: 15_000 });
  });
});
