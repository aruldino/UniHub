import { Page } from '@playwright/test';

export async function loginAsLecturer(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', process.env.LECTURER_EMAIL || 'lecturer@unihub.com');
  await page.fill('input[type="password"]', process.env.LECTURER_PASSWORD || 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}

export async function loginAsStudent(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', process.env.STUDENT_EMAIL || 'student@unihub.com');
  await page.fill('input[type="password"]', process.env.STUDENT_PASSWORD || 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard');
}