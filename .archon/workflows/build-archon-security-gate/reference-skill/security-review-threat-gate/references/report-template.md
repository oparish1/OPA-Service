# Step 6: Security Assessment & Threat Gate Approval Sign-off

Consolidate every finding from Steps 1–5 into a single deliverable — this is the report that gets signed off, not just a findings dump. Structure:

```markdown
# Security Assessment & Threat Gate Approval Sign-off — [project name]

## Gate Decision: [PASS | CONDITIONAL PASS | FAIL]

- **Rationale:** [1-3 sentences — why this decision]
- **Conditions for approval (if CONDITIONAL PASS):** [explicit list of what must be remediated,
  and whether it must happen before or can happen shortly after deployment]
- **Blocking issues (if FAIL):** [explicit list of Critical findings that must be resolved and re-reviewed]
- **Sign-off required from:** [role(s) — e.g. security lead, engineering lead. If the appropriate approving role isn't evident from the codebase/org context, ask the user who should be named here rather than guessing a generic title; otherwise leave the named individual blank for the user to fill in]
- **Review scope & date:** [what was and wasn't in scope and today's date]

## Summary of Findings
| Severity | Count | Category breakdown |
|---|---|---|
| Critical | N | ... |
| High | N | ... |
| Medium | N | ... |
| Low | N | ... |

## 1. Identity, Access & Agent Execution Boundaries
[findings from Step 1, each with file:line, exploit scenario, severity, recommended fix]

## 2. API & Data Exposure
[findings from Step 2, same format]

## 3. Agentic Threat Model
[scenarios from Step 3 as actor → vector → target → impact, likelihood × impact, mitigation status]

## 4. Dependency & Model Integration Vulnerabilities
[findings from Step 4, CVE/CVSS where available, patch availability]

## 5. Static & Dynamic Analysis Results
[findings from Step 5, plus explicit list of any tooling/coverage gaps — e.g. "no DAST performed;
recommend before deployment"]

## Residual Risk Accepted
[Any Medium/Low findings the reviewer recommends accepting as-is, with justification — leave
for the user/approver to confirm, don't accept risk unilaterally]

## Appendix: Full Finding List
[every finding, including Low severity, for audit trail purposes]
```

**Gate decision rules:**
- **FAIL** — any unmitigated Critical finding (privilege escalation across the tool-execution boundary, secrets exposed, unauthenticated access to sensitive data/tools, or an agentic threat scenario with no independent control beyond model judgment on a high-blast-radius tool).
- **CONDITIONAL PASS** — no unmitigated Critical findings, but High findings exist with a credible remediation plan and timeline; deployment can proceed if conditions are tracked and enforced.
- **PASS** — no unmitigated Critical or High findings; Medium/Low findings are documented with accepted-risk sign-off or a remediation plan.

Never mark PASS to be agreeable — the gate's value depends on it reflecting the actual finding severity. If evidence is incomplete (e.g. no DAST was possible), do not default to PASS; reflect the gap in the decision and rationale and lean toward CONDITIONAL PASS with the gap named as a condition.
