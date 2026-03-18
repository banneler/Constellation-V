import { test, expect } from '@playwright/test';
import { guardian, guardianCaptureFailure } from '../helpers/guardian-log';
import { AccountsPage } from '../pages/accounts.page';

test.describe('Accounts (functional)', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      await guardianCaptureFailure(page, testInfo.title);
    }
  });

  test('search, create account via modal, list + contact views', async ({ page }) => {
    const acc = new AccountsPage(page);
    page.on('dialog', (d) => d.dismiss().catch(() => {}));

    guardian.step('Opening Accounts');
    await acc.goto();

    guardian.step('Searching account picker');
    await acc.searchAccounts('a');
    await expect(acc.accountList()).toBeVisible();

    const unique = `E2E Acct ${Date.now()}`;
    guardian.step(`Creating account via modal: ${unique}`);
    await acc.createAccountViaModal(unique);

    guardian.step('Clearing search so new account appears in list');
    await acc.searchAccounts('');
    await page.waitForTimeout(500);

    await expect(acc.accountList().getByText(unique, { exact: false })).toBeVisible({ timeout: 30_000 });

    guardian.step('Selecting new account in list');
    await acc.accountList().locator('.list-item').filter({ hasText: unique }).first().click();
    await page.waitForTimeout(600);

    guardian.step('Toggling org chart vs contact list');
    await acc.toggleToOrgChart();
    await expect(page.locator('#contact-org-chart-view')).toBeVisible({ timeout: 10_000 });
    await acc.toggleToContactList();
    await expect(acc.contactListView()).toBeVisible();
  });
});
