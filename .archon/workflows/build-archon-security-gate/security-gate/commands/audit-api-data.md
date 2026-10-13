# API & Data Exposure Review

Read `$ARTIFACTS_DIR/scope.md` first. This review's scope is `$INPUTS.agentic_scope`. Start from `$INPUTS.key_areas` — `api_routes` and (when the scope is agentic or both) `agent_loop` and `tool_defs`. Record every finding with a real `file:line` reference, a description of the exposure and a severity (Critical/High/Medium/Low, by exploitability × impact).

## Excessive data exposure

- API responses that return full internal objects (ORM models, full DB rows) rather than a scoped response schema — classic over-fetching that leaks fields the client or model never needed.
- Error messages or stack traces returned to callers in production mode, revealing internal paths, library versions, or query structure.
- Verbose logging that captures full request/response bodies including PII, credentials, or full model context windows, especially where logs are broadly readable.

## Unvalidated inputs

- Missing input validation or sanitization at API boundaries — type, length, format and allow-list checks, not just presence checks.
- Injection classes: SQL/NoSQL injection, command injection, path traversal, SSRF (especially relevant if a tool fetches URLs supplied by the model or user). Confirm user- or model-supplied strings are never concatenated directly into queries, shell commands, or fetch targets.
- Deserialization of untrusted input (`pickle`, unsafe YAML load and equivalents).

## Data leakage in model contexts — run only when `$INPUTS.agentic_scope` is `agentic` or `both`

- Is there a boundary preventing system prompts, internal tool schemas, other users' data, or secrets from being included in the context window sent to the model, or echoed back in model output?
- Retrieval pipelines (RAG): does the retrieval step enforce the same access control as the underlying data source, or can a query retrieve documents the querying user shouldn't see?
- Are tool outputs (which may contain sensitive data) fed back into context that later gets logged, cached, or sent to a third-party model provider without the same data-handling controls as the original data source?

If `$INPUTS.agentic_scope` is `non_agentic`, skip this sub-section entirely and note in your summary that it was skipped because the review is scoped as non-agentic.

## Write the findings report

Write `$ARTIFACTS_DIR/api-data-findings.md`, grouped by the three sub-sections above, each finding with its `file:line`, description and severity.

## Declare

- `findings` — `id` (e.g. `AD-1`), `subcategory`, `file`, `line`, `description`, `severity`, `recommended_fix`.
- `coverage_gaps` — anything this lens could not evaluate and why.
- `summary` — a few sentences: what was covered and the headline exposure risk if any.
- `report` — the pointer to `api-data-findings.md`.
