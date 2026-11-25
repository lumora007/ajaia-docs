# Submission: Ajaia Docs

## Links

- **Live app:** https://ajaia-docs-hazel-xi.vercel.app
- **Walkthrough video:** in [VIDEO_URL.txt](VIDEO_URL.txt)
- **Demo accounts:** `alice@ajaia.test`, `bob@ajaia.test`, `carol@ajaia.test`, all with password **`demo1234`** (one-click buttons on the login page). You can also sign up with any email.

## What's included

| Item | Location |
| --- | --- |
| Source code | `app/`, `components/`, `lib/`, `tests/` |
| Setup and run instructions | [README.md](README.md) |
| Architecture note | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| AI workflow note | [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md) |
| Automated tests (15, Vitest) | [tests/](tests/), run with `npm test` |
| Walkthrough video URL | [VIDEO_URL.txt](VIDEO_URL.txt) |
| Demo GIF (~3 min, captioned walkthrough) | [docs/demo.gif](docs/demo.gif) |
| Screenshots | [docs/screenshots/](docs/screenshots/) |
| Sample files for import | [samples/](samples/) (.docx, .md, .txt) |
| Config | `package.json`, `next.config.ts`, `tsconfig.json`, `vitest.config.mts`, `.env.example` |

## Status

### Working end to end
- Sign-up, sign-in and sign-out; seeded demo users.
- Create, rename, edit, autosave, reopen and delete documents. Formatting persists after reload.
- Rich text: bold, italic, underline, strikethrough, H1–H3, bulleted and numbered lists, quotes, undo/redo.
- Import .txt / .md / .docx (≤ 2 MB) as a new document. Unsupported types are rejected with a clear message.
- Sharing by email as Editor or Viewer; changing roles; removing access. *My documents* and *Shared with me* sections; read-only mode for viewers; 404 for users without access.
- Validation and error messages throughout (forms, API, uploads, save failures with retry).

### Incomplete / intentionally out of scope
- No real-time co-editing. Concurrent editors are last-write-wins.
- No comments, version history, images/tables, export, share links, password reset or auth rate limiting.
- .docx import keeps structure and basic formatting only (tables, images and styling are dropped).

### Next 2–4 hours
1. Stale-save detection (version check → 409 → "reload" prompt) to stop silent overwrites.
2. Rate limiting on auth endpoints, plus cleanup of expired sessions.
3. Export to .docx/Markdown, and import into an existing document.
4. Playwright end-to-end test of the two-user share flow.
