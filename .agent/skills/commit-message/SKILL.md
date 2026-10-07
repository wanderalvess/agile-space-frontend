---
name: commit-message
description: >
  This repo's actual commit message convention (derived from git log, not generic Conventional
  Commits). Use when writing a commit message for agile-space-frontend.
---

Format: `type(scope[,scope2,...]): summary`

- **type**: `feat`, `fix`, or `refactor` (observed in this repo's history). No `chore`/`docs`/`test`
  types in use — don't introduce them without asking.
- **scope**: lowercase feature/domain name(s), comma-separated **with no space** after the comma
  (`fix(design-system,poker): ...`, `fix(brainstorming,room,showcase): ...`). Match the actual
  area(s) touched, not the file path. Common scopes already in use: `squad`, `onboarding`, `login`,
  `admin`, `qa`, `poker`, `room`, `docker`, `design-system`, `types`, `security`, `auth`, `ui`,
  `brainstorming`, `showcase`, `merge`, `changelog`, `release`. Reuse one of these when it fits
  instead of inventing a near-duplicate.
- **scope is optional** for a repo-wide change that doesn't belong to one feature (e.g.
  `refactor: remove Firebase, migrate all data access to Postgres REST API`).
- **summary**: free text, one line, no trailing period. This project's history mixes Portuguese
  and English naturally (e.g. `feat(login): glassmorphism no card, ajusta contraste claro/escuro e
  fix mobile`) — match whatever language the user is writing in for that commit, keep English
  technical terms as-is (component/API/CSS names, "fix", "mobile", etc.) rather than forcing a
  translation either way.
- No footers/body convention in use (no `BREAKING CHANGE:`, no issue refs, no trailers) — keep it
  to the one-line summary unless the user asks for more detail.

Examples straight from this repo's log:
```
fix(design-system,poker): dedupe widget components, unify toast, fix 415 on room create
feat(docker): add standalone build support and Dockerfile, fix worklogs/weekly 415
fix(onboarding,admin): stop offering leadership roles in self-service join, split cargo from access level
```
