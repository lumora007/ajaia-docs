# Architecture note

## What I prioritized

I put the time into making the **core loop solid**: write → autosave → share → the other person opens it with the right permissions. I left out features that look good in a demo but are shallow when rushed (real-time cursors, comments, version history).

1. **Correct, central access control.** Every permission decision goes through one function, `getAccess()` in [lib/documents.ts](../lib/documents.ts), which returns `owner | editor | viewer | null`. Route handlers stay thin, so no endpoint can skip the check. Users without access get **404, not 403**, so a document's existence isn't revealed. Users with too little access (viewer saving, editor sharing) get 403.
2. **Reliable saving.** Debounced autosave (800 ms), with saves run one at a time. If you type during a save, exactly one more save follows with the latest content, so responses arriving out of order can't overwrite newer text. Edits made in the last 800 ms before leaving the page are sent with `fetch(…, { keepalive })`, and the browser warns before closing with unsaved changes. Failed saves show "Not saved · Retry".
3. **Safe content.** Documents are stored as HTML and **sanitized on the server for every write and every import** ([lib/sanitize.ts](../lib/sanitize.ts)). The allowlist matches what the editor can produce, so scripts, event handlers and images from pasted or imported content are removed.
4. **Tests on the risky parts:** permissions, sanitization, auth and import.

## Stack and why

| Choice | Why |
| --- | --- |
| **Next.js 16 (App Router)** on **Vercel** | One codebase for UI and API, and a deployment reviewers can open. Pages are server-rendered with data loaded directly (no loading flash); changes go through JSON route handlers. |
| **Postgres: Neon (prod) / PGlite (local, tests)** | Real relational integrity (FKs, `ON DELETE CASCADE`, `CHECK` on roles, composite PK on shares). PGlite runs real Postgres in-process, so `npm install && npm run dev` needs no setup and tests use the same SQL dialect as production. A small `query(sql, params)` interface ([lib/db.ts](../lib/db.ts)) is the only seam. |
| **Neon HTTP driver** | Stateless, one round trip per query. No connection-pool exhaustion on serverless. |
| **TipTap 3** | ProseMirror-based, headless, solid schema. StarterKit covers every required format. |
| **Plain SQL, no ORM** | Four tables. Parameterized SQL is easy to read and review at this size. |
| **bcrypt + DB sessions** | Opaque random token in an httpOnly, SameSite=Lax cookie. Only its SHA-256 hash is stored, so a leaked DB can't be replayed. Sessions can be revoked (logout deletes the row). |

## Data model

```
users(id, email UNIQUE, name, password_hash)
sessions(token_hash PK, user_id → users, expires_at)
documents(id, owner_id → users, title, content_html, created_at, updated_at)
document_shares(document_id → documents, user_id → users, role ∈ {viewer, editor}, PK(document_id, user_id))
```

Ownership is a column, not a share row, so a document always has exactly one owner and the owner can't be "unshared". Re-sharing with the same person updates their role (upsert).

The schema is created with `CREATE TABLE IF NOT EXISTS` on each instance's first request. A `schema_version` row makes later cold starts cost a single query. The demo seed claims an `app_meta` row atomically first, so concurrent serverless cold starts can't seed twice.

## Key tradeoffs

- **HTML instead of ProseMirror JSON for storage.** HTML is portable: imports convert straight to it, it's readable in the DB, and it renders anywhere. The cost is that the server can't do structural edits without parsing. Acceptable here, and sanitization makes it safe.
- **Last write wins, no real-time co-editing.** Two editors typing at the same moment will overwrite each other's most recent save. Doing this properly means CRDTs (Yjs + a WebSocket/hosted provider), which wasn't possible to do well in the timebox. The next step would be an `updated_at` version check returning 409 on stale saves ("This document changed, reload"), then Yjs.
- **Share by email, only to existing accounts.** No invite emails or share links. The error message tells the owner the person needs to sign up first.
- **Import creates a new document** rather than merging into an existing one. It's the clearest flow, and it avoids "where does the inserted content go?" questions.
- **.docx fidelity is partial.** Mammoth maps semantic structure (headings, lists, bold/italic/underline). Tables, images, colors and fonts are dropped by design, and the sanitizer would strip them anyway.

## Deliberately not built

Real-time collaboration and presence, comments and suggestions, version history, images/tables, export (PDF/.docx), share links and public access, password reset and email verification, rate limiting on auth endpoints, search.

## Next 2–4 hours

1. Optimistic concurrency on save (`If-Match: updatedAt` → 409 + reload prompt). This closes the silent-overwrite gap.
2. Rate limiting on login/sign-up, plus deleting expired sessions.
3. Export to .docx/Markdown, and "import into this document".
4. Playwright end-to-end test of the share flow across two browser contexts.
