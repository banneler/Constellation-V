import type { Page, Locator } from '@playwright/test';
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

  /** Tactical account details panel (hidden in Strategic mode). */
  accountDetails(): ReturnType<Page['locator']> {
    return this.page.locator('#account-details');
  }

  /** Left account picker (hidden in Strategic mode). */
  accountPickerPanel(): ReturnType<Page['locator']> {
    return this.page.locator('.account-picker-panel');
  }

  /** Strategic mode toggle (#account-mode-toggle). */
  accountModeToggle(): ReturnType<Page['locator']> {
    return this.page.locator('#account-mode-toggle');
  }

  /** Strategic workspace shell (canvas + rail). */
  strategicWorkspace(): ReturnType<Page['locator']> {
    return this.page.locator('#strategic-workspace');
  }

  /** Strategic document canvas (form sections). */
  strategicDocumentCanvas(): ReturnType<Page['locator']> {
    return this.page.locator('#strategic-document-canvas');
  }

  /** Autosave status chip in strategic header. */
  strategicAutosaveStatus(): ReturnType<Page['locator']> {
    return this.page.locator('#strategic-autosave-status');
  }

  /** Version history clock trigger. */
  planVersionTrigger(): ReturnType<Page['locator']> {
    return this.page.locator('#plan-version-trigger');
  }

  /** iOS-style version history popover. */
  planVersionPopover(): ReturnType<Page['locator']> {
    return this.page.locator('#plan-version-popover');
  }

  planVersionTimeline(): ReturnType<Page['locator']> {
    return this.page.locator('#plan-version-timeline');
  }

  planForceCommitBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#plan-force-commit-btn');
  }

  planExportDossierBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#plan-export-dossier-btn');
  }

  planExportExecBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#plan-export-exec-btn');
  }

  /**
   * Canvas textarea by section field id (e.g. pursuit_thesis.core).
   */
  strategicTextarea(field: string): Locator {
    return this.page.locator(`#strategic-document-canvas textarea[data-field="${field}"]`);
  }

  /** Canvas select by section field id (e.g. account_snapshot.tier). */
  strategicSelect(field: string): Locator {
    return this.page.locator(`#strategic-document-canvas select[data-field="${field}"]`);
  }

  strategicSection(sectionId: string): Locator {
    return this.page.locator(`#strategic-section-${sectionId}`);
  }

  momentumSignalInput(): Locator {
    return this.page.locator('#momentum-signal-input');
  }

  momentumSignalLogBtn(): Locator {
    return this.page.locator('[data-momentum-signal-log]');
  }

  momentumTimelineDisplay(): Locator {
    return this.page.locator('.momentum-timeline-display');
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

  async selectAccountByName(name: string): Promise<void> {
    await this.searchAccounts('');
    await this.page.waitForTimeout(400);
    await this.accountList().locator('.list-item').filter({ hasText: name }).first().click();
    await this.page.locator('#account-name').waitFor({ state: 'visible', timeout: 15_000 });
  }

  /** Reset persisted view mode so tests start in Tactical. */
  async resetStrategicViewModePreference(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.setItem('accounts_view_mode', 'tactical');
    });
  }

  async switchToStrategicMode(): Promise<void> {
    await expectEnabled(this.accountModeToggle());
    await this.accountModeToggle().click();
    await this.page.locator('#accounts.strategic-mode-active').waitFor({ state: 'attached', timeout: 10_000 });
    await this.strategicWorkspace().waitFor({ state: 'visible', timeout: 10_000 });
  }

  async switchToTacticalMode(): Promise<void> {
    await this.accountModeToggle().click();
    await this.accountDetails().waitFor({ state: 'visible', timeout: 10_000 });
  }

  async openVersionHistoryPopover(): Promise<void> {
    await this.planVersionTrigger().click();
    await this.planVersionPopover().waitFor({ state: 'visible', timeout: 10_000 });
  }

  async scrollToStrategicSection(sectionId: string): Promise<void> {
    await this.strategicSection(sectionId).scrollIntoViewIfNeeded();
    await this.strategicSection(sectionId).waitFor({ state: 'visible', timeout: 10_000 });
  }

  /** Plan row lazy-loads on first account select; export buttons enable when ready. */
  async waitForPlanLoaded(): Promise<void> {
    await pollUntilEnabled(this.planExportDossierBtn(), 20_000);
    await pollUntilEnabled(this.planExportExecBtn(), 5_000);
    await pollUntilEnabled(this.planForceCommitBtn(), 5_000);
  }

  async waitForAutosaveSaved(): Promise<void> {
    await this.strategicAutosaveStatus().waitFor({ state: 'visible', timeout: 10_000 });
    await this.page.waitForFunction(
      () => document.querySelector('#strategic-autosave-status')?.getAttribute('data-status') === 'saved',
      undefined,
      { timeout: 20_000 },
    );
  }

  async toggleToOrgChart(): Promise<void> {
    await this.contactOrgChartBtn().click();
  }

  async toggleToContactList(): Promise<void> {
    await this.contactListBtn().click();
  }
}

async function expectEnabled(locator: Locator): Promise<void> {
  await pollUntilEnabled(locator, 15_000);
}

async function pollUntilEnabled(locator: Locator, timeout = 15_000): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout });
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!(await locator.isDisabled())) return;
    await locator.page().waitForTimeout(200);
  }
  throw new Error('Expected locator to be enabled but it remained disabled');
}
