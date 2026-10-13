# Synthesize the Backlog and Write the Audit Report

Read `$ARTIFACTS_DIR/scope.md`, `$ARTIFACTS_DIR/structural-findings.md` and `$ARTIFACTS_DIR/context-state-findings.md` in full. Consolidate every finding from both into a single backlog and classify each into exactly one of three categories:

- **`release_blocker`** — would cause data corruption, crashes in common paths, security exposure, or make the harness itself unreliable if left unfixed, given the deployment context and risk tolerance recorded in `scope.md`. Fix before anything else proceeds.
- **`parallel_cleanup`** — real debt, but isolated enough to fix alongside ongoing feature work without blocking it.
- **`deferrable`** — valid but low-risk or low-frequency-path; track it, don't let it block velocity.

Order items within each category by risk × blast radius, highest first.

**Where a finding could reasonably sit in either of two categories, do not silently pick one.** Classify it into whichever fits better, but set `ambiguous_note` to a specific sentence naming the alternative and what would tip it, for example: "classified as parallel_cleanup, but would be a release_blocker if this prototype starts handling real payment data before that's rearchitected." Leave `ambiguous_note` null only when the classification is genuinely unambiguous.

Give each item a stable `id` (e.g. `RB-1`, `PC-1`, `DD-1`) — `plan-remediation` and, if issues are filed later, `file-issues` both reference these ids, so keep them stable and don't reuse an id across items.

## Write the audit report

Write `$ARTIFACTS_DIR/audit-report.md`:

```markdown
# MVP Code Audit Report — [project name]

## Summary
- Scope audited: [core_paths from scope.md], excluding [excluded]
- Headline risk assessment: [1–2 sentences — is this prototype safe to build a harness on as-is?]
- Counts: [release_blocker_count] release blockers, [parallel_cleanup_count] parallel cleanups, [deferrable_count] deferrable items

## Structural Weaknesses
[findings from structural-findings.md, grouped by sub-category, each with file:line]

## Context & State Integrity Risks
[findings from context-state-findings.md, grouped by sub-category, each with file:line]

## Prioritized Backlog
### Release Blockers
[table: id | title | file(s) | description | suggested fix | effort — include ambiguous_note as a row note where set]
### Parallel Feature Cleanups
[same columns]
### Deferrable Debt
[same columns]

## Recommendation
[go/no-go on proceeding to harness engineering and what must be true first — present this as a recommendation grounded in the findings and scope.md's risk tolerance, not as an unchallengeable verdict; the reader may have context — deadline pressure, known-acceptable risk — that changes the call]
```

## Declare

- `release_blocker_count`, `parallel_cleanup_count`, `deferrable_count` — the three counts.
- `backlog` — every item, with its `id`, `title`, `category`, `files`, `description`, `suggested_fix`, `effort` and `ambiguous_note` (or null).
- `recommendation` — the Recommendation section's text.
- `go_no_go` — `go`, `no_go`, or `conditional`.
- `summary` — a few sentences: the counts and the headline call.
- `report` — the pointer to `audit-report.md`.
