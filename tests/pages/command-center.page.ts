import type { Page } from '@playwright/test';
import { guardianStep, waitForAppReady } from '../helpers/guardian-log';

/** command-center.html — v2 dashboard: AI briefing, tasks, sequences, activities. */
export class CommandCenterPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    guardianStep('CommandCenterPage.goto');
    await this.page.goto('/command-center.html');
    await waitForAppReady(this.page);
  }

  briefingRefresh(): ReturnType<Page['locator']> {
    return this.page.locator('#ai-briefing-refresh-btn');
  }

  myTasksAdd(): ReturnType<Page['locator']> {
    return this.page.locator('#my-tasks-hamburger');
  }

  quickAddForm(): ReturnType<Page['locator']> {
    return this.page.locator('#quick-add-task-form');
  }

  sequenceToggleDue(): ReturnType<Page['locator']> {
    return this.page.locator('#sequence-toggle-due');
  }

  sequenceToggleUpcoming(): ReturnType<Page['locator']> {
    return this.page.locator('#sequence-toggle-upcoming');
  }

  recentActivities(): ReturnType<Page['locator']> {
    return this.page.locator('#recent-activities-list');
  }

  dashboardGrid(): ReturnType<Page['locator']> {
    return this.page.locator('#dashboard-sections-grid');
  }
}
