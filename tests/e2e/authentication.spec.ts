import { test, expect } from '@playwright/test';

test.describe('Authentication E2E', () => {
  test('TC-AUTH-01: happy path (khép kín register → login → logout)', async ({ page }) => {
    const randomStr = Math.random().toString(36).substring(7);
    const email = `e2e-${Date.now()}-${randomStr}@test.local`;
    const password = 'ValidPass123!';

    // 1. Navigate to authentication
    await page.goto('/authentication');
    
    // 2. Switch to Register form
    await page.getByText('Register', { exact: true }).click();
    
    // 3. Fill registration form
    await page.locator('#auth-register-email').fill(email);
    await page.locator('#auth-register-password').fill(password);
    await page.locator('#auth-register-password-confirmation').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();

    // 4. Wait for success banner and ensure we are back on login form
    await expect(page.getByRole('status')).toContainText('Account created');
    
    // 5. Fill login form
    await page.locator('#auth-login-email').fill(email);
    await page.locator('#auth-login-password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();

    // 6. Assert successful redirect to dashboard
    await expect(page.getByRole('heading', { name: 'System Dashboard' })).toBeVisible();

    // 7. Click sidebar link to Account
    await page.getByRole('link', { name: 'Account' }).click();
    
    // 8. Assert Account page is visible, then log out
    await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();

    // 9. Assert redirect back to login
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'System Dashboard' })).not.toBeVisible();
  });

  test('TC-AUTH-02: error (sai mật khẩu, không enumeration)', async ({ page }) => {
    const randomStr = Math.random().toString(36).substring(7);
    const email = `error-${Date.now()}-${randomStr}@test.local`;
    const password = 'WrongPass123!';

    // 1. Navigate to authentication
    await page.goto('/authentication');
    
    // 2. Fill login form with invalid credentials
    await page.locator('#auth-login-email').fill(email);
    await page.locator('#auth-login-password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();

    // 3. Assert alert is visible and we did not redirect
    // Note: Backend returns the same message for wrong email/password to prevent enumeration
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'System Dashboard' })).not.toBeVisible();
  });
});
