<!-- One PR carries one intent; split independent changes. -->

## What changed

<!-- One or two sentences stating what the behavior BECAME — not a diff restatement. -->

## Test evidence (pick the right tier; more is not better)

- [ ] The behavior change has a test at the tier that proves it (unit / snapshot / e2e)
- [ ] User-visible output (CLI, API responses, generated config) has updated snapshots
- [ ] Replayable verification without credentials or network still passes

## Sync obligations

- [ ] README / API docs updated with the behavior
- [ ] Lasting architecture decisions written or updated in `.agents/notes/` (use the lifecycle template; `nodrift check --only note-format` passes)
- [ ] Model- or user-visible output changes are recorded

## Self-check

- [ ] Narrowest local checks covering this diff have run (`nodrift check`, targeted tests per `.agents/skills/pre-push-checks/SKILL.md`)
- [ ] No unrelated files or refactors mixed in
- [ ] No new type escapes (`as unknown` / unexplained `ignore`)
- [ ] Breaking or migration changes are additive-only and rollback-safe

## Labels

kind: `feature` | `fix` | `refactor` | `docs` | `chore` (pick exactly one)

area: as many as apply

