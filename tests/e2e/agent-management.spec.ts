import { test, expect, type Locator, type Page } from '@playwright/test';

const e2eAgentName = `Test E2E Agent ${Date.now()}`;

async function openAgentManagement(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Agents' }).click();
  await expect(page.getByRole('heading', { name: 'Agents', level: 1, exact: true })).toBeVisible();
}

function agentRow(page: Page, name: string) {
  return page.getByRole('row', { name: new RegExp(name) });
}

async function openActionsFor(row: Locator) {
  await row.getByRole('button', { name: /Open actions/ }).hover();
}

async function fillAgentDialog(
  dialog: Locator,
  values: { name?: string; role?: string; model?: string; instructions?: string }
) {
  if (values.name !== undefined) {
    await dialog.getByLabel('Name', { exact: true }).fill(values.name);
  }

  if (values.role !== undefined) {
    await dialog.getByLabel('Role', { exact: true }).fill(values.role);
  }

  if (values.model !== undefined) {
    await dialog.getByLabel('Model', { exact: true }).fill(values.model);
  }

  if (values.instructions !== undefined) {
    await dialog.getByLabel('Instructions', { exact: true }).fill(values.instructions);
  }
}

test.describe.serial('Agent Management E2E', () => {
  test('Task 1.1: list agents', async ({ page }) => {
    await openAgentManagement(page);

    // Verify page header
    await expect(page.getByRole('heading', { name: 'Agents', level: 1, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Agent list' })).toBeVisible();

    const table = page.getByRole('table', { name: 'Agents table' });
    await expect(table).toBeVisible();
    await expect(table.getByRole('row').nth(1)).toBeVisible();
  });

  test('Task 1.2: create valid agent', async ({ page }) => {
    await openAgentManagement(page);

    await page.getByRole('button', { name: 'New Agent' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create agent' });
    await expect(dialog).toBeVisible();

    await fillAgentDialog(dialog, {
      name: e2eAgentName,
      role: 'E2E Tester',
      model: 'openrouter/owl-alpha',
      instructions: 'Run playwright tests automatically.'
    });

    await dialog.getByRole('button', { name: 'Create agent' }).click();

    // Verify the new agent appears in the list
    const testAgent = agentRow(page, e2eAgentName);
    await expect(testAgent).toBeVisible();
    await expect(testAgent.getByText('E2E Tester')).toBeVisible();
    await expect(testAgent.getByText('openrouter/owl-alpha')).toBeVisible();
  });

  test('Task 1.3: invalid form shows errors', async ({ page }) => {
    await openAgentManagement(page);

    await page.getByRole('button', { name: 'New Agent' }).click();
    await expect(page.getByRole('dialog', { name: 'Create agent' })).toBeVisible();

    // Submit empty form
    await page.getByRole('button', { name: 'Create agent' }).click();

    const errors = page.getByRole('alert');
    await expect(errors.first()).toBeVisible();
  });

  test('Task 1.4: edit agent', async ({ page }) => {
    await openAgentManagement(page);

    const testAgent = agentRow(page, e2eAgentName);
    await openActionsFor(testAgent);
    await testAgent.getByRole('button', { name: 'Configure' }).click();
    const dialog = page.getByRole('dialog', { name: 'Configure agent' });
    await expect(dialog).toBeVisible();

    // We can't change name in edit mode (readonly), so we change role
    await fillAgentDialog(dialog, { role: 'Senior E2E Tester' });
    
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await expect(testAgent.getByText('Senior E2E Tester')).toBeVisible();
  });

  test('Task 1.5: disable agent', async ({ page }) => {
    await openAgentManagement(page);

    const testAgent = agentRow(page, e2eAgentName);
    await openActionsFor(testAgent);
    await testAgent.getByRole('button', { name: /Disable/ }).click();

    // Verify status changes to Disabled
    await expect(testAgent.getByText('Disabled')).toBeVisible();
    await expect(testAgent.getByRole('button', { name: /Enable/ })).toBeVisible();
  });

  test('Task 1.6: enable agent', async ({ page }) => {
    await openAgentManagement(page);

    const testAgent = agentRow(page, e2eAgentName);
    await openActionsFor(testAgent);
    await testAgent.getByRole('button', { name: /Enable/ }).click();

    // Verify status changes back to Enabled
    await expect(testAgent.getByText('Enabled')).toBeVisible();
    await expect(testAgent.getByRole('button', { name: /Disable/ })).toBeVisible();
  });

  test('Task 1.7: delete agent', async ({ page }) => {
    await openAgentManagement(page);

    const testAgent = agentRow(page, e2eAgentName);
    
    await openActionsFor(testAgent);
    await testAgent.getByRole('button', { name: /Delete/ }).click();

    // Wait for the modal and click Delete
    const deleteModal = page.getByRole('dialog', { name: 'Delete agent' });
    await expect(deleteModal).toBeVisible();
    await deleteModal.getByRole('button', { name: 'Delete' }).click();

    // Verify agent is removed from the list
    await expect(testAgent).not.toBeVisible();
  });
});
