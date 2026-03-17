import type { Page } from '@playwright/test';
import { guardianStep, waitForAppReady } from '../helpers/guardian-log';

/** contacts.html — picker + detail form. */
export class ContactsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    guardianStep('ContactsPage.goto');
    await this.page.goto('/contacts.html');
    await waitForAppReady(this.page);
  }

  searchInput(): ReturnType<Page['locator']> {
    return this.page.locator('#contact-search');
  }

  addContactBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#add-contact-btn');
  }

  contactList(): ReturnType<Page['locator']> {
    return this.page.locator('#contact-list');
  }

  contactForm(): ReturnType<Page['locator']> {
    return this.page.locator('#contact-form');
  }

  firstName(): ReturnType<Page['locator']> {
    return this.page.locator('#contact-first-name');
  }

  sortFirstLast(): ReturnType<Page['locator']> {
    return this.page.locator('#sort-first-last-btn');
  }

  sortLastFirst(): ReturnType<Page['locator']> {
    return this.page.locator('#sort-last-first-btn');
  }

  detailsPanel(): ReturnType<Page['locator']> {
    return this.page.locator('#contact-details');
  }
}
