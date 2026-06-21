import { test, expect } from '@playwright/test';

test.describe.serial('Agent Management E2E', () => {
  test('Task 1.1: list agents', async ({ page }) => {
    await page.goto('/');

    // Verify page header
    await expect(page.getByRole('heading', { name: 'Agents' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Agent list' })).toBeVisible();

    // Verify seeded demo agents appear
    const researchAgent = page.locator('article.agent-row', { hasText: 'Research Agent' });
    await expect(researchAgent).toBeVisible();
    await expect(researchAgent.getByText('Market researcher')).toBeVisible();

    const supportAgent = page.locator('article.agent-row', { hasText: 'Support Agent' });
    await expect(supportAgent).toBeVisible();
    await expect(supportAgent.getByText('Customer support')).toBeVisible();
  });

  test('Task 1.2: create valid agent', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'New agent' }).click();

    await page.getByLabel('Name').fill('Test E2E Agent');
    await page.getByLabel('Role').fill('E2E Tester');
    await page.getByLabel('Model').fill('gpt-4');
    await page.getByLabel('Instructions').fill('Run playwright tests automatically.');

    await page.getByRole('button', { name: 'Create agent' }).click();

    // Verify the new agent appears in the list
    const testAgent = page.locator('article.agent-row', { hasText: 'Test E2E Agent' });
    await expect(testAgent).toBeVisible();
    await expect(testAgent.getByText('E2E Tester')).toBeVisible();
    await expect(testAgent.getByText('gpt-4')).toBeVisible();
  });

  test('Task 1.3: invalid form shows errors', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'New agent' }).click();

    // Submit empty form
    await page.getByRole('button', { name: 'Create agent' }).click();

    // Assuming the backend returns 400 and the UI shows errors.
    // We expect an alert or error message to appear.
    // The exact error message depends on the API validation, we just look for any error.
    const errors = page.locator('.agent-form__error');
    await expect(errors.first()).toBeVisible();
  });

  test('Task 1.4: edit agent', async ({ page }) => {
    await page.goto('/');

    const testAgent = page.locator('article.agent-row', { hasText: 'Test E2E Agent' });
    await testAgent.getByRole('button', { name: 'Edit' }).click();

    // We can't change name in edit mode (readonly), so we change role
    await page.getByLabel('Role').fill('Senior E2E Tester');
    
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(testAgent.getByText('Senior E2E Tester')).toBeVisible();
  });

  test('Task 1.5: disable agent', async ({ page }) => {
    await page.goto('/');

    const testAgent = page.locator('article.agent-row', { hasText: 'Test E2E Agent' });
    await testAgent.getByRole('button', { name: 'Disable' }).click();

    // Verify status changes to Disabled
    await expect(testAgent.locator('.agent-row__status')).toHaveText('Disabled');
    await expect(testAgent.getByRole('button', { name: 'Enable' })).toBeVisible();
  });

  test('Task 1.6: enable agent', async ({ page }) => {
    await page.goto('/');

    const testAgent = page.locator('article.agent-row', { hasText: 'Test E2E Agent' });
    await testAgent.getByRole('button', { name: 'Enable' }).click();

    // Verify status changes back to Enabled
    await expect(testAgent.locator('.agent-row__status')).toHaveText('Enabled');
    await expect(testAgent.getByRole('button', { name: 'Disable' })).toBeVisible();
  });

  test('Task 1.7: delete agent', async ({ page }) => {
    await page.goto('/');

    const testAgent = page.locator('article.agent-row', { hasText: 'Test E2E Agent' });
    
    // Set up dialog handler
    page.on('dialog', dialog => dialog.accept());

    await testAgent.getByRole('button', { name: 'Delete' }).click();

    // Verify agent is removed from the list
    await expect(testAgent).not.toBeVisible();
  });
});
