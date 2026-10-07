---
name: design-audit
description: >
  Design-system consistency audit for agile-space-frontend — finds and fixes dark-mode gaps,
  hardcoded hex colors, emoji-as-icon, hand-rolled elements duplicating shadcn primitives
  (Button/Dialog/Tabs/Toast), and untokenized radius/font-size/font-family scales. Encodes how
  this project wants that work paced (one fix at a time) and verified (live, not just typecheck).
  Use when asked to audit, sweep, or standardize UI/design consistency, fix dark-mode bugs,
  or clean up duplicate/hand-rolled components in this repo.
---

Standardizes recurring design-system cleanup work on this codebase. Read this before starting
any "audit/sweep/padronizar UI" task here.

## Checklist — what to scan for

1. **Dark-mode gaps**: hardcoded hex (`bg-[#fdfdfd]`, `text-[#0B0E14]`, etc.) or `text-white` /
   light-only classes (`bg-slate-50`, `text-slate-700`) with no `dark:` variant. Test in both
   themes, not just light.
2. **Raw hex outside intentional chart segment colors**: grid lines, axis, tooltip, borders should
   use tokens (`hsl(var(--border))`, `text-muted-foreground`, etc.), not literal hex. Chart *data
   series* colors are the one legitimate exception — don't tokenize those.
3. **Emoji-as-icon**: emoji used as a status/UI icon (⚠️, 🟢/🔴, 👁️, ⚙️) where a real Lucide icon
   (`AlertTriangle`, `Eye`, etc.) belongs.
4. **Hand-rolled elements duplicating a real primitive**: raw `<button>` next to `Button`, custom
   pill-tabs next to `Tabs`, a hand-rolled modal next to `Dialog`. Check whether a real primitive
   is already used the same way elsewhere in the same file/feature before proposing a swap.
5. **Untokenized scales**: arbitrary values (`rounded-[2.5rem]`, `text-[10px]`) bypassing
   `tailwind.config.ts`'s declared scale; `font-sans`/`font-mono` bypassing the app's real tokens
   (`font-body`/`font-headline`/`font-code`).
6. **Duplicate/dead components**: near-identical component clones across folders (e.g. leftover
   from a migration script) — check every candidate has zero live route imports before deleting;
   promote the live one to `components/ui/` rather than keeping both.

## Pacing — how the user wants this driven

- **One fix per turn** (occasionally two clearly-related ones). Report a prioritized list of
  findings, then stop and let the user pick the next item — don't auto-continue down the list.
- **When a fix reveals an adjacent same-shaped problem** (e.g. dead duplicate code sitting next to
  what you're fixing), name it and ask before touching it. Don't silently fold it into the current
  diff.
- After each fix: verify, report what changed, wait.

## Verification — live over typecheck

- Typecheck/lint passing is not enough for a user-facing/behavioral fix — reproduce it running.
- Frontend dev server: `npm run dev`, port **9002** (Turbopack). Backend
  (`agile-space-backend`, separate repo, Spring Boot, Maven) runs on port **8002**
  (`http://localhost:8002/api`) — user runs it separately, don't start it; check reachability
  first.
- Dev/local test login: `teste@teste.com` / `testeteste` (Agile Master on squad "TESTE", not
  site admin — `/admin` will redirect away). Token lives in `localStorage['agileSpace_auth_token']`;
  a forced full reload can lose in-memory session state even though the token persists.
- **Opaque frontend errors** ("Falha ao salvar..."): the frontend's catch-block strings are
  deliberately vague. Use `read_network_requests` to get the real status + response body instead
  of guessing — that's how a real 415 (missing `Content-Type` in `authFetch`) was found behind a
  generic "Falha ao salvar a sala" toast.
- If something genuinely can't be visually verified (e.g. a screen that redirects too fast to
  screenshot), say so plainly rather than claiming success anyway.
