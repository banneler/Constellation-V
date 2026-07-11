import type { Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/guardian-log';

/** proposals.html — selectProposalTemplate (module slide), generateProposal, fillProposalProperties */
export class ProposalsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/proposals.html');
    await waitForAppReady(this.page);
    await this.page.waitForTimeout(2000);
  }

  globalRfp(): ReturnType<Page['locator']> {
    return this.page.locator('#global-rfp');
  }

  globalBiz(): ReturnType<Page['locator']> {
    return this.page.locator('#global-biz');
  }

  generateBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#generate-btn');
  }

  toggleImpactRoi(): ReturnType<Page['locator']> {
    return this.page.locator('#toggle-impact-roi');
  }

  impactRoiSection(): ReturnType<Page['locator']> {
    return this.page.locator('#impact-roi-section');
  }

  toggleCustomText(): ReturnType<Page['locator']> {
    return this.page.locator('#toggle-custom-text');
  }

  customTextSection(): ReturnType<Page['locator']> {
    return this.page.locator('#custom-text-section-0');
  }

  coverBody(): ReturnType<Page['locator']> {
    return this.page.locator('#cover-body');
  }

  coverSnippet(label: string): ReturnType<Page['locator']> {
    return this.page.locator('#cover-snippets button', { hasText: label });
  }

  customPageSnippet(label: string): ReturnType<Page['locator']> {
    return this.page.locator('.custom-page-snippets button', { hasText: label }).first();
  }

  quoteExpirationToggle(): ReturnType<Page['locator']> {
    return this.page.locator('#pricing-enable-quote-expiration');
  }

  quoteExpirationDaysWrap(): ReturnType<Page['locator']> {
    return this.page.locator('#pricing-quote-expiration-days-wrap');
  }

  quoteExpirationDays(): ReturnType<Page['locator']> {
    return this.page.locator('#pricing-quote-expiration-days');
  }

  taxesFeesExclusionToggle(): ReturnType<Page['locator']> {
    return this.page.locator('#pricing-enable-taxes-fees-exclusion');
  }

  /** Enabling a proposal module updates main preview sections */
  async selectProposalModuleImpactRoi(): Promise<void> {
    await this.toggleImpactRoi().check();
  }

  async selectProposalModuleCustomPage(): Promise<void> {
    await this.toggleCustomText().check();
  }

  /** Intent: minimum viable fields before compile */
  async fillProposalProperties(rfp: string, business: string): Promise<void> {
    await this.globalRfp().fill(rfp);
    await this.globalBiz().fill(business);
  }

  async generateProposal(): Promise<void> {
    await this.generateBtn().click();
  }
}
