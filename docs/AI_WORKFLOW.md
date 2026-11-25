# AI workflow note

## Tools used

- **Claude Code** (Claude Opus, in VS Code) as a pair programmer for planning, scaffolding, implementation, test writing and browser-driven verification. It used the Claude in Chrome extension to click through the running app.
- Library docs bundled in `node_modules` (Next.js 16 ships its docs there), which Claude read to confirm current APIs (async `cookies()`/`params`, TipTap 3 `useEditorState`, Neon's `sql.query`) instead of relying on memory.

## Where AI materially sped things up

- **Scaffolding and boilerplate:** route handlers, zod schemas, the error-to-JSON wrapper, CSS layout. Roughly an hour of typing collapsed into minutes.
- **Test-first checks on the risky logic.** The sharing/permission test matrix (owner/editor/viewer/stranger × read/write/share/delete) was drafted quickly and passed on the first run against real Postgres (PGlite).
- **Verification.** Claude drove the real UI in Chrome: signed in as each demo user, formatted text, reloaded to confirm persistence, shared as viewer, confirmed the read-only view and the 404 for strangers, and uploaded a real .docx. It also took the screenshots in `docs/screenshots/`.

## What I changed or rejected

- **Stack choice:** the first plan was Express + SQLite on Render with pick-a-user login. I redirected to **Next.js on Vercel + Neon** with **real email/password auth**. That's closer to how a production internal tool would be built, and it gives reviewers a free, reliable URL.
- **Autosave stale closure (caught before running):** the first editor draft called `saveContent` from TipTap's `onUpdate`. That callback is captured on the first render, when `editor` is still `null`, so autosave would have silently done nothing. Fixed by calling through a ref.
- **Lost edits on quick navigation (caught in review):** edits made less than 800 ms before clicking away were dropped. Added a flush on unmount/`pagehide` using `fetch(..., { keepalive })`, limited to bodies under 64 KB, which is the browser cap. Verified by typing and immediately navigating away.
- **.docx underline was silently lost:** a test with a real Word file showed Mammoth drops `<u>` and "List Bullet" styles by default. Added a style map and a regression test.
- **Serverless seed race:** the seed was guarded by "check, then insert", which races when two cold starts run at once. Changed it to an atomic `INSERT … ON CONFLICT DO NOTHING RETURNING` claim.
- **PGlite data dir:** the first local run returned 500s because PGlite doesn't create parent folders. Found by curl smoke tests and fixed.
- **Rejected:** real-time co-editing with Yjs (too much to do well in the timebox, see the architecture note), an ORM (unneeded at four tables), and `window.confirm` for delete (replaced by an inline confirm).

## How I verified correctness, UX and reliability

1. **Automated:** `npm test`, 15 Vitest tests on in-memory Postgres covering permissions (including 404 vs 403 semantics, revocation and role upgrades), sanitization round-trips, auth (duplicates, password rules, forged sessions) and import (.md/.txt/.docx, unsupported/empty/corrupt files).
2. **Static:** `tsc --noEmit` (strict) and `next build` are clean.
3. **API smoke tests with curl:** unauthenticated → 401, wrong password → generic 401, malformed JSON → 400, bogus id → 404, unsupported upload → 415.
4. **Manual end-to-end in a real browser** across three accounts (the flows listed above), plus checking the browser console and server log for errors and hydration warnings (none).
5. **Reading the diff.** I reviewed generated code for permission checks on every route and for SQL parameterization, and checked that no user-supplied HTML reaches the DB without sanitization.
