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
});
