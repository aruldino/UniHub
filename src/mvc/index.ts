/**
 * MVC-style layering for UniHub (React SPA mapping):
 *
 * 1. models/   — Types & pure logic (no Supabase, no React).
 * 2. services/ — Data access & side effects (Supabase, storage); the “Model” in classic MVC terms.
 * 3. pages & modules/ — Views (JSX). Call services or thin hooks; avoid fat queries in components.
 *
 * Controllers: use React hooks + handlers in views, or extract to `hooks/` when a flow grows.
 */

export * from './models';
export * from './services/authService';
export * from './services/assignmentsService';
export * from './services/socialHubService';
