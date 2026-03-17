import type { Page } from '@playwright/test';
import { guardianStep } from '../helpers/guardian-log';

/** index.html — Supabase email/password auth (js/auth.js). */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    guardianStep('LoginPage.goto', 'index.html');
    await this.page.goto('/index.html');
  }

  async fillCredentials(email: string, password: string): Promise<void> {
    guardianStep('LoginPage.fillCredentials', `email=${email.split('@')[0]}@…`);
    await this.page.locator('#auth-email').fill(email);
    await this.page.locator('#auth-password').fill(password);
  }

  async submit(): Promise<void> {
    guardianStep('LoginPage.submit', '#auth-submit-btn');
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
