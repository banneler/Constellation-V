import { test } from '@playwright/test';
import { runSmoke } from './smoke-helpers';

test.describe('Smoke (public — no auth)', () => {
  test('index.html', async ({ page }) => {
    await runSmoke(page, 'index.html', { shell: 'auth' });
  });

  test('reset-password.html', async ({ page }) => {
    await runSmoke(page, 'reset-password.html', { shell: 'auth' });
  });
});
