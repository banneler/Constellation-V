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

test.describe('Strategic Account OS', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      await guardianCaptureFailure(page, testInfo.title);
    }
  });

  async function createAndSelectAccount(page: import('@playwright/test').Page, acc: AccountsPage): Promise<string> {
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await acc.goto();
    await acc.resetStrategicViewModePreference();
    const unique = `E2E Strategic ${Date.now()}`;
    guardian.step(`Creating account for Strategic OS: ${unique}`);
    await acc.createAccountViaModal(unique);
    await acc.selectAccountByName(unique);
    await expect(acc.accountModeToggle()).toBeEnabled({ timeout: 15_000 });
    return unique;
  }

  test('mode toggle hides tactical panels and reveals strategic shell', async ({ page }) => {
    const acc = new AccountsPage(page);
    await createAndSelectAccount(page, acc);

    guardian.step('Verifying tactical panels visible before toggle');
    await expect(acc.accountPickerPanel()).toBeVisible();
    await expect(acc.accountDetails()).toBeVisible();
    await expect(acc.strategicWorkspace()).toBeHidden();

    guardian.step('Switching to Strategic mode');
    await acc.switchToStrategicMode();

    guardian.step('Verifying strategic shell visible and account picker remains');
    await expect(acc.strategicWorkspace()).toBeVisible();
    await expect(acc.strategicDocumentCanvas()).toBeVisible();
    await expect(acc.accountPickerPanel()).toBeVisible();
    await expect(acc.accountDetails()).toBeHidden();
    await expect(acc.accountModeToggle()).toHaveAttribute('aria-pressed', 'true');
  });

  test('canvas edit triggers autosave status cycle to Saved', async ({ page }) => {
    const acc = new AccountsPage(page);
    await createAndSelectAccount(page, acc);
    await acc.switchToStrategicMode();

    const textarea = acc.strategicTextarea('pursuit_thesis.core');
    await textarea.waitFor({ state: 'visible', timeout: 15_000 });

    guardian.step('Typing into Pursuit Thesis textarea');
    const snippet = `E2E autosave ${Date.now()}`;
    await textarea.fill(snippet);

    guardian.step('Waiting for pending autosave status');
    await expect(acc.strategicAutosaveStatus()).toHaveAttribute('data-status', 'pending', { timeout: 5_000 });
    await expect(acc.strategicAutosaveStatus()).toContainText('Unsaved changes', { timeout: 5_000 });

    guardian.step('Waiting for saved autosave status (2s debounce + network)');
    await expect(acc.strategicAutosaveStatus()).toHaveAttribute('data-status', 'saved', { timeout: 20_000 });
    await expect(acc.strategicAutosaveStatus()).toContainText('Saved', { timeout: 5_000 });
  });

  test('Force Commit Milestone adds entry to version history popover', async ({ page }) => {
    const acc = new AccountsPage(page);
    await createAndSelectAccount(page, acc);
    await acc.switchToStrategicMode();

    const textarea = acc.strategicTextarea('pursuit_thesis.core');
    await textarea.waitFor({ state: 'visible', timeout: 15_000 });
    await textarea.fill(`E2E force commit ${Date.now()}`);

    guardian.step('Waiting for initial autosave before force commit');
    await expect(acc.strategicAutosaveStatus()).toHaveAttribute('data-status', 'saved', { timeout: 20_000 });

    guardian.step('Opening version history before force commit');
    await acc.openVersionHistoryPopover();
    const beforeCount = await acc.planVersionTimeline().locator('.plan-version-item').count();
    await acc.planVersionPopover().locator('#plan-version-popover-close').click();
    await expect(acc.planVersionPopover()).toBeHidden();

    guardian.step('Clicking Force Commit Milestone');
    await acc.planForceCommitBtn().click();

    guardian.step('Waiting for save after force commit');
    await expect(acc.strategicAutosaveStatus()).toHaveAttribute('data-status', 'saved', { timeout: 20_000 });

    guardian.step('Opening version history and verifying new manual commit entry');
    await acc.openVersionHistoryPopover();
    await expect(acc.planVersionTimeline().locator('.plan-version-item')).toHaveCount(beforeCount + 1, { timeout: 10_000 });
    await expect(acc.planVersionTimeline().getByText('Manual commit', { exact: false }).first()).toBeVisible();
  });
});
