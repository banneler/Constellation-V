import type { Page } from '@playwright/test';
import { guardianStep, waitForAppReady } from '../helpers/guardian-log';

/** deals.html — pipeline metrics, list/board, filters, new deal. */
export class DealsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    guardianStep('DealsPage.goto');
    await this.page.goto('/deals.html');
    await waitForAppReady(this.page);
  }

  addDealBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#add-deal-btn');
  }

  listViewBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#list-view-btn');
  }

  boardViewBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#board-view-btn');
  }

  dealsTable(): ReturnType<Page['locator']> {
    return this.page.locator('#deals-table');
  }

  kanbanBoard(): ReturnType<Page['locator']> {
    return this.page.locator('#kanban-board-view');
  }

  metricCommit(): ReturnType<Page['locator']> {
    return this.page.locator('#metric-current-commit');
  }

  viewMyDeals(): ReturnType<Page['locator']> {
    return this.page.locator('#view-my-deals-btn');
  }

  viewAllDeals(): ReturnType<Page['locator']> {
    return this.page.locator('#view-all-deals-btn');
  }

  filtersReset(): ReturnType<Page['locator']> {
    return this.page.locator('#deals-filters-reset');
  }

  newDealInlineContainer(): ReturnType<Page['locator']> {
    return this.page.locator('#new-deal-inline-container');
  }
}
