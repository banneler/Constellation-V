import { test, expect } from '@playwright/test';
import { guardian } from '../helpers/guardian-log';
import { AdminPage } from '../pages/admin.page';

test.describe('Admin + AI Admin (functional)', () => {
  test('content management: templates vs marketing sequences table', async ({ page }) => {
    const admin = new AdminPage(page);
    guardian.step('Admin portal → Content Management');
    await admin.gotoContentManagement();

    await expect(admin.viewTemplatesBtn()).toHaveClass(/active/);
    await expect(admin.contentManagementTable().locator('thead')).toContainText('Template Name');

    guardian.step('Switching to Marketing Sequences view');
    await admin.viewSequencesBtn().click();
    await expect(admin.viewSequencesBtn()).toHaveClass(/active/);
    await expect(admin.contentManagementTable().locator('thead')).toContainText('Sequence Name');
  });

  test('content share toggle triggers Supabase update when rows exist', async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.gotoContentManagement();

    const toggle = admin.firstShareToggle();
    if ((await toggle.count()) === 0) {
      guardian.step('No template/sequence rows — skip share API check');
      test.skip();
      return;
    }

    guardian.step('Toggling share checkbox — expecting REST patch');
    const req = page.waitForRequest(
      (r) =>
        (r.url().includes('email_templates') || r.url().includes('marketing_sequences')) &&
        (r.method() === 'PATCH' || r.method() === 'POST'),
      { timeout: 20_000 }
    );
    await toggle.click();
    await req;
    guardian.step('Share toggle API call observed');
  });

  test('AI Admin: save config upserts ai_configs', async ({ page }) => {
    const admin = new AdminPage(page);
    guardian.step('Opening AI Admin');
    await admin.gotoAiAdmin();

    guardian.step('Selecting Command Center engine tab');
    await admin.aiEngineTab('Command Center').click();
    await expect(admin.aiPersona()).toBeVisible();

    const marker = `E2E persona ${Date.now()}`;
    guardian.step(`Saving persona override: ${marker}`);
    await admin.aiPersona().fill(marker);

    const req = page.waitForRequest(
      (r) => r.url().includes('ai_configs') && (r.method() === 'POST' || r.method() === 'PATCH'),
      { timeout: 25_000 }
    );
    await admin.saveConfigBtn().click();
    await req;
    guardian.step('ai_configs upsert completed');

    await expect(admin.configStatusBadge()).toContainText(/PERSONAL|SYSTEM/i, { timeout: 10_000 });
  });
});
