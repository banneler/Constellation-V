const { test, expect } = require('@playwright/test');

test('User can log in and access the command center', async ({ page }) => {
  // Navigate to the root of the site
  await page.goto('/');

  // Get the current URL
  const url = page.url();

  // Check if we are already on the command center page
  if (!url.includes('command-center.html')) {
    // If not, we expect the login page. Wait for the email input.
    await expect(page.locator('#auth-email')).toBeVisible({ timeout: 15000 });

    console.log('Not logged in. Proceeding with login steps...');
    await page.locator('#auth-email').fill('test@example.com');
    await page.locator('#auth-password').fill('password123');
    await page.locator('#auth-submit-btn').click();
  } else {
    console.log('Already logged in. Skipping login steps.');
  }

  // THE FINAL FIX: Instead of checking the URL, wait for a unique and stable element
  // on the destination page to be visible. The <h2>My Tasks</h2> header is perfect for this.
  const dashboardHeader = page.locator('h2', { hasText: 'My Tasks' });

  // Wait up to 20 seconds for this element to appear. This is the definitive proof of a successful login.
  await expect(dashboardHeader).toBeVisible({ timeout: 20000 });

  // Now that we know the page is loaded, we can confidently assert the URL is correct.
  await expect(page).toHaveURL(/.*command-center.html/);

  console.log('Successfully verified on the command center page.');
});
