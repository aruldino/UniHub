# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: assignments.spec.ts >> Assignments >> should display assignments page
- Location: tests\assignments.spec.ts:9:3

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('input[type="email"]')

```

# Test source

```ts
  1  | import { Page } from '@playwright/test';
  2  | 
  3  | export async function loginAsLecturer(page: Page) {
  4  |   await page.goto('/login');
> 5  |   await page.fill('input[type="email"]', process.env.LECTURER_EMAIL || 'lecturer@unihub.com');
     |              ^ Error: page.fill: Test timeout of 30000ms exceeded.
  6  |   await page.fill('input[type="password"]', process.env.LECTURER_PASSWORD || 'password123');
  7  |   await page.click('button[type="submit"]');
  8  |   await page.waitForURL('/dashboard');
  9  | }
  10 | 
  11 | export async function loginAsStudent(page: Page) {
  12 |   await page.goto('/login');
  13 |   await page.fill('input[type="email"]', process.env.STUDENT_EMAIL || 'student@unihub.com');
  14 |   await page.fill('input[type="password"]', process.env.STUDENT_PASSWORD || 'password123');
  15 |   await page.click('button[type="submit"]');
  16 |   await page.waitForURL('/dashboard');
  17 | }
```