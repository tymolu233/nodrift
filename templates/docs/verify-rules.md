# From spoken rules to verify scripts: the starter list

Method: a rule the team keeps repeating aloud is a gate candidate. Script the five most-violated first, give each script its own unit test, and put them in CI. govkit already ships gates for the generic half of this list (`govkit check --list` shows them with what each proves and does not prove); this document is for repository-specific rules — and for the shape any new gate should take.

## Starter top 5 (language-agnostic)

| # | Rule | Implementation sketch |
|---|---|---|
| 1 | No new type escapes | grep `as unknown` / `type:\s*ignore` / `nosec` against a baseline: existing allowed, new forbidden. The govkit `ratchet` gate implements exactly this — prefer it over a hand-rolled script. |
| 2 | No empty catch | AST scan (not regex): an empty or comment-only catch block fails; require a named error and a reason. |
| 3 | Exports must have docs | Parse exported symbols; require an adjacent doc comment covering parameters and returns. |
| 4 | Files end with one newline | Pure byte check; `git diff --cached --check` in a hook covers most of it natively. |
| 5 | No status words in docs | `implemented!` / `future:` / "used to" appearing in `*.md` fails. |

## Advanced candidates

- No bare-string IDs across module boundaries (needs type/symbol information).
- No scattered defaults: `?? default` allowed only in the one resolver file.
- No hardcoded user-visible copy; route through i18n dictionaries or localized primitives.
- One fact, one home: grep a signature phrase; more than one occurrence fails — the rest must be links.
- Generated catalogs and manifests must be generator output (regenerate, then `git diff --exit-code`).
- Word budgets for high-traffic documents (the govkit `doc-budgets` gate).

## The baseline pattern (the iron rule for existing trees)

```
baseline.json   # exact snapshot of current violations
check           # green only when actual ⊆ baseline; new violations are red; baseline only shrinks
```

Rules take effect on day one without a cleanup campaign. This is the govkit `ratchet` gate's model: `govkit ratchet update <id>` snapshots every current offender once; after that, `govkit check` rejects additions while a smaller baseline is always welcome.

## Language implementation slots

| Language | AST / check tooling |
|---|---|
| TypeScript | ts-morph / oxlint custom rule / typed eslint rule |
| Python | ruff custom rule / libcst / the `ast` module |
| Go | golangci-lint custom linter / `go/ast` |
| Rust | clippy lint (cargo subcommand) |
| Any | pre-commit hooks + grep/rg to start; upgrade to AST once running |

## Anti-rot for the gates themselves

- Every verify script carries its own unit test proving it goes red on an invalid case.
- Handling a gate failure follows a fixed order — **relocate → compress → argue the relaxation in the PR**. Habitual waivers are forbidden.
