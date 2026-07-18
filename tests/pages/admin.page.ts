import type { Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/guardian-log';

/** admin.html — contentManagementToggle, shareContentToggle. ai-admin.html — AI memory overview. */
export class AdminPage {
  constructor(private readonly page: Page) {}

  async gotoAdmin(hash = '#user-management'): Promise<void> {
    await this.page.goto(`/admin.html${hash}`);
    await waitForAppReady(this.page);
  }

  async gotoContentManagement(): Promise<void> {
    await this.gotoAdmin('#content-management');
  }

  viewTemplatesBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#view-templates-btn');
  }

  viewSequencesBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#view-sequences-btn');
  }

  contentManagementTable(): ReturnType<Page['locator']> {
    return this.page.locator('#content-management-table');
  }

  firstShareToggle(): ReturnType<Page['locator']> {
    return this.page.locator('#content-management-table .share-toggle').first();
  }

  /** --- AI Admin (ai-admin.html) --- */
  async gotoAiAdmin(): Promise<void> {
    await this.page.goto('/ai-admin.html');
    await waitForAppReady(this.page);
  }

  aiEngineTab(name: string): ReturnType<Page['locator']> {
    return this.page.locator('#ai-engine-tabs .irr-tab').filter({ hasText: name });
  }

  aiMemoryCard(): ReturnType<Page['locator']> {
    return this.page.locator('.ai-memory-card');
  }

  aiMemoryPrompt(): ReturnType<Page['locator']> {
    return this.page.locator('#dynamic-prompt-preview');
  }

  memoryFunctionSelect(): ReturnType<Page['locator']> {
    return this.page.locator('#memory-function-select');
  }

  memoryScopeSummary(): ReturnType<Page['locator']> {
    return this.page.locator('#memory-scope-summary');
  }

  memoryTotalCount(): ReturnType<Page['locator']> {
    return this.page.locator('#memory-total-count');
  }

  memoryRatedCount(): ReturnType<Page['locator']> {
    return this.page.locator('#memory-rated-count');
  }

  memoryPendingCount(): ReturnType<Page['locator']> {
    return this.page.locator('#memory-pending-count');
  }

  memoryLatestUpdate(): ReturnType<Page['locator']> {
    return this.page.locator('#memory-latest-update');
  }
}
