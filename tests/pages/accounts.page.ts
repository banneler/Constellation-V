import type { Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/guardian-log';

/** accounts.html — New Account uses modal (#modal-account-name → Create Account), not detail form. */
export class AccountsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/accounts.html');
    await waitForAppReady(this.page);
  }

  accountSearch(): ReturnType<Page['locator']> {
    return this.page.locator('#account-search');
  }

  accountList(): ReturnType<Page['locator']> {
    return this.page.locator('#account-list');
  }

  addAccountBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#add-account-btn');
  }

  contactListBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#contact-list-btn');
  }

  contactOrgChartBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#contact-org-chart-btn');
  }

  contactListView(): ReturnType<Page['locator']> {
    return this.page.locator('#contact-list-view');
  }

  async searchAccounts(query: string): Promise<void> {
    await this.accountSearch().fill(query);
  }

  /**
   * Intent: create account (modal flow per js/accounts.js addAccountBtn).
   */
  async createAccountViaModal(name: string): Promise<void> {
    await this.addAccountBtn().click();
    await this.page.locator('#modal-account-name').waitFor({ state: 'visible', timeout: 10_000 });
    await this.page.locator('#modal-account-name').fill(name);
    await this.page.getByRole('button', { name: 'Create Account' }).click();
    await this.page.locator('#modal-backdrop').waitFor({ state: 'hidden', timeout: 30_000 });
  }

  async toggleToOrgChart(): Promise<void> {
    await this.contactOrgChartBtn().click();
  }

  async toggleToContactList(): Promise<void> {
    await this.contactListBtn().click();
  }
}
