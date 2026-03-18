import type { Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/guardian-log';

/** irr.html — calculateIRR, setTargetIrr, newProject */
export class IrrPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/irr.html');
    await waitForAppReady(this.page);
  }

  newProjectBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#new-project-btn');
  }

  globalTargetIrr(): ReturnType<Page['locator']> {
    return this.page.locator('#global-target-irr');
  }

  globalAnnualIrr(): ReturnType<Page['locator']> {
    return this.page.locator('#global-annual-irr');
  }

  globalTcv(): ReturnType<Page['locator']> {
    return this.page.locator('#global-tcv');
  }

  globalCapitalInvestment(): ReturnType<Page['locator']> {
    return this.page.locator('#global-capital-investment');
  }

  firstMrrInput(): ReturnType<Page['locator']> {
    return this.page.locator('#site-forms-container .mrr-input').first();
  }

  /** Changing MRR should recompute aggregates */
  async calculateIRRByMrrChange(newMrr: string): Promise<void> {
    const input = this.firstMrrInput();
    await input.clear();
    await input.fill(newMrr);
    await input.dispatchEvent('input');
    await input.blur();
  }

  async setGlobalTargetIrr(value: string): Promise<void> {
    await this.globalTargetIrr().fill(value);
    await this.globalTargetIrr().blur();
  }
}
