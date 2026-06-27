import { test, expect } from '@playwright/test';

// Mapping equivalent to Katalon test cases:
// WM-001 Create workspace successfully
// WM-002 View detail and delete workspace

const e2eWorkspaceName = `Test Workspace Katalon ${Date.now()}`;

test.describe.serial('Workspace Management E2E', () => {
  test('WM-001 Create workspace successfully', async ({ page }) => {
    // Step 1: Navigate to Workspace page
    await page.goto('/workspaces');
    const workspacePage = page.getByTestId('workspace-page');
    await expect(workspacePage).toBeVisible();

    // Step 2: Verify list state
    // Just ensuring page is ready

    // Step 3 & 4: Input Workspace Name
    await page.getByTestId('workspace-name-input').fill(e2eWorkspaceName);

    // Step 5: Select Profile
    await page.getByTestId('workspace-profile-select').selectOption('standard');

    // Step 6: Click Submit (Create button)
    await page.getByTestId('workspace-submit-button').click();

    // Step 7 & 8: Verify new Workspace exists in list
    const list = page.getByTestId('workspace-list');
    await expect(list).toBeVisible();

    const newWorkspaceItem = page.getByTestId('workspace-list-item').filter({ hasText: e2eWorkspaceName });
    await expect(newWorkspaceItem).toBeVisible();

    // Step 9: Verify safe Status
    const statusBadge = newWorkspaceItem.getByTestId('workspace-status');
    await expect(statusBadge).toBeVisible();
    const statusText = await statusBadge.innerText();
    expect(['Provisioning', 'Active']).toContain(statusText); // Fake provision could complete instantly

    // Step 10: Assert No Internal Data
    const pageContent = await page.content();
    expect(pageContent).not.toContain('runtimeRef');
    expect(pageContent).not.toContain('leaseToken');
    expect(pageContent).not.toContain('providerRequestKey');
  });

  test('WM-002 View detail and delete workspace', async ({ page }) => {
    // Step 1: Navigate to Workspace page
    await page.goto('/workspaces');
    await expect(page.getByTestId('workspace-page')).toBeVisible();

    // Step 2: Click on the Workspace item to go to detail
    const workspaceItem = page.getByTestId('workspace-list-item').filter({ hasText: e2eWorkspaceName });
    await workspaceItem.getByText('View details').click();

    // Step 3: Verify Detail Page
    const detailPanel = page.getByTestId('workspace-detail');
    await expect(detailPanel).toBeVisible();

    // Step 4: Verify safe fields
    await expect(detailPanel).toContainText(e2eWorkspaceName);

    // Step 5: Assert No Internal Data
    const pageContent = await page.content();
    expect(pageContent).not.toContain('runtimeRef');
    expect(pageContent).not.toContain('leaseToken');

    // Step 6: Click Delete button
    await page.getByTestId('workspace-delete-button').click();
    const confirmDialog = page.getByTestId('workspace-delete-confirm-dialog');
    await expect(confirmDialog).toBeVisible();

    // Step 7: Click Confirm Delete
    // The dialog has a confirmation checkbox
    await confirmDialog.getByRole('checkbox').check();
    await page.getByTestId('workspace-delete-confirm-button').click();

    // Step 8: Wait for Delete response
    await expect(confirmDialog).not.toBeVisible();

    // Step 9: Verify UI State
    await expect(page.getByTestId('workspace-status')).toContainText('Deleting');

    // Step 10: Assert No Force Delete
    const afterDeleteContent = await page.content();
    expect(afterDeleteContent).not.toContain('runtimeRef');
  });
});
