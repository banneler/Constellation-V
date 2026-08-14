import type { Page } from '@playwright/test';
import { guardianStep, waitForAppReady } from '../helpers/guardian-log';

export class PathfinderPage {
  constructor(private readonly page: Page) {}

  async goto(accountId?: number): Promise<void> {
    guardianStep('PathfinderPage.goto');
    await this.page.goto(`/pathfinder.html${accountId ? `?accountId=${accountId}` : ''}`);
    await waitForAppReady(this.page);
  }

  candidateGrid(): ReturnType<Page['locator']> {
    return this.page.locator('#pathfinder-candidates');
  }

  candidateCards(): ReturnType<Page['locator']> {
    return this.page.locator('.pathfinder-candidate-card');
  }

  statusFilter(): ReturnType<Page['locator']> {
    return this.page.locator('#pathfinder-status-filter');
  }

  pendingCount(): ReturnType<Page['locator']> {
    return this.page.locator('#pathfinder-pending-count');
  }
}
