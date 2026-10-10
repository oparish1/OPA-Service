# Identity, Access & Agent Execution Boundary Audit

Read `$ARTIFACTS_DIR/scope.md` first. This review's scope is `$INPUTS.agentic_scope` and it is multi-tenant: `$INPUTS.multi_tenant`. Start from the `key_areas` paths this run's priming located: `$INPUTS.key_areas` — `auth`, `session`, and (when the scope is agentic or both) `agent_loop` and `tool_defs`. Record every finding with a real `file:line` reference, a description of the exploit scenario, and a severity (Critical/High/Medium/Low, by exploitability × impact).

## Authentication & token exchange

- How are users or services authenticated — session tokens, JWTs, OAuth/OIDC, API keys? Identify the mechanism and where it's implemented.
- Is signature, expiry, audience, and issuer checked on every protected path, or only at the edge? Look for a path that trusts a token's claims without re-validating.
- Token exchange between services (user token → downstream service token, or user token → tool-execution credential): is scope narrowed on exchange, or does a broad token get forwarded as-is to a narrower-privilege operation?
- Credential storage: hardcoded secrets, API keys committed to the repo, secrets logged in plaintext, or secrets passed via command-line arguments (visible in process lists).

## Session lifecycle

- Confirm session creation, expiry, renewal, and invalidation (logout, password change, privilege change) each exist and actually revoke access — not just clear a client-side flag.
- Session fixation: does the session ID change on privilege escalation (login)?
- Idle/absolute timeout enforcement, especially for long-running agent sessions or conversations that may stay "open" far longer than a typical web session.

## RBAC across agent tool execution boundaries — run only when `$INPUTS.agentic_scope` is `agentic` or `both`

This is the part classical app-sec checklists miss.

- When the agent calls a tool or function, does that execution run with the *calling user's* actual permissions, or a static/elevated service credential shared across all users? This is the most common agentic privilege-escalation pattern — a low-privilege user's request causing a high-privilege tool call.
- Is there a permission check *at the tool-execution layer itself*, independent of whatever the model decided to call? The model choosing not to call a tool is not an access control — a jailbroken or misled model can choose to call it anyway.
- When `$INPUTS.multi_tenant` is true: can context or tool calls from one tenant's agent session reach another tenant's data, via shared caches, shared vector stores, or a tool that doesn't scope its query by tenant/user ID?
- Least privilege: do tool credentials (DB connections, API keys the agent's tools use) have broader scope than the tools actually need?

If `$INPUTS.agentic_scope` is `non_agentic`, skip this sub-section entirely and note in your summary that it was skipped because the review is scoped as non-agentic.

## Write the findings report

Write `$ARTIFACTS_DIR/identity-access-findings.md`, grouped by the three sub-sections above, each finding with its `file:line`, exploit scenario, and severity.

## Declare

- `findings` — `id` (e.g. `IA-1`), `subcategory`, `file`, `line`, `description`, `severity`, `recommended_fix`.
- `coverage_gaps` — anything this lens could not evaluate and why (e.g. a credential-exchange path that isn't exercised anywhere in the current test suite, so its actual behavior couldn't be confirmed by reading alone).
- `summary` — a few sentences: what was covered, and the headline identity/access risk if any.
- `report` — the pointer to `identity-access-findings.md`.
