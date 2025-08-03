const { test, expect } = require('@playwright/test');

// This beforeEach block runs before each test in this file, ensuring we are logged in.
test.beforeEach(async ({ page }) => {
  await page.goto('/');

  const url = page.url();
  if (!url.includes('command-center.html')) {
    await expect(page.locator('#auth-email')).toBeVisible({ timeout: 15000 });
    await page.locator('#auth-email').fill(process.env.TEST_USER_EMAIL);
    await page.locator('#auth-password').fill(process.env.TEST_USER_PASSWORD);
    await page.locator('#auth-submit-btn').click();
  }

  const userNameDisplay = page.locator('#user-name-display');
  await expect(userNameDisplay).toBeVisible({ timeout: 30000 });
  await expect(userNameDisplay).not.toHaveText('Loading...', { timeout: 30000 });
});

// Test Case 1: Logging an activity for a contact
test('User can log an activity for a contact', async ({ page }) => {
  // --- Setup: Create a unique contact for this test ---
  const uniqueFirstName = `ActivityLog_${Date.now()}`;
  const uniqueLastName = 'User';
  await page.locator('a.nav-button[href="contacts.html"]').click();
  await page.locator('#add-contact-btn').click();
  await page.locator('#contact-first-name').fill(uniqueFirstName);
  await page.locator('#contact-last-name').fill(uniqueLastName);
  await page.locator('button[type="submit"]:has-text("Save Changes")').click();
  // Verify the new contact is created and selected
  await expect(page.locator('.list-item.selected')).toContainText(`${uniqueFirstName} ${uniqueLastName}`);

  // --- Test: Log an activity ---
  await page.locator('#log-activity-btn').click();

  // The modal appears, wait for the dropdown to be there
  const activityTypeDropdown = page.locator('#modal-activity-type');
  await expect(activityTypeDropdown).toBeVisible();

  // Select the first available activity type (assumes at least one exists)
  await activityTypeDropdown.selectOption({ index: 1 });

  const activityDescription = `This is a test activity log @ ${new Date().toLocaleTimeString()}`;
  await page.locator('#modal-activity-description').fill(activityDescription);

  await page.locator('#modal-confirm-btn').click();

  // --- Verification ---
  // Look for the new activity in the activity list on the page
  const activityList = page.locator('#contact-activities-list');
  await expect(activityList).toContainText(activityDescription);
});


// Test Case 2: Adding a task for a contact
test('User can add a task for a contact', async ({ page }) => {
  // --- Setup: Create another unique contact for this test ---
  const uniqueFirstName = `Task_${Date.now()}`;
  const uniqueLastName = 'User';
  await page.locator('a.nav-button[href="contacts.html"]').click();
  await page.locator('#add-contact-btn').click();
  await page.locator('#contact-first-name').fill(uniqueFirstName);
  await page.locator('#contact-last-name').fill(uniqueLastName);
  await page.locator('button[type="submit"]:has-text("Save Changes")').click();
  // Verify the new contact is created and selected
  await expect(page.locator('.list-item.selected')).toContainText(`${uniqueFirstName} ${uniqueLastName}`);

  // --- Test: Add a task ---
  await page.locator('#add-task-contact-btn').click();

  const taskDescription = `Follow up with ${uniqueFirstName}`;
  await expect(page.locator('#modal-task-description')).toBeVisible();
  await page.locator('#modal-task-description').fill(taskDescription);

  // Set a due date for tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowFormat = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
  await page.locator('#modal-task-due-date').fill(tomorrowFormat);

  await page.locator('#modal-confirm-btn').click();

  // --- Verification ---
  // The task appears on the Command Center, so we need to go there to verify
  await page.locator('a.nav-button[href="command-center.html"]').click();

  // Find the row in the "My Tasks" table that contains our unique description
  const tasksTable = page.locator('#my-tasks-table');
  const taskRow = tasksTable.locator('tr', { hasText: taskDescription });

  await expect(taskRow).toBeVisible();
  // Also verify it's linked to the correct contact
  await expect(taskRow).toContainText(uniqueFirstName);
});
