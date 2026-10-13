# File the Remaining Backlog as Issues

Read `$ARTIFACTS_DIR/audit-report.md` and `$ARTIFACTS_DIR/remediation-plan.md`. File one GitHub issue per item that this run is not fixing itself, so each can flow directly into `archon-ship` or `archon-ship-figma` later with no re-derivation:

- Every item in **Parallel Feature Cleanups** and **Deferrable Debt** — always.
- Every item in **Release Blockers** too, but only when `$INPUTS.fix_blockers` is `"false"` — if this run fixed them itself, they don't need an issue.

## Shape every issue as a triage-ready contract

Use the same six-part shape `archon-triage` looks for, so a subsequent triage run finds it already `READY` rather than `NEEDS_CONTRACT_WORK`:

- **Title**: the backlog item's title.
- **Problem**: the item's `description`, in issue form.
- **Why**: why this matters, drawn from its `subcategory` and, when set, its `ambiguous_note`.
- **Why now**: for a release blocker filed here, that it was assessed as release-blocking; for a parallel cleanup or deferrable item, that it surfaced in this prototype audit.
- **Outcome**: the item's `suggested_fix`, restated as a concrete outcome.
- **Invariants**: anything from `scope.md`'s deployment context or risk tolerance that bears on this specific item.
- **Acceptance**: the corresponding remediation-plan.md task's verification criteria, when one exists for this item; otherwise a concrete check derived from the finding itself.

Append a line to every issue body: "From the prototype audit — see `$ARTIFACTS_DIR/audit-report.md` (item `[id]`) and `$ARTIFACTS_DIR/remediation-plan.md` for full detail." Label each issue with its category (`release-blocker`, `parallel-cleanup`, or `deferrable-debt`) if the repository's label set allows creating labels and skip labeling rather than fail the issue if it doesn't.

If you do not have a working GitHub connection, do not guess at issue numbers or fabricate URLs — declare `issues_filed` as an empty array and say so plainly in `summary`.

## Declare

- `issues_filed` — one entry per issue actually created: the backlog `id` it came from, its `title` and the real `url` GitHub returned.
- `summary` — how many issues were filed, in which categories and any item that could not be filed and why.
