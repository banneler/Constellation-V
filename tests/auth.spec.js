const { test, expect } = require('@playwright/test');

test('User can successfully log in', async ({ page }) => {
  // Navigate to the login page
  await page.goto('/');

  // NEW: Wait for the email input to be visible before proceeding.
  // This ensures the page is loaded and ready for interaction.
  await expect(page.locator('#auth-email')).toBeVisible({ timeout: 10000 }); // 10-second timeout

  // Fill in the email and password fields
  // IMPORTANT: Make sure these are the correct credentials for a test user.
  await page.locator('#auth-email').fill('test@example.com');
  await page.locator('#auth-password').fill('password123');

  // Click the login button
  await page.locator('#auth-submit-btn').click();

  // Wait for the navigation to the command center and verify the URL
  await expect(page).toHaveURL(/.*command-center.html/, { timeout: 15000 }); // Increased timeout for login processing

  // Optional: Verify that a specific element on the dashboard is visible
  await expect(page.locator('h2', { hasText: 'My Tasks' })).toBeVisible();
});
