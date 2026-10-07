---
name: backend-integration
description: >
  How agile-space-frontend talks to its Spring Boot backend (agile-space-backend) — the authFetch
  wrapper, base-URL convention, auth/token handling, and how to actually debug a failed API call
  instead of trusting the frontend's generic error toast. Use when writing/fixing a service call,
  debugging a "Falha ao..." error, or touching anything under src/services or src/lib/auth-client.ts.
---

## The two repos

- Frontend (this repo): Next.js + Turbopack, `npm run dev` → **port 9002**.
- Backend: `agile-space-backend`, separate git repo (sibling directory), Spring Boot / Maven,
  `src/main/java/com/agilespace/backend/` (`controller/` per domain, `service/`, JPA entities in
  `domain/` using `@JdbcTypeCode(SqlTypes.JSON)` for JSONB columns). Runs on **port 8002**
  (`http://localhost:8002/api`). The user runs it separately — never start it yourself, just check
  reachability first.

## Making a call

Every service file declares its own base URL at the top, matching this exact pattern (no shared
config module — duplication is the current convention, don't "fix" it into a shared constant
unless asked):
```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002/api';
```
Then call through **`authFetch`** (`src/lib/auth-client.ts`), never raw `fetch`, for anything
needing the session:
```ts
await authFetch(`${API_BASE_URL}/poker/rooms`, { method: 'POST', body: JSON.stringify(payload) });
```
`authFetch` already handles, so don't re-implement:
- Attaching `Authorization: Bearer <token>` from `localStorage['agileSpace_auth_token']`.
- Defaulting `Content-Type: application/json` on any non-FormData body (a real bug once: `fetch`
  only auto-sets `Content-Type` for Blob/FormData/URLSearchParams bodies, so a plain
  `JSON.stringify` body fell back to `text/plain` and Spring rejected it with a bare 415).
  FormData is deliberately left alone — setting the header manually breaks the multipart boundary.
- Firing `UNAUTHORIZED_EVENT` on a 401 so `AuthProvider` clears the session and redirects to
  `/login`.

## Debugging a failed call

The frontend's catch-block error strings ("Falha ao salvar...") are deliberately generic and
don't carry the server's real error. Don't guess from the toast text — pull the actual response:
1. `read_network_requests` to find the failed request and its status + `requestId`.
2. Re-call with that `requestId` to get the raw response body (the real Spring error detail).

## Local dev auth

Test login: `teste@teste.com` / `testeteste` — comes back as Agile Master on squad "TESTE", not a
site admin, so `/admin` redirects away instantly (that's expected, not a bug). Session token lives
in `localStorage`, not a cookie — a forced full page reload (`navigate({force:true})` or a hard
refresh) can drop the in-memory auth state and bounce to `/login` even though the token itself is
still in storage; re-login rather than treating that as a regression.
