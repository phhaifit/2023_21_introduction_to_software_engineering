import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Workflow Import/Export Feature', () => {
  const invalidJsonPath = path.join(process.cwd(), 'tests', 'e2e', 'invalid_workflow.json');
  const validJsonPath = path.join(process.cwd(), 'tests', 'e2e', 'valid_workflow.json');

  test.beforeAll(() => {
    fs.writeFileSync(invalidJsonPath, '{ invalid_json: "');
    fs.writeFileSync(validJsonPath, JSON.stringify({
      name: "Test Imported Workflow",
      description: "This is an imported workflow description.",
      triggerType: "manual",
      triggerConfig: {},
      steps: []
    }));
  });

  test.afterAll(() => {
    if (fs.existsSync(invalidJsonPath)) fs.unlinkSync(invalidJsonPath);
    if (fs.existsSync(validJsonPath)) fs.unlinkSync(validJsonPath);
  });

  test('should export an existing workflow successfully', async ({ page }) => {
    // Seed a workflow via API request before loading the page
    const createResponse = await page.request.post('/api/workspaces/demo_workspace_1/workflows', {
      data: {
        name: "E2E Test Workflow",
        description: "Workflow created for E2E verification",
        status: "published",
        triggerType: "manual",
        steps: []
      }
    });
    expect(createResponse.ok()).toBeTruthy();

    await page.goto('/workflows');
    await page.getByRole('button', { name: 'List' }).click();
    await expect(page.getByRole('table')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTitle('Export Workflow').first().click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/workflow-.*\.json/);
    
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    
    const content = fs.readFileSync(downloadPath!, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty('name');
    expect(parsed).toHaveProperty('steps');
  });

  test('should show an alert when importing an invalid JSON file', async ({ page }) => {
    await page.goto('/workflows');
    await page.getByRole('button', { name: 'List' }).click();

    let dialogMessage = '';
    page.once('dialog', dialog => {
      dialogMessage = dialog.message();
      dialog.accept();
    });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Import Workflow').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(invalidJsonPath);

    await page.waitForTimeout(500);
    expect(dialogMessage).toContain('Failed to parse the imported JSON file');
  });

  test('should successfully import a valid JSON file and navigate to Editor', async ({ page }) => {
    await page.goto('/workflows');
    await page.getByRole('button', { name: 'List' }).click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Import Workflow').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(validJsonPath);

    await expect(page.getByRole('button', { name: 'Create Workflow' })).toBeVisible();
    
    await expect(page.getByLabel('Workflow Name')).toHaveValue('Test Imported Workflow');
    await expect(page.getByLabel('Description')).toHaveValue('This is an imported workflow description.');
  });
});
