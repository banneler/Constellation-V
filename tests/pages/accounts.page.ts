import type { Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/guardian-log';

/** accounts.html — manifest intents: searchAccount, createAccount, saveAccount, toggleContactListView */
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

  accountForm(): ReturnType<Page['locator']> {
    return this.page.locator('#account-form');
  }

  accountName(): ReturnType<Page['locator']> {
    return this.page.locator('#account-name');
  }

  accountLastSaved(): ReturnType<Page['locator']> {
    return this.page.locator('#account-last-saved');
  }

  saveAccountSubmit(): ReturnType<Page['locator']> {
    return this.page.locator('#account-form button[type="submit"]');
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

  /** Intent: filter picker by search string */
  async searchAccounts(query: string): Promise<void> {
    await this.accountSearch().fill(query);
  }

  /** Intent: new account shell + persist */
  async createAndSaveAccount(name: string): Promise<void> {
    await this.addAccountBtn().click();
    await this.accountName().fill(name);
    await this.saveAccountSubmit().click();
  }

  /** Intent: switch account ↔ org chart */
  async toggleToOrgChart(): Promise<void> {
    await this.contactOrgChartBtn().click();
  }

  async toggleToContactList(): Promise<void> {
    await this.contactListBtn().click();
  }
}
