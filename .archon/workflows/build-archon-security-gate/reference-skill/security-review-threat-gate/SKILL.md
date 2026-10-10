---
name: security-review-threat-gate
description: "Runs a pre-production security audit covering both classical app security (authn/authz, RBAC, API exposure) and agentic threats (prompt injection, unauthorized tool execution), ending in a pass/conditional-pass/fail gate decision. Use for security reviews, threat models, security sign-offs, CVE/dependency scans, SAST/DAST requests, or go/no-go decisions before deploying an agentic system."
---

# Security Review & Threat Gate

## Objective

Conduct a comprehensive security audit of the codebase covering both classical enterprise application security vulnerabilities and agentic-specific threat surfaces, and conclude with an explicit **gate decision** — pass, conditional pass, or fail — before the system is approved for production deployment. This is not an advisory-only review: it ends in a sign-off artifact that names a decision-maker and records what must be true for approval to stand.

**Governing rule for this whole process: the gate decision itself must never be softened or guessed to be agreeable, but the *inputs* that feed it — review scope, whether coverage gaps are acceptable, tenant/risk context, who the right approver is, where to save the report — are frequently things only the user can supply. Ask for those rather than assuming a default that could silently under-scope the review.** A security review's value depends on its scope and coverage being honestly represented; a silent assumption here doesn't just risk redoing work, it risks a sign-off that looks authoritative but rests on an unstated gap.

This skill assumes the system includes at least one LLM-driven agent with tool-calling ability. If the codebase is a traditional (non-agentic) application, run Steps 1, 2, and 4–5 and skip the agentic-specific portions of Steps 1 and 3, noting the skip in the report. If priming leaves this ambiguous — e.g. tool-calling scaffolding exists but isn't wired up yet, or agentic behavior is planned but not yet implemented — ask the user whether to scope the review as agentic, non-agentic, or both, rather than silently picking one; the agentic sections are the ones classical security reviews miss, so silently dropping them under-scopes the review.

## Inputs

- **`output_dir`** (required): the directory to write the final report to. This skill does not assume or hardcode a location — ask the caller/user for it if not already supplied (e.g. by an orchestrating workflow passing its own artifacts directory).

## Process

### Step 0: Prime the Codebase

**Always run this step first.** Reuse the `prime-codebase` skill exactly as documented:

1. If Jira issue keys or Confluence page ids are available/relevant, follow `prime-codebase` Step 0 to load that external context first (security requirements, compliance obligations, prior findings often live there).
2. Run `prime-codebase` Steps 1–4 in full: project structure (`git ls-files`, `tree`), core docs (README/CLAUDE.md), key files (entry points, config, schemas), and current state (`git log`, `git status`).
3. If this session already primed the codebase earlier in the conversation and nothing material has changed, you may reuse that context instead of re-running it.

While priming, specifically locate and flag for deeper review in later steps: authentication/authorization code, session management, any agent orchestration loop, tool/function-calling definitions, API route definitions, dependency manifests (`package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`, `Cargo.toml`, lockfiles), CI/CD config, and any `.env`/secrets-adjacent files (do not read secret values — just note where secrets are expected to live and how they're loaded).

Do not proceed without having completed priming — every finding below needs a real file:line reference, not a generic security checklist answer.

### Steps 1–5: Audit

Follow **`references/procedure.md`** for the full audit procedure:

1. Identity, Access & Agent Execution Boundary Audit
2. API & Data Exposure Review
3. Agentic Threat Modeling
4. Dependency & Model Integration Vulnerability Scan
5. Static & Dynamic Security Analysis (SAST/DAST)

### Step 6: Report & Gate Decision

Follow **`references/report-template.md`** for the report structure and the PASS/CONDITIONAL PASS/FAIL decision rules.

## Output

Deliver, in this order:

1. **Security Assessment & Threat Gate Approval Sign-off** (markdown file; use the `docx` skill instead only if the user explicitly wants a Word document for formal circulation). Save it to `output_dir` (see Inputs above) and present it.
2. A short inline summary: the gate decision, the count of Critical/High findings, and the single most urgent next action

Do not soften or bury the gate decision in the inline summary — state it plainly up front (e.g. "Gate decision: CONDITIONAL PASS — 2 High findings require remediation before general availability").
