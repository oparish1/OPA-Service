# File Critical/High Findings as Issues

Read `$ARTIFACTS_DIR/security-assessment-signoff.md`. File one GitHub issue per Critical or High finding listed in Conditions for Approval or Blocking Issues — Medium and Low findings stay in the report's Residual Risk Accepted section for a human approver to decide, and are not filed here.

## Shape every issue as a triage-ready contract

Use the same six-part shape `archon-triage` looks for, so a subsequent triage run finds it already `READY`:

- **Title**: the finding's title/description in a few words.
- **Problem**: the finding's `description` and exploit scenario (or, for an agentic threat scenario, its actor → vector → target → impact).
- **Why**: the severity and, for a FAIL-driving finding, that it is a release blocker.
- **Why now**: that it was raised in this security gate review and is a condition of approval or a blocking issue.
- **Outcome**: the finding's `recommended_fix`, restated as a concrete outcome.
- **Invariants**: anything from `scope.md` (multi-tenancy, agentic scope) that bears on this specific finding.
- **Acceptance**: a concrete, verifiable check that the finding is resolved — reference the same tool/scanner that found it where applicable, so re-review can confirm with the same method.

Append a line to every issue body: "From the security gate review — see `$ARTIFACTS_DIR/security-assessment-signoff.md` (item `[id]`) for full detail." Label each issue by severity (`security-critical` or `security-high`) if the repository's label set allows creating labels; skip labeling rather than fail the issue if it doesn't.

If you do not have a working GitHub connection, do not guess at issue numbers or fabricate URLs — declare `issues_filed` as an empty array and say so plainly in `summary`.

## Declare

- `issues_filed` — one entry per issue actually created: the finding `id` it came from, its `title`, and the real `url` GitHub returned.
- `summary` — how many issues were filed, split by severity, and any finding that could not be filed and why.
