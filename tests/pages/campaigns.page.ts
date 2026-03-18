import type { Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/guardian-log';

/** campaigns.html — selectEmailTemplate, createCampaign */
export class CampaignsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/campaigns.html');
    await waitForAppReady(this.page);
  }

  campaignType(): ReturnType<Page['locator']> {
    return this.page.locator('#campaign-type');
  }

  emailSourceType(): ReturnType<Page['locator']> {
    return this.page.locator('#email-source-type');
  }

  templateSelector(): ReturnType<Page['locator']> {
    return this.page.locator('#template-selector');
  }

  templateEmailPreview(): ReturnType<Page['locator']> {
    return this.page.locator('#template-email-preview');
  }

  previewTemplateSubject(): ReturnType<Page['locator']> {
    return this.page.locator('#preview-template-subject');
  }

  campaignName(): ReturnType<Page['locator']> {
    return this.page.locator('#campaign-name');
  }

  /** Intent: Email Merge + Use Template → preview populates */
  async selectEmailTemplateFlow(): Promise<void> {
    await this.campaignType().selectOption('Email');
    await this.page.locator('#email-section-container').waitFor({ state: 'visible', timeout: 10_000 });
    await this.emailSourceType().selectOption('template');
    await this.page.locator('#template-select-container').waitFor({ state: 'visible', timeout: 10_000 });
  }

  async selectFirstAvailableTemplate(): Promise<void> {
    const sel = this.templateSelector();
    const options = await sel.locator('option').evaluateAll((opts) =>
      opts.map((o) => ({ value: (o as HTMLOptionElement).value, text: (o as HTMLOptionElement).text })).filter((o) => o.value && o.value !== '')
    );
    if (!options.length) throw new Error('No email templates in dropdown');
    await sel.selectOption(options[0].value);
  }
}
