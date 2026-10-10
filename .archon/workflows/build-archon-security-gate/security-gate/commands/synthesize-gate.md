# Write the Security Assessment & Threat Gate Approval Sign-off

Read `$ARTIFACTS_DIR/scope.md` and every lens report that exists: `identity-access-findings.md`, `api-data-findings.md`, `agentic-threat-model.md` (when the review was scoped as agentic or both), `dependency-scan.md`, `sast-dast-results.md`. If `agentic-threat-model.md` does not exist because that lens legitimately did not run (a non-agentic review), that is not a coverage gap — note it as an explicit scope exclusion instead. If any other report is missing because its lens failed rather than legitimately skipped, that **is** a coverage gap, and a significant one: record it and weigh it in the decision below exactly as you would an unmitigated finding of unknown severity.

**This is the one instruction in this whole workflow that must never bend: the gate decision is never softened or guessed to be agreeable.** Apply the rules below exactly as written, on the actual severities the lenses reported — not on what would be convenient, not on what the person running this would rather hear.

## Consolidate every finding

Pull every finding from every lens report and every scenario from the threat model into one list. Preserve each item's original `id` so the report and, if issues are filed later, `file-security-issues.md` can reference it unambiguously.

## Apply the gate decision rules exactly

- **FAIL** — any unmitigated Critical finding: privilege escalation across the tool-execution boundary, secrets exposed, unauthenticated access to sensitive data or tools, or an agentic threat scenario with no independent control beyond model judgment on a high-blast-radius tool (`mitigation_status: unmitigated` at `severity: Critical`).
- **CONDITIONAL PASS** — no unmitigated Critical findings, but High findings exist with a credible remediation plan and timeline; deployment can proceed if the conditions are tracked and enforced.
- **PASS** — no unmitigated Critical or High findings; any Medium/Low findings are documented with accepted-risk sign-off or a remediation plan.

**If evidence is incomplete** — a coverage gap exists anywhere (no scanner available, no SAST tool configured, DAST not performed, a lens failed) — do not default to PASS. Reflect the gap in the decision and rationale, and lean toward CONDITIONAL PASS with the gap itself named as a condition, even if every finding actually found was Medium or lower.

## Write the sign-off document

Write `$ARTIFACTS_DIR/security-assessment-signoff.md`:

```markdown
# Security Assessment & Threat Gate Approval Sign-off — [project name]

## Gate Decision: [PASS | CONDITIONAL PASS | FAIL]

- **Rationale:** [1-3 sentences — why this decision, citing the specific findings/gaps that drove it]
- **Conditions for approval (if CONDITIONAL PASS):** [explicit list of what must be remediated, and whether before or shortly after deployment]
- **Blocking issues (if FAIL):** [explicit list of the Critical findings that must be resolved and re-reviewed]
- **Sign-off required from:** [role(s), e.g. security lead, engineering lead — if the appropriate approving role isn't evident from the codebase or org context, leave this blank for the reader to fill in rather than guessing a generic title]
- **Review scope & date:** [agentic_scope and multi_tenant from scope.md, what was and wasn't in scope, today's date]

## Summary of Findings
| Severity | Count | Category breakdown |
|---|---|---|
| Critical | N | ... |
| High | N | ... |
| Medium | N | ... |
| Low | N | ... |

## 1. Identity, Access & Agent Execution Boundaries
[findings from identity-access-findings.md, each with file:line, exploit scenario, severity, recommended fix]

## 2. API & Data Exposure
[findings from api-data-findings.md, same format]

## 3. Agentic Threat Model
[scenarios from agentic-threat-model.md as actor → vector → target → impact, likelihood × impact, mitigation status — or "Out of scope: this review was scoped as non-agentic." if it did not run]

## 4. Dependency & Model Integration Vulnerabilities
[findings from dependency-scan.md, CVE/CVSS where available, patch availability]

## 5. Static & Dynamic Analysis Results
[findings from sast-dast-results.md, plus every coverage gap named explicitly — e.g. "No DAST performed: not authorized for this run; recommend before deployment."]

## Residual Risk Accepted
[Any Medium/Low findings worth flagging as candidates to accept as-is, with justification — leave the actual acceptance for the named approver to confirm; do not accept risk unilaterally here]

## Appendix: Full Finding List
[every finding and scenario, including Low severity, for audit trail purposes]
```

## Declare

- `gate_decision` — `PASS`, `CONDITIONAL_PASS`, or `FAIL`, exactly per the rules above.
- `critical_count`, `high_count`, `medium_count`, `low_count` — from the consolidated list.
- `most_urgent_action` — one sentence: the single most urgent next action, matching what belongs in a terse inline summary.
- `blocking_finding_ids` — the ids of every unmitigated Critical finding driving a FAIL, or empty.
- `summary` — the gate decision stated plainly first (e.g. "Gate decision: CONDITIONAL PASS — 2 High findings require remediation before general availability"), then the counts and the single most urgent action. Never bury or soften the decision in this summary.
- `report` — the pointer to `security-assessment-signoff.md`.
