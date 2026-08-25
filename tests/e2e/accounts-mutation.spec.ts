import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/guardian-log';

type MockOptions = {
  createError?: { status: number; code: string; message: string };
  failInitialAccountsRead?: boolean;
  failRefreshAfterCreate?: boolean;
  mutationDelayMs?: number;
};

async function mockAccountRest(page: Page, options: MockOptions = {}) {
  const account = {
    id: 101,
    name: 'Existing Account',
    user_id: 'mock-owner',
    notes: '',
    is_customer: false,
  };
  let accounts = options.failInitialAccountsRead ? [] : [account];
  let accountGetCount = 0;
  let createCount = 0;
  let updateCount = 0;
  let lastUpdate: Record<string, unknown> | null = null;

  await page.route(/\/rest\/v1\//i, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop();
    const method = request.method();

    if (table === 'accounts') {
      if (method === 'GET') {
        accountGetCount += 1;
        if (options.failInitialAccountsRead || (options.failRefreshAfterCreate && createCount > 0)) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'XX000', message: 'mock account read failed' }),
          });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(accounts) });
        return;
      }
      if (method === 'POST') {
        createCount += 1;
        if (options.mutationDelayMs) await new Promise((resolve) => setTimeout(resolve, options.mutationDelayMs));
        if (options.createError) {
          await route.fulfill({
            status: options.createError.status,
            contentType: 'application/json',
            body: JSON.stringify(options.createError),
          });
          return;
        }
        const payload = request.postDataJSON();
        const created = { ...payload[0], id: 202 };
        accounts = [...accounts, created];
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([created]) });
        return;
      }
      if (method === 'PATCH') {
        updateCount += 1;
        lastUpdate = request.postDataJSON();
        if (options.mutationDelayMs) await new Promise((resolve) => setTimeout(resolve, options.mutationDelayMs));
        accounts = accounts.map((row) => row.id === 101 ? { ...row, ...lastUpdate } : row);
        await route.fulfill({ status: 204, body: '' });
        return;
      }
    }

    if (table === 'org_settings') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, pathfinder_enabled: false }),
      });
      return;
    }
    if (table === 'account_plans' && request.headers().accept?.includes('application/vnd.pgrst.object')) {
      await route.fulfill({
        status: 406,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }),
      });
      return;
    }
    await route.fulfill({ status: method === 'GET' ? 200 : 204, contentType: 'application/json', body: method === 'GET' ? '[]' : '' });
  });

  return {
    createCount: () => createCount,
    updateCount: () => updateCount,
    accountGetCount: () => accountGetCount,
    lastUpdate: () => lastUpdate,
  };
}

async function openAccounts(page: Page, query = '') {
  await page.goto(`/accounts.html${query}`);
  await waitForAppReady(page);
  const backdrop = page.locator('#modal-backdrop');
  if (await backdrop.isVisible()) {
    const title = (await page.locator('#modal-title').textContent())?.trim();
    if (title !== 'Loading Error') {
      await backdrop.evaluate((element) => element.classList.add('hidden'));
    }
  }
}

test.describe('Account mutation hardening', () => {
  test('Enter creates once and rapid clicks create once', async ({ page }) => {
    const mock = await mockAccountRest(page, { mutationDelayMs: 250 });
    await openAccounts(page);

    await page.locator('#add-account-btn').click();
    await page.locator('#modal-account-name').fill('Enter Account');
    await page.locator('#modal-account-name').press('Enter');
    await expect.poll(mock.createCount).toBe(1);
    await expect(page.getByText('Account “Enter Account” created.')).toBeVisible();

    await page.locator('#add-account-btn').click();
    await page.locator('#modal-account-name').fill('Double Click Account');
    await page.locator('#modal-confirm-btn').evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect.poll(mock.createCount).toBe(2);
  });

  for (const scenario of [
    {
      label: 'duplicate',
      error: { status: 409, code: '23505', message: 'duplicate key value violates unique constraint accounts_name_user_id_key' },
      expected: 'An account with this name already exists',
    },
    {
      label: 'RLS',
      error: { status: 403, code: '42501', message: 'new row violates row-level security policy' },
      expected: 'You do not have access to create this account',
    },
  ]) {
    test(`${scenario.label} create errors are friendly`, async ({ page }) => {
      await mockAccountRest(page, { createError: scenario.error });
      await openAccounts(page);
      await page.locator('#add-account-btn').click();
      await page.locator('#modal-account-name').fill('Blocked Account');
      await page.locator('#modal-confirm-btn').click();
      await expect(page.locator('#new-account-status')).toContainText(scenario.expected);
      await expect(page.locator('#new-account-status')).not.toContainText(scenario.error.message);
    });
  }

  test('successful create reports a later refresh failure', async ({ page }) => {
    const mock = await mockAccountRest(page, { failRefreshAfterCreate: true });
    await openAccounts(page);
    await page.locator('#add-account-btn').click();
    await page.locator('#modal-account-name').fill('Refresh Failure Account');
    await page.locator('#modal-confirm-btn').click();

    await expect.poll(mock.createCount).toBe(1);
    await expect(page.getByText('Account created, but the page could not refresh.')).toBeVisible();
    await expect(page.locator('#account-list')).toContainText('Refresh Failure Account');
  });

  test('existing save locks and preserves long multiline notes', async ({ page }) => {
    const mock = await mockAccountRest(page, { mutationDelayMs: 300 });
    await openAccounts(page);
    await waitForAppReady(page);
    await page.locator('#account-list .list-item').filter({ hasText: 'Existing Account' }).click();
    const notes = `First line\n${'Long account context '.repeat(60)}\nFinal line`;
    await expect(page.locator('#account-id')).toHaveValue('101');
    await page.locator('#account-notes').fill(notes);

    const busyState = await page.locator('#account-form').evaluate((form: HTMLFormElement) => {
      form.requestSubmit();
      form.requestSubmit();
      const button = form.querySelector<HTMLButtonElement>('#save-account-btn');
      return { disabled: button?.disabled, ariaBusy: button?.getAttribute('aria-busy') };
    });
    expect(busyState).toEqual({ disabled: true, ariaBusy: 'true' });
    await expect.poll(mock.updateCount).toBe(1);
    await expect.poll(() => mock.lastUpdate()?.notes).toBe(notes);
    await expect(page.locator('#save-account-btn')).toBeEnabled();
  });

  test('new-account action remains reachable in a 200% equivalent viewport', async ({ page }) => {
    await page.setViewportSize({ width: 195, height: 325 });
    await mockAccountRest(page);
    await openAccounts(page);
    await page.locator('#add-account-mobile-btn').click();

    const create = page.locator('#modal-confirm-btn');
    await expect(create).toBeVisible();
    const box = await create.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.y || 0) + (box?.height || 0)).toBeLessThanOrEqual(325);
  });

  test('startup account read failure does not leave Add Account inert', async ({ page }) => {
    await mockAccountRest(page, { failInitialAccountsRead: true });
    await openAccounts(page);
    await expect(page.getByRole('heading', { name: 'Loading Error' })).toBeVisible();
    await page.locator('#modal-ok-btn').click();
    await page.locator('#add-account-btn').click();
    await expect(page.locator('#new-account-form')).toBeVisible();
    await expect(page.locator('#modal-account-name')).toBeFocused();
  });
});
