import type { Page } from '@playwright/test';
import { guardianStep } from '../helpers/guardian-log';

/** index.html — Supabase email/password auth (js/auth.js). */
export class LoginPage {
  constructor(private readonly page: Page) {}

  /** Wait until auth.js has attached handlers and run initial updateAuthUI (avoids race with loadSVGs / form reset). */
  async waitForAuthReady(): Promise<void> {
    await this.page.locator('body[data-auth-ready="true"]').waitFor({
      state: 'attached',
      timeout: 45_000,
    });
  }

  async goto(): Promise<void> {
    guardianStep('LoginPage.goto', 'index.html');
    await this.page.goto('/index.html', { waitUntil: 'load' });
    await this.waitForAuthReady();
  }

  async fillCredentials(email: string, password: string): Promise<void> {
    guardianStep('LoginPage.fillCredentials', `email=${email.split('@')[0]}@…`);
    await this.page.locator('#auth-email').fill(email);
    await this.page.locator('#auth-password').fill(password);
  }

  async submit(): Promise<void> {
    guardianStep('LoginPage.submit', '#auth-submit-btn');
    // Brief pause so v2 animations / late script work can settle before first click
    await this.page.waitForTimeout(500);
    await this.page.locator('#auth-submit-btn').click();
  }

  async loginAs(email: string, password: string): Promise<void> {
    await this.goto();
    await this.fillCredentials(email, password);
    await this.submit();
  }

  authError(): ReturnType<Page['locator']> {
    return this.page.locator('#auth-error');
  }
}
