import type { Page } from '@playwright/test';
import { guardianStep, waitForAppReady } from '../helpers/guardian-log';

/** social_hub.html — AI articles + marketing posts + post modal. */
export class SocialHubPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    guardianStep('SocialHubPage.goto');
    await this.page.goto('/social_hub.html');
    await waitForAppReady(this.page);
  }

  pageTitle(): ReturnType<Page['locator']> {
    return this.page.locator('#social-hub-view .page-title', { hasText: 'Social Hub' });
  }

  aiArticles(): ReturnType<Page['locator']> {
    return this.page.locator('#ai-articles-container');
  }

  marketingPosts(): ReturnType<Page['locator']> {
    return this.page.locator('#marketing-posts-container');
  }

  postTextarea(): ReturnType<Page['locator']> {
    return this.page.locator('#post-text');
  }

  generateCustomBtn(): ReturnType<Page['locator']> {
    return this.page.locator('#generate-custom-btn');
  }

  modalClose(): ReturnType<Page['locator']> {
    return this.page.locator('#modal-close-btn');
  }
}
