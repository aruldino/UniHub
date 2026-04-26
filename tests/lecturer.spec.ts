import { test, expect } from '@playwright/test';
import { loginAsLecturer } from './auth-helpers';

test.describe('Lecturer Role', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsLecturer(page);
  });

  test('should display lecturer dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Check if dashboard elements are visible
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Subjects')).toBeVisible();
    await expect(page.locator('text=Pending Grading')).toBeVisible();
    await expect(page.locator('text=Total Students')).toBeVisible();
  });

  test('should navigate to assignments from dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Click assignments link/button
    await page.click('a[href="/assignments"]');

    // Verify navigation
    await page.waitForURL('/assignments');
    await expect(page.locator('text=Assignments')).toBeVisible();
  });

  test('should display lecturer stats correctly', async ({ page }) => {
    await page.goto('/dashboard');

    // Verify stats cards are present
    const statsCards = page.locator('[data-testid="stat-card"]');
    await expect(statsCards).toHaveCount(3); // subjects, pending grading, total students

    // Check specific stats (assuming they load)
    await expect(page.locator('text=Subjects')).toBeVisible();
    await expect(page.locator('text=Pending Grading')).toBeVisible();
    await expect(page.locator('text=Total Students')).toBeVisible();
  });

  test('should display today\'s schedule', async ({ page }) => {
    await page.goto('/dashboard');

    // Check if schedule section exists
    await expect(page.locator('text=Today\'s Schedule')).toBeVisible();
  });
});