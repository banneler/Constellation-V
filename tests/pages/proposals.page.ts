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
