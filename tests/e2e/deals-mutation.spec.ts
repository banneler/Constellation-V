import { test, expect, type Page } from '@playwright/test';
import { waitForAppReady } from '../helpers/guardian-log';

const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';
const SUPABASE_REF = 'pjxcciepfypzrfmlfchj';

const DEAL_STAGES = [
  { stage_name: 'Discovery', sort_order: 1 },
  { stage_name: 'Proposal', sort_order: 2 },
  { stage_name: 'Negotiation', sort_order: 3 },
  { stage_name: 'Closed Won', sort_order: 4 },
  { stage_name: 'Closed Lost', sort_order: 5 },
];

type MockOptions = {
  createError?: { status: number; code: string; message: string };
};

function encodeJwt(payload: Record<string, unknown>): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.mock-signature`;
}

function mockSession() {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: MOCK_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'deals-mutation@example.com',
    user_metadata: { full_name: 'Deal Mock User', is_manager: false },
    app_metadata: {},
  };
  return {
    access_token: encodeJwt({
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      aud: 'authenticated',
      exp: now + 60 * 60 * 24,
      iat: now,
    }),
    refresh_token: 'mock-refresh-token',
    expires_in: 60 * 60 * 24,
    expires_at: now + 60 * 60 * 24,
    token_type: 'bearer',
    user,
  };
}

function wantsSingleObject(request: { headers: () => Record<string, string> }): boolean {
  return (request.headers().accept || '').includes('application/vnd.pgrst.object');
}

function json(route: { fulfill: (r: object) => Promise<void> }, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installMockSession(page: Page) {
  const session = mockSession();
  await page.addInitScript(({ storageKey, session: stored }) => {
    localStorage.setItem(storageKey, JSON.stringify(stored));
  }, { storageKey: `sb-${SUPABASE_REF}-auth-token`, session });
  return session;
}

async function mockDealRest(page: Page, options: MockOptions = {}) {
  const account = {
    id: 501,
    name: 'Tom',
    user_id: MOCK_USER_ID,
    notes: '',
    is_customer: false,
  };
  let deals: Array<Record<string, unknown>> = [];
  let nextDealId = 901;
  let createCount = 0;
  let stageUpdateCount = 0;
  let lastStageUpdate: Record<string, unknown> | null = null;
  const liveRestHits: string[] = [];

  // Playwright matches the last registered route first. Register the
  // supabase.co safety net before the specific REST/auth handlers.
  await page.route(/supabase\.co/i, async (route) => {
    const url = route.request().url();
    if (/\/rest\/v1\//i.test(url) || /\/auth\/v1\//i.test(url)) {
      liveRestHits.push(`${route.request().method()} ${url}`);
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route(/\/auth\/v1\//i, async (route) => {
    const session = mockSession();
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await json(route, { ...session.user, ...session });
  });

  await page.route(/\/rest\/v1\//i, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop() || '';
    const method = request.method();

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (table === 'deals') {
      if (method === 'GET') {
        await json(route, deals);
        return;
      }
      if (method === 'POST') {
        createCount += 1;
        if (options.createError) {
          await json(route, options.createError, options.createError.status);
          return;
        }
        const payload = request.postDataJSON();
        const row = Array.isArray(payload) ? payload[0] : payload;
        const created = { id: nextDealId, ...row };
        nextDealId += 1;
        deals = [...deals, created];
        await json(route, wantsSingleObject(request) ? created : [created], 201);
        return;
      }
      if (method === 'PATCH') {
        const payload = request.postDataJSON() || {};
        const idParam = url.searchParams.get('id');
        const dealId = idParam?.startsWith('eq.') ? Number(idParam.slice(3)) : null;
        if (payload && Object.prototype.hasOwnProperty.call(payload, 'stage')) {
          stageUpdateCount += 1;
          lastStageUpdate = payload;
        }
        deals = deals.map((row) => (row.id === dealId ? { ...row, ...payload } : row));
        await route.fulfill({ status: 204, body: '' });
        return;
      }
    }

    if (table === 'accounts') {
      await json(route, method === 'GET' ? [account] : []);
      return;
    }

    if (table === 'deal_stages') {
      await json(route, DEAL_STAGES);
      return;
    }

    if (table === 'user_quotas') {
      const quota = { user_id: MOCK_USER_ID, full_name: 'Deal Mock User', monthly_quota: 50000, show_in_pipeline: true };
      if (method === 'GET') {
        await json(route, wantsSingleObject(request) ? quota : [quota]);
        return;
      }
      await json(route, wantsSingleObject(request) ? quota : [quota], method === 'POST' ? 201 : 200);
      return;
    }

    if (table === 'user_preferences') {
      const prefs = { user_id: MOCK_USER_ID, theme: 'dark' };
      if (method === 'GET') {
        await json(route, wantsSingleObject(request) ? prefs : [prefs]);
        return;
      }
      await json(route, wantsSingleObject(request) ? prefs : [prefs], method === 'POST' ? 201 : 200);
      return;
    }

    if (table === 'org_settings') {
      const settings = { id: 1, pathfinder_enabled: false, email_calendar_enabled: false };
      await json(route, wantsSingleObject(request) ? settings : [settings]);
      return;
    }

    await route.fulfill({
      status: method === 'GET' ? 200 : 204,
      contentType: 'application/json',
      body: method === 'GET' ? '[]' : '',
    });
  });

  return {
    createCount: () => createCount,
    stageUpdateCount: () => stageUpdateCount,
    lastStageUpdate: () => lastStageUpdate,
    liveRestHits: () => liveRestHits,
  };
}

async function openDeals(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installMockSession(page);
  await page.goto('/deals.html');
  await waitForAppReady(page);
  const backdrop = page.locator('#modal-backdrop');
  if (await backdrop.isVisible()) {
    const title = (await page.locator('#modal-title').textContent())?.trim();
    if (title !== 'Loading Error') {
      await backdrop.evaluate((element) => element.classList.add('hidden'));
    }
  }
}

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Deal mutation hardening', () => {
  test('composer creates once, then a stage change patches once', async ({ page }) => {
    const mock = await mockDealRest(page);
    await openDeals(page);

    await page.locator('#add-deal-btn').click();
    await expect(page.locator('#new-deal-inline-container')).toBeVisible();
    await page.locator('#new-deal-save-btn').click();
    await expect(page.getByText('Deal name is required.')).toBeVisible();
    expect(mock.createCount()).toBe(0);

    await page.locator('#modal-deal-name').fill('Mocked Persist Deal');
    await page.locator('#new-deal-save-btn').click();
    await expect.poll(mock.createCount).toBe(1);
    await expect(page.locator('#deals-table')).toContainText('Mocked Persist Deal');
    expect(mock.createCount()).toBe(1);
    expect(mock.stageUpdateCount()).toBe(0);

    const row = page.locator('#deals-table tbody tr').filter({ hasText: 'Mocked Persist Deal' });
    await row.locator('td[data-field="stage"]').click();
    await row.locator('.deal-card-stage-pill[data-stage="Proposal"]').click();
    await expect.poll(mock.stageUpdateCount).toBe(1);
    expect(mock.lastStageUpdate()).toMatchObject({ stage: 'Proposal' });
    await expect(row.locator('td[data-field="stage"]')).toContainText('Proposal');
    expect(mock.createCount()).toBe(1);
    expect(mock.liveRestHits()).toEqual([]);
  });

  test('create errors stay friendly and do not persist', async ({ page }) => {
    const mock = await mockDealRest(page, {
      createError: { status: 403, code: '42501', message: 'new row violates row-level security policy' },
    });
    await openDeals(page);
    await page.locator('#add-deal-btn').click();
    await page.locator('#modal-deal-name').fill('Blocked Deal');
    await page.locator('#new-deal-save-btn').click();

    await expect.poll(mock.createCount).toBe(1);
    await expect(page.getByText('You do not have access to create this deal')).toBeVisible();
    await expect(page.getByText('new row violates row-level security policy')).toHaveCount(0);
    await expect(page.locator('#deals-table')).not.toContainText('Blocked Deal');
    expect(mock.stageUpdateCount()).toBe(0);
    expect(mock.liveRestHits()).toEqual([]);
  });
});
