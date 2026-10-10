# Write the Claude Code-Sequenced Remediation Plan

Read `$ARTIFACTS_DIR/audit-report.md` for context, but drive this from the structured backlog the synthesis step produced. This is a companion deliverable to the audit report, not a restatement of it: the audit is the diagnosis, this is the treatment plan a future Claude Code session — or `fix-blockers` immediately after this node, in this same run — actually executes from.

Convert every backlog item into a numbered Claude Code task, sprint by sprint. Phrase each task so Claude Code can pick it up directly with minimal re-interpretation: a concrete file path, a clear definition of done, and explicit test or verification criteria. Never write something as vague as "improve error handling" — say exactly what to catch, where, and what the resulting behavior should be.

## Write the remediation plan

Write `$ARTIFACTS_DIR/remediation-plan.md`:

```markdown
# Remediation Plan — Claude Code Sequenced

## Sprint 0 (immediate — before harness work starts)
1. [release_blocker item title] — /path/to/file
   - Task for Claude Code: [imperative, self-contained instruction, e.g. "Add a
     try/except around the LLM call in agent.py:42 that catches TimeoutError
     and APIError, logs the failure, and returns a typed Fallback result
     instead of raising. Add a unit test using a mocked client that asserts
     this behavior."]
   - Depends on: [none | task N]
   - Verification: [what test or check confirms this is fixed]
[one entry per release_blocker item, in dependency order]

## Sprint 1 (parallel with feature work)
[same format, parallel_cleanup items, grouped by which feature area they sit alongside]

## Backlog (deferrable, unscheduled)
[same format, deferrable items, no sprint assignment — pull into a sprint when convenient]
```

Order Sprint 0 by actual dependency, not just by the backlog's risk order — a task that another task's fix depends on comes first regardless of which is individually higher-risk, and each entry's `Depends on:` must name a real prior task number, never "none" when one exists.

## Declare

- `sprint0_item_ids` — the backlog ids that ended up in Sprint 0, in the exact order they appear there. `fix-blockers`, immediately after this node, reads this section directly.
- `summary` — a few sentences: how many tasks per sprint, and whether Sprint 0 has any task this run's `fix-blockers` step (if it runs) should expect to be genuinely hard.
- `report` — the pointer to `remediation-plan.md`.
