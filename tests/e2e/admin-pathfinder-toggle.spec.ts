import { test, expect } from '@playwright/test';

test('Admin System Settings loads, saves, and immediately applies Pathfinder access', async ({ page }) => {
  let pathfinderEnabled = false;

  await page.route(/\/rest\/v1\/org_settings/i, async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      pathfinderEnabled = payload.pathfinder_enabled === true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          email_calendar_enabled: false,
          pathfinder_enabled: pathfinderEnabled
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 1,
        email_calendar_enabled: false,
        pathfinder_enabled: pathfinderEnabled
      })
    });
  });
  await page.route(/\/rest\/v1\/deal_stages/i, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.route(/\/rest\/v1\/activity_types/i, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );

  await page.goto('/admin.html#settings');
  await expect(page.locator('#global-loader-overlay')).not.toHaveClass(/\bactive\b/);

  const toggle = page.locator('#pathfinder-enabled-toggle');
  await expect(page.locator('#settings-view')).toBeVisible();
  await expect(page.getByText('Feature Access & Integrations')).toBeVisible();
  await expect(toggle).not.toBeChecked();
  await expect(page.locator('#pathfinder-nav-button')).toHaveClass(/\bhidden\b/);

  const saveRequest = page.waitForRequest((request) =>
    /\/rest\/v1\/org_settings/i.test(request.url()) && request.method() === 'POST'
  );
  await toggle.check();
  const request = await saveRequest;

  expect(request.postDataJSON()).toMatchObject({ id: 1, pathfinder_enabled: true });
  await expect(page.locator('#pathfinder-enabled-hint')).toContainText('On');
  await expect(page.locator('#pathfinder-nav-button')).not.toHaveClass(/\bhidden\b/);
  await expect(page.locator('#pathfinder-nav-button')).toHaveAttribute('aria-hidden', 'false');
});
