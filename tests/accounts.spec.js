const { test, expect } = require('@playwright/test');

// A reusable setup block that runs before every test in this file.
test.beforeEach(async ({ page }) => {
  // 1. Log in
  await page.goto('/');
  const url = page.url();
  if (!url.includes('command-center.html')) {
    await expect(page.locator('#auth-email')).toBeVisible({ timeout: 15000 });
    await page.locator('#auth-email').fill(process.env.TEST_USER_EMAIL);
    await page.locator('#auth-password').fill(process.env.TEST_USER_PASSWORD);
    await page.locator('#auth-submit-btn').click();
  }

  // 2. Wait for the dashboard to be fully loaded
  const userNameDisplay = page.locator('#user-name-display');
  await expect(userNameDisplay).toBeVisible({ timeout: 30000 });
  await expect(userNameDisplay).not.toHaveText('Loading...', { timeout: 30000 });

  // 3. Navigate to the Accounts page
  await page.locator('a.nav-button[href="accounts.html"]').click();

  // 4. Verify we are on the Accounts page
  await expect(page.locator('h2', { hasText: 'Accounts' })).toBeVisible();
});

test('User can create and then edit a new account', async ({ page }) => {
  // --- PART 1: CREATE ACCOUNT ---
  const uniqueAccountName = `TestCo_${Date.now()}`;
  await page.locator('#add-account-btn').click();

  // Wait for the modal and fill in the name
  const modalAccountNameInput = page.locator('#modal-account-name');
  await expect(modalAccountNameInput).toBeVisible();
  await modalAccountNameInput.fill(uniqueAccountName);
  await page.locator('#modal-confirm-btn').click();

  // Verify the new account appears in the list and is selected
  const newAccountInList = page.locator('.list-item.selected');
  await expect(newAccountInList).toContainText(uniqueAccountName);

  // --- PART 2: EDIT ACCOUNT ---
  const updatedWebsite = `https://www.${uniqueAccountName.toLowerCase()}.com`;

  // The form should be visible after creation, now we edit it
  await page.locator('#account-website').fill(updatedWebsite);
  await page.locator('#account-industry').fill('Technology');
  await page.locator('#account-is-customer').check();
  await page.locator('button[type="submit"]:has-text("Save Changes")').click();

  // To verify the save, we will click on another account and then click back
  // This forces the app to re-load the data from the database
  await page.locator('.list-item').first().click();
  await newAccountInList.click(); // Click back on our test account

  // Verify the updated information is still there
  await expect(page.locator('#account-website')).toHaveValue(updatedWebsite);
  await expect(page.locator('#account-industry')).toHaveValue('Technology');
  await expect(page.locator('#account-is-customer')).toBeChecked();
});

test('User can add a new deal to an account', async ({ page }) => {
    // --- Setup: Create a unique account first ---
    const uniqueAccountName = `DealCo_${Date.now()}`;
    await page.locator('#add-account-btn').click();
    const modalAccountNameInput = page.locator('#modal-account-name');
    await expect(modalAccountNameInput).toBeVisible();
    await modalAccountNameInput.fill(uniqueAccountName);
    await page.locator('#modal-confirm-btn').click();
    await expect(page.locator('.list-item.selected')).toContainText(uniqueAccountName);

    // --- Test: Add a Deal ---
    await page.locator('#add-deal-btn').click();

    const uniqueDealName = `Test Deal ${Date.now()}`;
    await expect(page.locator('#modal-deal-name')).toBeVisible();
    await page.locator('#modal-deal-name').fill(uniqueDealName);
    await page.locator('#modal-deal-mrc').fill('5000');
    await page.locator('#modal-confirm-btn').click();

    // --- Verification ---
    // Verify the new deal appears in the deals table on the account page
    const dealsTable = page.locator('#account-deals-table');
    const dealRow = dealsTable.locator('tr', { hasText: uniqueDealName });
    await expect(dealRow).toBeVisible();
    await expect(dealRow).toContainText('$5000');
});

test('User can add a new task to an account', async ({ page }) => {
    // --- Setup: Create a unique account first ---
    const uniqueAccountName = `TaskCo_${Date.now()}`;
    await page.locator('#add-account-btn').click();
    const modalAccountNameInput = page.locator('#modal-account-name');
    await expect(modalAccountNameInput).toBeVisible();
    await modalAccountNameInput.fill(uniqueAccountName);
    await page.locator('#modal-confirm-btn').click();
    await expect(page.locator('.list-item.selected')).toContainText(uniqueAccountName);

    // --- Test: Add a Task ---
    await page.locator('#add-task-account-btn').click();
    const taskDescription = `Follow up with ${uniqueAccountName}`;
    await expect(page.locator('#modal-task-description')).toBeVisible();
    await page.locator('#modal-task-description').fill(taskDescription);
    await page.locator('#modal-confirm-btn').click();

    // --- Verification ---
    // Navigate to the Command Center to see if the task was created
    await page.locator('a.nav-button[href="command-center.html"]').click();

    const tasksTable = page.locator('#my-tasks-table');
    const taskRow = tasksTable.locator('tr', { hasText: taskDescription });
    await expect(taskRow).toBeVisible();
    // Also verify it's linked to the correct account
    await expect(taskRow).toContainText(uniqueAccountName);
});
