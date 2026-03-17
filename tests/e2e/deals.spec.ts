import { test, expect } from '@playwright/test';
import { guardianRun } from '../helpers/guardian-log';
import { DealsPage } from '../pages/deals.page';

test.describe('Deals', () => {
  test('list, board, new deal shell, filters', async ({ page }) => {
    const deals = new DealsPage(page);
    await guardianRun(page, 'goto deals', () => deals.goto());

    await guardianRun(page, 'list view', async () => {
      await deals.listViewBtn().click();
      await expect(deals.dealsTable()).toBeVisible({ timeout: 15_000 });
    });

    await guardianRun(page, 'board view', async () => {
      await deals.boardViewBtn().click();
      await expect(deals.kanbanBoard()).toBeVisible({ timeout: 15_000 });
    });

    await guardianRun(page, 'open new deal inline', async () => {
      await deals.addDealBtn().click();
      await expect(deals.newDealInlineContainer()).toBeVisible({ timeout: 10_000 });
    });

    await guardianRun(page, 'my deals vs all deals', async () => {
      await deals.viewMyDeals().click();
      await deals.viewAllDeals().click();
    });

    const reset = deals.filtersReset();
    if (await reset.isVisible().catch(() => false)) {
      await guardianRun(page, 'filters reset if enabled', async () => {
        if (await reset.isEnabled()) await reset.click();
      });
    }

    await guardianRun(page, 'commit metric element', async () => {
      await expect(deals.metricCommit()).toBeAttached({ timeout: 20_000 });
    });
  });
});
