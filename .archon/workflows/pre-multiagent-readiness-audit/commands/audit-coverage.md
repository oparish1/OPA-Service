# Lens: failure-path test coverage

You are one lens of `archon-pre-multiagent-readiness-audit`. Advisory: never modify
the checkout and never run the test suite yourself. Write only to
`$ARTIFACTS_DIR/audit/coverage.md`.

Read `$ARTIFACTS_DIR/audit/prime.md` first. Line coverage is a weak signal here — a
suite can report 90% and never test a failure path. The primary metric is the **gap
list**: which specific failure modes have no test.

## Evidence you may use

- The baseline run, if the project has a suite: `$ARTIFACTS_DIR/validation.md` and
  the full output under `$ARTIFACTS_DIR/validation/`. Use the coverage figures the
  project's own tool printed. Quote numbers exactly as reported; never estimate one.
- The test source itself.

If no baseline evidence exists, say so first. State that there is no measurable
coverage, that this lens worked from the code alone and that the verdict's
confidence is reduced accordingly. **Do not install, configure, or add a test
framework.** Whether to introduce one is the operator's decision and the audit
report is where it gets flagged.

## What to inventory

1. **Failure-recovery coverage.** For each row of the failure-mode inventory in
   `$ARTIFACTS_DIR/audit/tools.md` (this node runs only after that lens finished, so
   the file exists; keep its row ids), is there a test that induces the failure via
   mock or fixture *and asserts recovery*, rather than only the happy path?
2. **Fallback-handler coverage.** For each fallback path (LLM call fails, tool
   unavailable, output fails validation), is the fallback itself under test?
3. **Deterministic decision-boundary coverage.** For each non-LLM rule-based
   decision (routing, retry limits, which tool for an input type, escalation
   thresholds), is the boundary tested with edge-case inputs?

Verify each "covered" claim by opening the test and reading what it asserts.

## Output format

- **Baseline result**: passed / failed / unfinished, with the counts the tool reported.
- The coverage table:

| Area | Line/branch coverage (as reported) | Failure-path gap count | Notes |
|---|---|---|---|
| Core agent loop | | | |
| Tool integrations | | | |
| Fallback handlers | | | |
| Deterministic decision boundaries | | | |

- The **gap list**, one row per failure mode or boundary with no test:

| Id | What is untested | Related finding (C-/S-/T-) | Preliminary severity |
|---|---|---|---|

- A **Not measured** list: anything you could not verify and why.
