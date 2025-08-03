const { test, expect } = require('@playwright/test');

test('User can successfully log in', async ({ page }) => {
  // Navigate to the login page
  // Playwright will automatically use the baseURL from your config file
  await page.goto('/');

  // Fill in the email and password fields
  // Use environment variables for credentials in real tests, but for now, we'll hardcode them.
  // IMPORTANT: Replace with a REAL test user's email and password
  await page.locator('#auth-email').fill('banneler@gpcom.com');
  await page.locator('#auth-password').fill('KCchiefs1');

  // Click the login button
  await page.locator('#auth-submit-btn').click();

  // Wait for the navigation to the command center and verify the URL
  // This confirms the login was successful.
  await expect(page).toHaveURL(/.*command-center.html/);

  // Optional: Verify that a specific element on the dashboard is visible
  await expect(page.locator('h2', { hasText: 'My Tasks' })).toBeVisible();
});
