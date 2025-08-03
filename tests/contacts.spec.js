const { test, expect } = require('@playwright/test');

// A good practice is to define a "beforeEach" hook.
// This block of code will run before every single test in this file.
test.beforeEach(async ({ page }) => {
  // Navigate to the login page and log in.
  // This reuses our proven login logic and ensures each test starts from a known state.
  await page.goto('/');
  await expect(page.locator('#auth-email')).toBeVisible({ timeout: 15000 });
  await page.locator('#auth-email').fill('banneler@gpcom.com'); // <-- IMPORTANT
  await page.locator('#auth-password').fill('KCchiefs1');   // <-- IMPORTANT
  await page.locator('#auth-submit-btn').click();

  // Wait for the dashboard to be fully loaded by looking for the user's name.
  const userNameDisplay = page.locator('#user-name-display');
  await expect(userNameDisplay).toBeVisible({ timeout: 30000 });
  await expect(userNameDisplay).not.toHaveText('Loading...', { timeout: 30000 });
});

test('User can create a new contact', async ({ page }) => {
  // Create unique data for this specific test run.
  // This prevents tests from interfering with each other.
  const uniqueFirstName = `TestFirstName_${Date.now()}`;
  const uniqueLastName = `TestLastName_${Date.now()}`;
  const uniqueEmail = `test_${Date.now()}@test.com`;

  // 1. Navigate to the Contacts page from the command center
  await page.locator('a.nav-button[href="contacts.html"]').click();

  // 2. Verify we are on the Contacts page by checking for a unique element
  await expect(page.locator('h2', { hasText: 'Contacts' })).toBeVisible();

  // 3. Click the "Add New Contact" button
  await page.locator('#add-contact-btn').click();

  // 4. Fill out the new contact form
  await page.locator('#contact-first-name').fill(uniqueFirstName);
  await page.locator('#contact-last-name').fill(uniqueLastName);
  await page.locator('#contact-email').fill(uniqueEmail);
  await page.locator('#contact-phone').fill('555-123-4567');
  await page.locator('#contact-title').fill('QA Tester');

  // 5. Click the "Save Changes" button
  await page.locator('button[type="submit"]:has-text("Save Changes")').click();

  // 6. Verify the new contact appears in the contact list.
  // This is the most important check! We look for a list item that contains our unique name.
  const newContactInList = page.locator('.list-item', { hasText: `${uniqueFirstName} ${uniqueLastName}` });
  await expect(newContactInList).toBeVisible();
});
