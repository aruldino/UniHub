# Assessment Evidence Checklist

This document helps each student provide evidence for the required tooling in the final submission.

## 1. Version Control (Git)

Show meaningful commits linked to your own component work.

### Minimum evidence to include

- 3 to 6 focused commits from your branch, each with clear commit messages.
- Commit scope tied to your assigned component(s), not generic formatting-only changes.
- At least one commit that introduces a feature, one that fixes a bug, and one that adds/improves tests.

### Suggested commit message pattern

- `feat(contact-modal): add inquiry validation and Supabase insert flow`
- `fix(contact-modal): sanitize phone input to 10 numeric digits`
- `test(contact-modal): cover validation and submit journeys`

### Commands to collect evidence

```bash
git log --oneline -- src/components/ContactModal.tsx src/components/ContactModal.test.tsx
git show <commit-hash>
```

Take screenshots or export output that clearly shows commit IDs, messages, and changed files.

## 2. Project Management Tool (Planning + Ownership)

Use a board tool such as GitHub Projects, Trello, Jira, or Azure Boards.

### Minimum evidence to include

- Board with tasks mapped to your assigned component(s).
- Tasks with status progression (To Do -> In Progress -> Done).
- Clear ownership (assignee = your account).
- At least one task showing acceptance criteria and completion notes.

### Example task set for Contact Modal

- `CONTACT-01`: Build contact modal UI and input controls
- `CONTACT-02`: Add client-side validation rules
- `CONTACT-03`: Persist inquiry to Supabase activity logs
- `CONTACT-04`: Add automated tests for key user journeys

Capture screenshots of board view and one opened task showing assignee and completion.

## 3. Automated Testing Tool (Key Features + User Journeys)

Use Vitest + Testing Library to prove behavior for your component.

### Tests added in this repo

- `src/components/ContactModal.test.tsx`

### Covered journeys

- Validation failure path (message shorter than 10 characters blocks submit + error toast).
- Phone normalization logic (non-numeric characters removed, max 10 digits).
- Successful submission path (Supabase insert + success toast + modal close).
- Failure submission path (error toast when insert fails).

### Commands to run and capture evidence

```bash
npm run test
```

Include test run output screenshot that shows passing test names and file path.

## Suggested submission bundle

- Git evidence screenshots + short explanation of contribution flow.
- Project board screenshots (task ownership and progression).
- Test output screenshot + brief mapping of tests to user journeys.
