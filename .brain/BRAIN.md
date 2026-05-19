# `.brain/` — agent workflow rules

This repo has a per-project second brain at `.brain/`. Hooks in
`.claude/settings.json` drive it automatically.

## At session start (already automatic)

The `SessionStart` hook runs `.brain/scripts/assemble-context.sh`, which
generates `.brain/_CONTEXT.md`. It contains:
- Pointers to CKIS (`_MEMORY.md`, `_overview.md`)
- Last 3 session summaries
- Open decisions and bugs

## During the session — what's auto-captured

- `npm run build` / `npm test` / `npm run lint` → success or failure
- `git commit` → SHA + message + diffstat
- `/compact` → compact routed to Dev Brain eagerly

## Write to brain when warranted

- **`.brain/decisions/YYYY-MM-DD-<slug>.md`** — architecture, dependency, or scope decisions.
- **`.brain/bugs/YYYY-MM-DD-<slug>.md`** — root cause + prevention for bugs worth remembering.

## CKIS bridge

| Situation | Goes to |
| --- | --- |
| Code change, refactor | Just commit |
| Decision about recmp3-cli | `.brain/decisions/` |
| Bug postmortem | `.brain/bugs/` |
| Strategic / cross-project | CKIS `_MEMORY.md` + `02-projects/recmp3-cli/_overview.md` |

## Hard rules

- Never modify `.brain/_CONTEXT.md` by hand — regenerated each session.
- Never delete files in `decisions/` or `bugs/` — supersede instead.
- `.brain/sessions/` is gitignored; `decisions/` and `bugs/` are committed.
