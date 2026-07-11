import type { Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/guardian-log';

/** campaigns.html — guided email ABM campaign builder */
export class CampaignsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/campaigns.html');
    await waitForAppReady(this.page);
  }

  campaignType(): ReturnType<Page['locator']> {
    return this.page.locator('#campaign-type');
  }

  guidedEmailFields(): ReturnType<Page['locator']> {
    return this.page.locator('#abm-guided-email-fields');
  }

  emailSubject(): ReturnType<Page['locator']> {
    return this.page.locator('#campaign-email-subject');
  }

  emailBody(): ReturnType<Page['locator']> {
    return this.page.locator('#campaign-email-body');
  }

  campaignName(): ReturnType<Page['locator']> {
    return this.page.locator('#campaign-name');
  }

  /** Intent: Guided Email campaign type reveals editable subject/body fields. */
  async selectGuidedEmailFlow(): Promise<void> {
    await this.campaignType().evaluate((el) => {
      const select = el as HTMLSelectElement & { tomselect?: { setValue: (value: string) => void } };
      if (select.tomselect) {
        select.tomselect.setValue('Guided Email');
      } else {
        select.value = 'Guided Email';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await this.guidedEmailFields().waitFor({ state: 'visible', timeout: 10_000 });
  }
}
