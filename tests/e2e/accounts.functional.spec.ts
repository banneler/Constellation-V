import { test, expect } from '@playwright/test';
import { guardian } from '../helpers/guardian-log';
import { AccountsPage } from '../pages/accounts.page';

test.describe('Accounts (functional)', () => {
  test('search, create account, save, toggle contact views', async ({ page }) => {
    const acc = new AccountsPage(page);
    guardian.step('Opening Accounts — authenticated session');
    await acc.goto();

    guardian.step('Searching account picker');
    await acc.searchAccounts('a');
    await expect(acc.accountList()).toBeVisible();

    const unique = `E2E Acct ${Date.now()}`;
    guardian.step(`Creating new account: ${unique}`);
    await acc.createAndSaveAccount(unique);

    guardian.step('Asserting save feedback or list contains new account');
    await expect(acc.accountList().getByText(unique, { exact: false })).toBeVisible({ timeout: 30_000 });

    guardian.step('Toggling org chart vs contact list');
    await acc.toggleToOrgChart();
    await expect(page.locator('#contact-org-chart-view')).toBeVisible();
    await acc.toggleToContactList();
    await expect(acc.contactListView()).toBeVisible();
  });
});
