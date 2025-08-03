const { test, expect } = require('@playwright/test');

test('User can log in and access the command center', async ({ page }) => {
  // Navigate to the root of the site
  await page.goto('/');

  const url = page.url();

  // Check if we are already on the command center page
  if (!url.includes('command-center.html')) {
    // If not, perform the login steps
    await expect(page.locator('#auth-email')).toBeVisible({ timeout: 15000 });
    console.log('Not logged in. Proceeding with login steps...');
    await page.locator('#auth-email').fill('banneler@gpcom.com');
    await page.locator('#auth-password').fill('KCchiefs1');
    await page.locator('#auth-submit-btn').click();
  } else {
    console.log('Already logged in. Skipping login steps.');
  }

  // THE ULTIMATE FIX: Wait for the user's name to appear in the nav bar.
  // This is the true signal that the page has loaded AND authenticated data has been fetched.
  const userNameDisplay = page.locator('#user-name-display');
  
  // We will wait up to 30 seconds for the user's name to be visible and to NOT be "Loading..."
  await expect(userNameDisplay).toBeVisible({ timeout: 30000 });
  await expect(userNameDisplay).not.toHaveText('Loading...', { timeout: 30000 });

  // NOW that we know the page is fully hydrated and ready, we can safely test the content.
  const dashboardHeader = page.locator('h2', { hasText: 'My Tasks' });
  await expect(dashboardHeader).toBeVisible();

  // And finally, assert the URL is correct.
  await expect(page).toHaveURL(/.*command-center.html/);

  console.log('Successfully verified on the command center page.');
});
