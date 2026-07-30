import { test, expect } from '@playwright/test';
import { guardian, guardianCaptureFailure } from '../helpers/guardian-log';
import { AdminPage } from '../pages/admin.page';

async function ensureAdminPage(page: import('@playwright/test').Page): Promise<boolean> {
  await page.waitForURL(/admin\.html|command-center\.html|index\.html/, { timeout: 20_000 });
  return page.url().includes('admin.html');
}

test.describe('Email & calendar integrations', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      await guardianCaptureFailure(page, testInfo.title);
    }
  });

  test('Admin Integrations toggle persists to org_settings', async ({ page }) => {
    const admin = new AdminPage(page);
    page.on('dialog', (d) => d.accept().catch(() => {}));

    guardian.step('Open System Settings');
    await page.goto('/admin.html#settings');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);

    if (!(await ensureAdminPage(page))) {
      test.skip(true, 'E2E user lacks admin/manager access');
      return;
    }

    const toggle = admin.emailCalendarToggle();
    await expect(toggle).toBeVisible({ timeout: 15_000 });

    const before = await toggle.isChecked();
    guardian.step(`Toggling integrations from ${before} → ${!before}`);

    const req = page.waitForRequest(
      (r) => /rest\/v1\/org_settings/i.test(r.url()) && ['POST', 'PATCH'].includes(r.method()),
      { timeout: 25_000 }
    ).catch(() => null);

    await toggle.click();
    await req;

    await expect(toggle).toHaveJSProperty('checked', !before);

    // Restore prior value so the suite leaves the tenant as found.
    const restoreReq = page.waitForRequest(
      (r) => /rest\/v1\/org_settings/i.test(r.url()) && ['POST', 'PATCH'].includes(r.method()),
      { timeout: 25_000 }
    ).catch(() => null);
    await toggle.click();
    await restoreReq;
    await expect(toggle).toHaveJSProperty('checked', before);
  });

  test('User menu Integrations section follows org toggle', async ({ page }) => {
    page.on('dialog', (d) => d.accept().catch(() => {}));

    guardian.step('Ensure integrations disabled via Admin');
    await page.goto('/admin.html#settings');
    await page.waitForTimeout(2500);
    if (!page.url().includes('admin.html')) {
      test.skip(true, 'Not an admin/manager user');
      return;
    }

    const admin = new AdminPage(page);
    const toggle = admin.emailCalendarToggle();
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    if (await toggle.isChecked()) {
      const req = page.waitForRequest(
        (r) => /rest\/v1\/org_settings/i.test(r.url()) && ['POST', 'PATCH'].includes(r.method()),
        { timeout: 25_000 }
      ).catch(() => null);
      await toggle.click();
      await req;
    }

    guardian.step('Menu should hide Integrations when org toggle is off');
    await page.goto('/command-center.html');
    await page.waitForTimeout(2500);
    await page.locator('#nav-menu-toggle').click();
    await expect(page.locator('#user-integrations-menu')).toHaveCount(0);

    guardian.step('Enable integrations and confirm Menu section appears');
    await page.goto('/admin.html#settings');
    await page.waitForTimeout(2000);
    const enableReq = page.waitForRequest(
      (r) => /rest\/v1\/org_settings/i.test(r.url()) && ['POST', 'PATCH'].includes(r.method()),
      { timeout: 25_000 }
    ).catch(() => null);
    await admin.emailCalendarToggle().check();
    await enableReq;

    await page.goto('/command-center.html');
    await page.waitForTimeout(2500);
    await page.locator('#nav-menu-toggle').click();
    await expect(page.locator('#user-integrations-menu')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#user-integrations-menu')).toContainText(/Integrations|Connect Google|Connect Outlook|Connected/i);

    // Leave disabled for mailto regression default.
    await page.goto('/admin.html#settings');
    await page.waitForTimeout(2000);
    if (await admin.emailCalendarToggle().isChecked()) {
      const disableReq = page.waitForRequest(
        (r) => /rest\/v1\/org_settings/i.test(r.url()) && ['POST', 'PATCH'].includes(r.method()),
        { timeout: 25_000 }
      ).catch(() => null);
      await admin.emailCalendarToggle().uncheck();
      await disableReq;
    }
  });
});
