const { test, expect } = require('@playwright/test');

test('User can log in and access the command center', async ({ page }) => {
  // Navigate to the root of the site
  await page.goto('/');
  const url = page.url();

  if (!url.includes('command-center.html')) {
    await expect(page.locator('#auth-email')).toBeVisible({ timeout: 15000 });
    console.log('Not logged in. Proceeding with login steps...');

    // Use the secure environment variables passed from the workflow
    await page.locator('#auth-email').fill(process.env.TEST_USER_EMAIL);
    await page.locator('#auth-password').fill(process.env.TEST_USER_PASSWORD);
    
    await page.locator('#auth-submit-btn').click();
  } else {
    console.log('Already logged in. Skipping login steps.');
  }

  const userNameDisplay = page.locator('#user-name-display');
  await expect(userNameDisplay).toBeVisible({ timeout: 30000 });
  await expect(userNameDisplay).not.toHaveText('Loading...', { timeout: 30000 });

  const dashboardHeader = page.locator('h2', { hasText: 'My Tasks' });
  await expect(dashboardHeader).toBeVisible();
  
  await expect(page).toHaveURL(/.*command-center.html/);
  console.log('Successfully verified on the command center page.');
});
