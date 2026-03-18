import * as fs from 'fs';
import * as path from 'path';
import { test as setup } from '@playwright/test';
import { guardianStep, guardianScreenshot } from './helpers/guardian-log';
import { LoginPage } from './pages/login.page';

const authFile = path.join(__dirname, '.auth', 'user.json');

type SeedNetState = {
  tokenRequestDispatched: boolean;
  tokenResponseReceived: boolean;
  tokenResponseStatus: number | null;
  requestFailed: string | null;
};

function seedFailureMessage(net: SeedNetState, authUi: string): string {
  const ui = (authUi || '').trim() || 'none';
  if (net.requestFailed) {
    return `Seed failure: Network — ${net.requestFailed}. UI auth: "${ui}"`;
  }
  if (net.tokenRequestDispatched && !net.tokenResponseReceived) {
    return (
      `Seed failure: Network Timeout — Supabase sign-in POST was sent but no response arrived before redirect timeout. ` +
      `UI auth: "${ui}"`
    );
  }
  if (net.tokenResponseStatus === 404) {
    return `Seed failure: API 404 on auth token URL (check SUPABASE_URL). UI auth: "${ui}"`;
  }
  if (net.tokenResponseStatus != null && net.tokenResponseStatus >= 400) {
    return `Seed failure: API HTTP ${net.tokenResponseStatus}. UI auth: "${ui}"`;
  }
  if (!net.tokenRequestDispatched) {
    return (
      `Seed failure: UI — no Supabase /auth/v1/token POST observed (env empty, blocked click, or wrong page). ` +
      `UI auth: "${ui}"`
    );
  }
  if (
    net.tokenResponseReceived &&
    net.tokenResponseStatus != null &&
    net.tokenResponseStatus < 400
  ) {
    return (
      `Seed failure: Login API OK (HTTP ${net.tokenResponseStatus}) but no navigation to command-center.html ` +
      `(redirect/session). UI auth: "${ui}"`
    );
  }
  return `Seed failure: timed out waiting for command-center.html. UI auth: "${ui}"`;
}

/**
 * Authenticates via index.html (Supabase) and saves session for e2e projects.
 * Requires E2E_EMAIL and E2E_PASSWORD in .env (see .env.example).
 */
setup.describe('setup', () => {
  setup('seed: login and persist storage state', async ({ page }) => {
    const email = process.env.E2E_EMAIL?.trim();
    const password = process.env.E2E_PASSWORD?.trim();

    if (!email || !password) {
      console.error(
        '[Guardian E2E] Missing E2E_EMAIL or E2E_PASSWORD. Copy .env.example → .env and set both.'
      );
      throw new Error('E2E credentials missing — cannot run seed or dependent e2e tests');
    }

    fs.mkdirSync(path.dirname(authFile), { recursive: true });
    guardianStep('seed', `writing session to ${authFile}`);

    const consoleLines: string[] = [];
    page.on('console', (msg) => {
      consoleLines.push(`[${msg.type()}] ${msg.text()}`);
    });

    const net: SeedNetState = {
      tokenRequestDispatched: false,
      tokenResponseReceived: false,
      tokenResponseStatus: null,
      requestFailed: null,
    };

    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/auth/v1/token')) {
        net.tokenRequestDispatched = true;
        console.log('[seed] Supabase sign-in POST observed (/auth/v1/token)');
      }
    });
    page.on('response', (res) => {
      const req = res.request();
      if (req.method() === 'POST' && res.url().includes('/auth/v1/token')) {
        net.tokenResponseReceived = true;
        net.tokenResponseStatus = res.status();
        console.log(`[seed] Supabase token response: HTTP ${res.status()}`);
      }
    });
    page.on('requestfailed', (req) => {
      if (req.url().includes('/auth/v1/')) {
        net.requestFailed = req.failure()?.errorText ?? 'request failed';
        console.log('[seed] Supabase auth request failed:', net.requestFailed);
      }
    });

    const login = new LoginPage(page);
    await login.loginAs(email, password);

    try {
      await page.waitForURL(/command-center\.html/i, { timeout: 45_000 });
    } catch {
      const errText = await page.locator('#auth-error').textContent().catch(() => '');
      await guardianScreenshot(page, 'seed-login-failed');

      console.error('\n========== SEED: browser console (last 100 lines) ==========');
      for (const line of consoleLines.slice(-100)) {
        console.error(line);
      }
      console.error('========== end seed console ==========\n');

      throw new Error(seedFailureMessage(net, errText ?? ''));
    }

    await page.context().storageState({ path: authFile });
    guardianStep('seed complete', 'session saved');
  });
});
