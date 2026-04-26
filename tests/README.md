# Playwright E2E Tests

This directory contains end-to-end tests for the UniHub application using Playwright.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

## Running Tests

- Run all tests: `npm run test:e2e`
- Run tests with UI: `npm run test:e2e:ui`
- Run specific test file: `npx playwright test assignments.spec.ts`

## Test Files

- `assignments.spec.ts`: Tests for assignment creation, viewing, and submissions (lecturer role)
- `lecturer.spec.ts`: Tests for lecturer dashboard and role-specific functionality

## Authentication

Tests use helper functions in `auth-helpers.ts` for login. Set environment variables for test credentials:

- `LECTURER_EMAIL`
- `LECTURER_PASSWORD`
- `STUDENT_EMAIL`
- `STUDENT_PASSWORD`

If not set, default test credentials are used.

## Notes

- Tests assume a running development server on `http://localhost:5173`
- Supabase backend must be available with test users
- Some tests may need adjustment based on actual UI selectors and data