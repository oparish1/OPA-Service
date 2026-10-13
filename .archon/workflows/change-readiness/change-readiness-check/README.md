# archon-change-readiness-check

Advisory workflow that runs before an AI system or agent is rolled out to a team. It
primes on the real solution, gets the stakeholder's answers, drafts the
decision-authority tiers, auditability standard, training content, accountability map
and adoption telemetry and composes a **Human-AI Collaboration Charter** and a
**User Adoption Enablement Package**. It leaves the checkout unchanged and writes
nothing to a tracker.

## Where it sits

Standalone. It is not part of `archon-ship`'s issue-to-PR path; run it before a
rollout, or after `archon-review` on the change that introduces the system.

```
prime ─► interview ─► answers ─► authority ─┬─► audit ────┐
          (pause if                          ├─► training ─┼─► verdict ─┬─► charter ─┐
           owner/stakes                      └─► telemetry ┘            └─► package ─┴─► outcome
           missing)
```

`audit`, `training` and `telemetry` fan out in parallel with fresh context, the same
shape as `archon-review`'s specialist lenses. `charter` and `package` are skipped by
`scope` for a narrow ask.

## The governing rule, made mechanical

The skill's rule — every number, tier and retention window comes from the stakeholder,
never from what sounds reasonable — is enforced by `scripts/verdict.ts`, not by a
prompt's diligence. The verdict refuses:

| Guard | Fixture (seen red) |
|---|---|
| an "unresolved" commitment that carries a value | `invented-number` |
| a stakeholder-sourced commitment with no value or no cited answer | `no-evidence` |
| an action from the inventory with no tier | `unclassified-action` |
| an Autonomous action whose reversibility is not `yes` | `irreversible-autonomous` |
| a decision with two Accountable roles | `two-accountable` |
| the system named as the Accountable party | `system-accountable` |

`ready: false` is a valid completion (`honest-gaps`): the documents are still written,
with each gap marked `UNRESOLVED — <question>` in place.

## Inputs

| Input | Default | Meaning |
|---|---|---|
| `target` | trigger message | The solution: description, path, Jira keys, Confluence page ids |
| `answers` | `""` | Path to the stakeholder-answers file (below) |
| `scope` | `both` | `both`, `charter` or `package` |
| `format` | `md` | `md`, `docx`, `pptx`, `confluence` |

## The answers file

Markdown, one `## <dimension>` section each: `business_owner`, `end_users`, `stakes`,
`regulatory`, `rollout`, `tooling`. A section that is empty or says `TBD` is
unresolved. Missing `business_owner` or `stakes` suspends the run at `interview-pause`
with `$ARTIFACTS_DIR/questionnaire.md` listing what to answer; fill the file and resume.

## Files

- `archon-change-readiness-check.yaml`: the workflow
- `commands/`: `prime`, `authority`, `audit`, `training`, `telemetry`, `compose-charter`, `compose-package`
- `scripts/`: `intake.ts`, `verdict.ts`, `outcome.ts`; shared parser at `../.shared/answers.ts`
- `references/`, `assets/`: the skill's framework and templates, unchanged
- `fixtures/`: dry-run stubs for the paths above, plus `needs-input` (pause) and `charter-only`
