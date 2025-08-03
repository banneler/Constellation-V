const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#auth-email')).toBeVisible({ timeout: 15000 });

  // Use the secure environment variables here as well
  await page.locator('#auth-email').fill(process.env.TEST_USER_EMAIL);
  await page.locator('#auth-password').fill(process.env.TEST_USER_PASSWORD);

  await page.locator('#auth-submit-btn').click();

  const userNameDisplay = page.locator('#user-name-display');
  await expect(userNameDisplay).toBeVisible({ timeout: 30000 });
  await expect(userNameDisplay).not.toHaveText('Loading...', { timeout: 30000 });
});

test('User can create a new contact', async ({ page }) => {
  const uniqueFirstName = `TestFirstName_${Date.now()}`;
  const uniqueLastName = `TestLastName_${Date.now()}`;
  const uniqueEmail = `test_${Date.now()}@test.com`;

  await page.locator('a.nav-button[href="contacts.html"]').click();
  await expect(page.locator('h2', { hasText: 'Contacts' })).toBeVisible();
  await page.locator('#add-contact-btn').click();
  await page.locator('#contact-first-name').fill(uniqueFirstName);
  await page.locator('#contact-last-name').fill(uniqueLastName);
  await page.locator('#contact-email').fill(uniqueEmail);
  await page.locator('#contact-phone').fill('555-123-4567');
  await page.locator('#contact-title').fill('QA Tester');
  await page.locator('button[type="submit"]:has-text("Save Changes")').click();

  const newContactInList = page.locator('.list-item', { hasText: `${uniqueFirstName} ${uniqueLastName}` });
  await expect(newContactInList).toBeVisible();
});
