import * as fs from 'fs';
import * as path from 'path';
import { test as setup } from '@playwright/test';
import { guardianStep, guardianScreenshot } from './helpers/guardian-log';
import { LoginPage } from './pages/login.page';

const authFile = path.join(__dirname, '.auth', 'user.json');

/**
 * Authenticates via index.html (Supabase) and saves session for e2e projects.
 * Requires E2E_EMAIL and E2E_PASSWORD in .env (see .env.example).
 */
setup.describe('setup', () => {
  setup('seed: login and persist storage state', async ({ page }) => {
    const email = process.env.E2E_EMAIL?.trim();
    const password = process.env.E2E_PASSWORD;

    if (!email || !password) {
      console.error(
        '[Guardian E2E] Missing E2E_EMAIL or E2E_PASSWORD. Copy .env.example → .env and set both.'
      );
      throw new Error('E2E credentials missing — cannot run seed or dependent e2e tests');
    }

    fs.mkdirSync(path.dirname(authFile), { recursive: true });
    guardianStep('seed', `writing session to ${authFile}`);

    const login = new LoginPage(page);
    await login.loginAs(email, password);

    try {
      await page.waitForURL(/command-center\.html/i, { timeout: 45_000 });
    } catch {
      const errText = await page.locator('#auth-error').textContent().catch(() => '');
      await guardianScreenshot(page, 'seed-login-failed');
      throw new Error(
        `Login did not redirect to command-center.html. Auth error: "${(errText || '').trim() || 'none'}"`
      );
    }

    await page.context().storageState({ path: authFile });
    guardianStep('seed complete', 'session saved');
  });
});
