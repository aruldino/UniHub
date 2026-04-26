import { test, expect } from '@playwright/test';

const publicPages = [
  { path: '/', title: 'UniHub — Academic Portal' },
  { path: '/login', title: 'UniHub — Academic Portal' },
];

const protectedRoutes = [
  '/dashboard',
  '/profile',
  '/subjects',
  '/timetable',
  '/attendance',
  '/assignments',
  '/groups',
  '/events',
  '/admin/users',
  '/admin/batches',
  '/admin/departments',
  '/grading',
  '/results',
  '/exams',
  '/communication',
  '/admin/security',
  '/admin/enrollments',
];

test.describe('Public pages', () => {
  for (const pageInfo of publicPages) {
    test(`loads ${pageInfo.path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });

      await page.goto(pageInfo.path, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(pageInfo.path);
      await expect(page).toHaveTitle(pageInfo.title);

      // Check for JavaScript errors
      expect(errors).toHaveLength(0);
    });
  }
});

test.describe('Protected module routes', () => {
  for (const route of protectedRoutes) {
    test(`loads ${route} in test mode`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });

      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(route);
      await expect(page).toHaveTitle('UniHub — Academic Portal');

      // Check for JavaScript errors
      expect(errors).toHaveLength(0);
    });
  }
});
