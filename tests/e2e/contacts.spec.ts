import { test, expect } from '@playwright/test';
import { guardianRun } from '../helpers/guardian-log';
import { ContactsPage } from '../pages/contacts.page';

test.describe('Contacts', () => {
  test('search, sort, add contact form', async ({ page }) => {
    const c = new ContactsPage(page);
    await guardianRun(page, 'goto contacts', () => c.goto());

    await guardianRun(page, 'contact search', async () => {
      await c.searchInput().fill('a');
      await expect(c.contactList()).toBeVisible();
    });

    await guardianRun(page, 'sort toggles', async () => {
      await c.sortLastFirst().click();
      await c.sortFirstLast().click();
    });

    await guardianRun(page, 'add contact opens form', async () => {
      await c.addContactBtn().click();
      await expect(c.firstName()).toBeVisible({ timeout: 10_000 });
      await expect(c.contactForm()).toBeVisible();
    });

    await guardianRun(page, 'details panel', async () => {
      await expect(c.detailsPanel()).toBeVisible();
    });
  });

  test('AI email generation uses wide compose mode until activity is logged', async ({ page }) => {
    const c = new ContactsPage(page);

    await page.route(/\/functions\/v1\/generate-prospect-email/i, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subject: 'E2E follow-up',
          body: 'Hi there,\n\nThis is an E2E generated draft with a clear next step.',
        }),
      });
    });

    await page.route(/\/rest\/v1\/personal_context/i, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 'ctx-contacts-email-e2e' }]),
        });
        return;
      }
      await route.continue();
    });

    await page.route(/\/rest\/v1\/activities/i, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
        return;
      }
      await route.continue();
    });

    await page.addInitScript(() => {
      window.open = () => null;
    });

    await guardianRun(page, 'goto contacts', () => c.goto());

    await guardianRun(page, 'select contact with email', async () => {
      const items = page.locator('#contact-list .list-item');
      const count = await items.count();
      let found = false;
      for (let i = 0; i < count; i += 1) {
        await items.nth(i).click();
        await expect(c.contactForm()).toBeVisible({ timeout: 10_000 });
        const email = String(await page.locator('#contact-email').inputValue().catch(() => '')).trim();
        if (email) {
          found = true;
          break;
        }
      }
      test.skip(!found, 'Contacts E2E data has no contact with an email address');
    });

    await guardianRun(page, 'generate AI email draft', async () => {
      await page.locator('#ai-email-prompt').fill('Write a concise follow-up email.');
      await page.locator('#ai-generate-email-btn').click();
      await expect(page.locator('body')).toHaveClass(/ai-email-compose-active/);
      await expect(page.locator('#ai-email-response')).toBeVisible();
      await expect(page.locator('#ai-email-subject')).toHaveValue('E2E follow-up');
      await expect(page.locator('#ai-email-body')).toHaveValue(/E2E generated draft/);
      await expect(page.locator('.contact-activities-card')).toBeHidden();

      const aiWidth = await page.locator('.ai-assistant-card').evaluate((el) => el.getBoundingClientRect().width);
      expect(aiWidth).toBeGreaterThan(400);
    });

    await guardianRun(page, 'open email client and restore default layout after log', async () => {
      await page.locator('#open-email-client-btn').click();
      await expect(page.locator('body')).not.toHaveClass(/ai-email-compose-active/);
      await expect(page.locator('.contact-activities-card')).toBeVisible();
    });
  });
});
