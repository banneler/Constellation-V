import { test, expect, type Page } from '@playwright/test';
import { guardianRun } from '../helpers/guardian-log';
import { PathfinderPage } from '../pages/pathfinder.page';

const candidate = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'owner-1',
  account_id: 101,
  first_name: 'Avery',
  last_name: 'Morgan',
  title: 'Director of Network Infrastructure',
  role_family: 'network',
  location: 'Omaha, NE',
  phone: null,
  profile_url: 'https://example.com/leadership',
  email_address: 'avery.morgan@example.com',
  email_status: 'inferred',
  email_pattern: 'first.last',
  email_pattern_samples: 2,
  email_confidence: 0.75,
  confidence: 0.86,
  confidence_reasons: [
    { factor: 'source_authority', score: 1, weight: 0.25 },
    { factor: 'company_match', score: 0.9, weight: 0.3 },
    { factor: 'role_match', score: 1, weight: 0.25 },
    { factor: 'recency', score: 0.8, weight: 0.1 },
    { factor: 'corroboration', score: 0.5, weight: 0.1 }
  ],
  status: 'pending',
  crm_contact_id: null,
  discovered_at: '2026-08-14T12:00:00Z',
  pathfinder_candidate_sources: [{
    id: 'source-1',
    source_url: 'https://example.com/leadership',
    source_title: 'Leadership Team',
    source_type: 'company',
    evidence_excerpt: 'Avery Morgan leads network infrastructure.',
    observed_at: '2026-08-14T12:00:00Z'
  }]
};

async function mockPathfinder(page: Page): Promise<void> {
  await page.route(/\/rest\/v1\/org_settings/i, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, pathfinder_enabled: true }) });
  });
  await page.route(/\/rest\/v1\/pathfinder_candidates/i, async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([candidate]) });
  });
  await page.route(/\/rest\/v1\/accounts/i, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 101, name: 'Example Manufacturing', user_id: 'owner-1' }]) });
  });
}

test.describe('Pathfinder', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/\/rest\/v1\/user_page_visits/i, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }
      await route.fulfill({ status: 204, body: '' });
    });
  });

  test('loads evidence-backed candidates and preserves account deep link', async ({ page }) => {
    await mockPathfinder(page);
    const pathfinder = new PathfinderPage(page);

    await guardianRun(page, 'open Pathfinder for account', () => pathfinder.goto(101));
    await expect(pathfinder.candidateCards()).toHaveCount(1);
    await expect(pathfinder.candidateGrid()).toContainText('Avery Morgan');
    await expect(pathfinder.candidateGrid()).toContainText('Pattern inferred — unverified');
    await expect(pathfinder.pendingCount()).toHaveText('1');
    await expect(page.locator('#pathfinder-nav-button')).not.toHaveClass(/\bhidden\b/);
    await expect(page.locator('#pathfinder-nav-button')).toHaveAttribute('aria-hidden', 'false');

    await page.locator('.pathfinder-evidence-btn').click();
    await expect(page.locator('#modal-body')).toContainText('Avery Morgan leads network infrastructure');
    await expect(page.locator('#modal-body a')).toHaveAttribute('href', 'https://example.com/leadership');
    await expect(page.locator('#modal-body')).toContainText('Source authority: 100% authoritative (25% weight)');
    await expect(page.locator('#modal-body')).toContainText('Company match: 90% match (30% weight)');
    await expect(page.locator('#modal-body')).toContainText('Role match: 100% match (25% weight)');
    await expect(page.locator('#modal-body')).toContainText('Recency: 80% freshness (10% weight)');
    await expect(page.locator('#modal-body')).toContainText('Corroboration: 50% corroboration (10% weight)');
    await expect(page.locator('#modal-body')).not.toContainText('[object Object]');
  });

  test('edits and approves a candidate through the transactional RPC', async ({ page }) => {
    await mockPathfinder(page);
    const pathfinder = new PathfinderPage(page);
    await pathfinder.goto();

    await page.locator('.pathfinder-review-btn').click();
    await expect(page.locator('.pathfinder-review-warning')).toContainText('has not been verified');
    await page.locator('#pathfinder-title').fill('VP, Network Infrastructure');

    const update = page.waitForRequest((request) =>
      /\/rest\/v1\/pathfinder_candidates/i.test(request.url()) && request.method() === 'PATCH'
    );
    const approval = page.waitForRequest((request) =>
      /\/rest\/v1\/rpc\/approve_pathfinder_candidate/i.test(request.url()) && request.method() === 'POST'
    );
    await page.route(/\/rest\/v1\/rpc\/approve_pathfinder_candidate/i, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '900001' });
    });
    await page.locator('#modal-confirm-btn').click();
    await update;
    await approval;
  });

  test('rejects a candidate and records the suppression decision', async ({ page }) => {
    await mockPathfinder(page);
    await page.route(/\/rest\/v1\/rpc\/reject_pathfinder_candidate/i, async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });
    const pathfinder = new PathfinderPage(page);
    await pathfinder.goto();

    await page.locator('.pathfinder-review-btn').click();
    const rejection = page.waitForRequest((request) =>
      /\/rest\/v1\/rpc\/reject_pathfinder_candidate/i.test(request.url()) && request.method() === 'POST'
    );
    await page.locator('#pathfinder-reject-btn').click();
    await rejection;
  });

  test('keeps Pathfinder navigation and content gated while disabled', async ({ page }) => {
    await page.route(/\/rest\/v1\/org_settings/i, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, pathfinder_enabled: false })
      });
    });
    const pathfinder = new PathfinderPage(page);
    await pathfinder.goto();

    await expect(page.locator('#pathfinder-nav-button')).toHaveClass(/\bhidden\b/);
    await expect(page.locator('#pathfinder-nav-button')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#pathfinder-disabled')).toBeVisible();
    await expect(page.locator('#pathfinder-content')).toBeHidden();
  });
});
