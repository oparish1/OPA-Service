# Report Templates

## MVP Code Audit Report

```markdown
# MVP Code Audit Report — [project name]

## Summary
- Scope audited (files/paths, and what was excluded)
- Headline risk assessment (1–2 sentences: is this prototype safe to build a harness on top
  of as-is?)
- Counts: N release blockers, N parallel cleanups, N deferrable items

## Structural Weaknesses
[findings from Step 1, grouped by sub-category, each with file:line]

## Context & State Integrity Risks
[findings from Step 2, grouped by sub-category, each with file:line]

## Prioritized Backlog
### Release Blockers
[table: title | file:line | description | suggested fix | effort]
### Parallel Feature Cleanups
[same columns]
### Deferrable Debt
[same columns]

## Recommendation
[go/no-go on proceeding to harness engineering, and what must be true first — present this as
a recommendation grounded in the findings and the risk tolerance established in Step 0, not as
an unchallengeable verdict; the user may have context (deadline pressure, known-acceptable
risk) that changes the call]
```

## Claude Code-Sequenced Remediation Plan

```markdown
# Remediation Plan — Claude Code Sequenced

## Sprint 0 (immediate — before harness work starts)
1. [Release blocker title] — /path/to/file
   - Task for Claude Code: <imperative, self-contained instruction Claude Code can execute
     directly, including acceptance criteria, e.g. "Add a try/except around the LLM call in
     agent.py:42 that catches TimeoutError and APIError, logs the failure, and returns a typed
     Fallback result instead of raising. Add a unit test using a mocked client that asserts
     this behavior.">
   - Depends on: [none | task N]
   - Verification: [what test/check confirms this is fixed]

## Sprint 1 (parallel with feature work)
[same format, Parallel Feature Cleanups items, grouped by which feature area they sit alongside]

## Backlog (deferrable, unscheduled)
[same format, Deferrable Debt items, no sprint assignment — pull into a sprint when convenient]
```
