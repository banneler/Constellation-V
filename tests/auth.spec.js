const { test, expect } = require('@playwright/test');

test('User can log in and access the command center', async ({ page }) => {
  // Navigate to the root of the site
  await page.goto('/');

  // Get the current URL
  const url = page.url();

  // Check if we are already logged in and on the command center page
  if (!url.includes('command-center.html')) {
    // If we are not on the command center, then we must be on the login page.
    // Wait for the email input to be visible to be sure.
    await expect(page.locator('#auth-email')).toBeVisible({ timeout: 15000 });

    console.log('Not logged in. Proceeding with login steps...');

    // Fill in the email and password
    // IMPORTANT: Make sure these are the correct credentials for a test user.
    await page.locator('#auth-email').fill('test@example.com');
    await page.locator('#auth-password').fill('password123');

    // Click the login button
    await page.locator('#auth-submit-btn').click();
  } else {
    console.log('Already logged in. Skipping login steps.');
  }

  // The final and most important check: Are we on the command center page?
  // This will pass whether we just logged in or were already logged in.
  await expect(page).toHaveURL(/.*command-center.html/, { timeout: 15000 });

  // And verify that a key element of the dashboard is visible
  await expect(page.locator('h2', { hasText: 'My Tasks' })).toBeVisible();

  console.log('Successfully verified on the command center page.');
});
