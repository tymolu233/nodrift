# The semantic self-check after writing a decision note

Scripts police structure; this checklist polices **meaning**. Walk it after writing a note. Every item is a judgment call and never goes into a verify script — that is deliberate: a script can reject bad format; it cannot reject empty content.

## Before writing

- [ ] Is this really a decision? Facts obtainable alone (entry-point comments, search, module docs) do not earn a note.
- [ ] Ownership: an existing note covering the same decision is updated in place; only a reversed verdict opens a new note, cross-linked both ways.

## Problem

- [ ] The motivation stands without the solution — cover the Decision/Proposal section and re-read: is it still the same problem?
- [ ] The trigger is concrete: what broke, what must change, what doing nothing costs.

## Decision / Proposal

- [ ] Specific enough to act on — no "try to", "appropriately", "consider".
- [ ] An implemented note reads entirely in present tense: no "will", "plan to", "to be done".

## Alternatives considered

- [ ] At least one genuine opponent, with the reason it lost — no alternatives means the decision was not thought through.
- [ ] Only alternatives actually weighed at the time; "do nothing" does not count.

## Consequences / Risks / Rejection rationale

- [ ] Costs and imposed obligations are written, not only benefits.
- [ ] proposed: Acceptance criteria name the observable done state (gate or test names). implemented: Consequences name the gates or tests that pin the decision. rejected: Rejection rationale states the conditions under which re-proposing would make sense.

## Throughout

- [ ] No reasoning transcript: conclusions and durable reasons stay; derivation paths go.
- [ ] No status-rot words ("implemented!", "future:") — status lives in the folder and the `Status:` line.
