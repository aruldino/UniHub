import { test, expect } from '@playwright/test';
import { loginAsLecturer } from './auth-helpers';

test.describe('Assignments', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsLecturer(page);
  });

  test('should display assignments page', async ({ page }) => {
    await page.goto('/assignments');
    await expect(page).toHaveTitle(/Assignments/);
    await expect(page.locator('text=Assignments')).toBeVisible();
  });

  test('should create a new assignment', async ({ page }) => {
    await page.goto('/assignments');

    // Click create assignment button
    await page.click('button:has-text("Create Assignment")');

    // Fill the form
    await page.fill('input[placeholder="Assignment Title"]', 'Test Assignment');
    await page.fill('textarea[placeholder="Assignment Description"]', 'This is a test assignment');
    await page.fill('input[type="date"]', '2024-12-31');
    await page.fill('input[placeholder="100"]', '50');

    // Select department and subject (assuming dropdowns exist)
    await page.click('button:has-text("Select Department")');
    await page.click('text=Computer Science');

    await page.click('button:has-text("Select Subject")');
    await page.click('text=Software Engineering');

    // Submit
    await page.click('button[type="submit"]');

    // Verify assignment is created
    await expect(page.locator('text=Test Assignment')).toBeVisible();
  });

  test('should view assignment submissions', async ({ page }) => {
    await page.goto('/assignments');

    // Click on an assignment
    await page.click('text=Test Assignment');

    // Switch to submissions view
    await page.click('button:has-text("Submissions")');

    // Verify submissions are displayed
    await expect(page.locator('text=Submissions')).toBeVisible();
  });
});