# Prime the Codebase and Resolve the Security Review's Scope

Ground this security review in the actual codebase before any lens starts, and resolve the two facts that change how findings downstream are scored: whether this is an agentic review, a non-agentic review, or both, and whether the system is multi-tenant. No one watches this run. Where the source skill this workflow is built from would ask you a question in conversation, you instead record it as an open question and declare `scope_resolved: false` — the same shape `archon-triage`'s `BLOCKED` uses elsewhere in this pack. Never guess at either fact and proceed anyway; both change what counts as a Critical finding, and a security gate should not stand on an unresolved input that changes its own scoring.

## Step 1: Prime

Run `/prime-codebase` (or reuse its output if this session already primed this repository and nothing material has changed since). Forward these if given:

- Jira issue keys: $INPUTS.jira_issue_keys
- Confluence page ids: $INPUTS.confluence_page_ids

Follow `/prime-codebase`'s own Step 0 to load that context first when either is given — prior findings, security requirements, and compliance obligations often live there — then its Steps 1–4 in full.

## Step 2: Locate the key areas

While priming, specifically find and record file paths for each of these into `key_areas` (empty arrays where a category genuinely doesn't apply, not omitted):

- `auth` — authentication/authorization code, token validation, credential exchange.
- `session` — session creation, expiry, renewal, invalidation.
- `agent_loop` — the agent orchestration loop, if one exists.
- `tool_defs` — tool/function-calling definitions the agent can invoke.
- `api_routes` — API route definitions.
- `dependency_manifests` — `package.json`/`package-lock.json`, `requirements.txt`/`poetry.lock`/`Pipfile.lock`, `pyproject.toml`, `go.mod`/`go.sum`, `Cargo.toml`/`Cargo.lock`, and equivalents.
- `ci_config` — CI/CD configuration.
- `secrets_locations` — where `.env` files or other secrets-adjacent config are expected to live and how they're loaded. Record the **location and loading mechanism only** — never read or record an actual secret value.

## Step 3: Resolve the review's scope

Determine whether this codebase includes at least one LLM-driven agent with tool-calling ability (`agentic`), is a traditional application with none (`non_agentic`), or has both agentic and non-agentic surfaces worth reviewing separately (`both`).

If this is genuinely ambiguous from priming — tool-calling scaffolding exists but isn't wired up yet, or agentic behavior is planned but not yet implemented — do not silently pick one. Add a specific question to `open_questions`, for example: "This repository has tool-calling scaffolding in `src/agent/tools.py` that doesn't appear to be wired into a live agent loop yet — should this review be scoped as agentic, non-agentic, or both?"

## Step 4: Resolve multi-tenancy

Determine whether the codebase is multi-tenant (a single deployment serves multiple customers/orgs with data that must stay isolated per account) or genuinely single-tenant. This changes the severity of any shared-cache, shared-vector-store, or unscoped-query finding the lenses report later.

If priming doesn't make this clear, do not assume either answer. Add a specific question to `open_questions`, for example: "This codebase doesn't make tenant isolation clear from priming alone — is this system multi-tenant (do customer accounts share infrastructure whose isolation this review should verify), or single-tenant?"

## Declare `scope_resolved`

True only when both `agentic_scope` and `multi_tenant` are resolved with no open question outstanding — i.e. `open_questions` is empty. Otherwise false.

## Write the scope note

Write `$ARTIFACTS_DIR/scope.md`:

```markdown
# Security review scope

## Review scope
[agentic_scope, and how it was determined]

## Multi-tenancy
[multi_tenant, and how it was determined]

## Key areas located
[key_areas, each category with its file list or "None found."]

## Open questions
[open_questions verbatim, or "None."]
```

## Declare

- `scope_resolved`, `agentic_scope`, `multi_tenant`, `key_areas`, `open_questions` — as above.
- `summary` — a few sentences: what will be reviewed, and if not yet resolved, the single most important open question.
- `report` — the pointer to `scope.md`.
