import type { Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/guardian-log';

/** insights.html — manager utilization / reporting home. */
export class InsightsPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/insights.html');
    await waitForAppReady(this.page);
  }

  heading(): ReturnType<Page['locator']> {
    return this.page.getByRole('heading', { name: 'Insights', exact: true });
  }

  content(): ReturnType<Page['locator']> {
    return this.page.locator('#insights-content');
  }

  accessDenied(): ReturnType<Page['locator']> {
    return this.page.locator('#insights-access-denied');
  }

  activitiesMetric(): ReturnType<Page['locator']> {
    return this.page.locator('#insights-activities-metric');
  }

  closedWonMetric(): ReturnType<Page['locator']> {
    return this.page.locator('#insights-closed-won-metric');
  }

  quotaMetric(): ReturnType<Page['locator']> {
    return this.page.locator('#insights-quota-metric');
  }

  sequenceKpis(): ReturnType<Page['locator']> {
    return this.page.locator('#insights-sequence-kpis');
  }

  campaignKpis(): ReturnType<Page['locator']> {
    return this.page.locator('#insights-campaign-kpis');
  }

  saosKpis(): ReturnType<Page['locator']> {
    return this.page.locator('#insights-saos-kpis');
  }

  repFilter(): ReturnType<Page['locator']> {
    return this.page.locator('#insights-rep-filter');
  }

  dateFilter(): ReturnType<Page['locator']> {
    return this.page.locator('#insights-date-filter');
  }
}
