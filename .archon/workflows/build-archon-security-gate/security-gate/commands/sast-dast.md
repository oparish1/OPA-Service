# Static & Dynamic Security Analysis (SAST/DAST)

Read `$ARTIFACTS_DIR/scope.md` first. Start from `$INPUTS.key_areas`'s `agent_loop`, `tool_defs`, and `api_routes` — agent tool code and UI/API code are this step's focus. This is a read-only pass: never run a tool's autofix option.

## Static analysis (SAST)

Run available static analysis tooling — `bandit` for Python, `semgrep`, `eslint` with security plugins for JS/TS, or the language-appropriate equivalent. Prefer whatever this repository's own CI config (found during priming) already uses before introducing a new tool.

If no SAST tool is configured or available in this environment, do not silently drop straight to a manual pass as if it were equivalent. Perform a manual pass focused on the OWASP Top 10 categories plus the agentic-specific classes (prompt injection, unauthorized tool execution) covered elsewhere in this review, and record the tooling gap explicitly in `coverage_gaps`.

## Dynamic analysis (DAST)

DAST is active, intrusive testing. This node was given `dast_authorized`: $INPUTS.dast_authorized — that is this run's only source of authorization, since there is no one to ask mid-run.

- If `$INPUTS.dast_authorized` is `"true"`, the application exposes a running API/UI endpoint reachable in this environment (e.g. a local dev server), and dynamic scanning tooling is available: run it against that locally reachable endpoint only. Set `dast_performed: true` and record findings.
- In every other case — not authorized, no live endpoint found, or no DAST tooling available — do not attempt any active probing. Set `dast_performed: false`, and record the specific reason in `coverage_gaps` (e.g. "DAST not authorized for this run" or "no live dev server found to test against"), recommending it be performed by the appropriate team before the gate is finalized.
- Never run SAST/DAST-style probing against anything beyond a server this run itself finds running locally, regardless of authorization.

## Write the analysis report

Write `$ARTIFACTS_DIR/sast-dast-results.md`: SAST findings (or the manual-pass findings, with the tooling gap noted), then a DAST section stating whether it was performed and why or why not.

## Declare

- `findings` — `id` (e.g. `SAST-1`), `tool` (the actual tool used, or "manual pass" if none was available), `file`, `line`, `category`, `severity`, `description`. DAST findings, if any, go in this same array with `tool` naming the DAST tool used.
- `dast_performed` — as determined above.
- `coverage_gaps` — the SAST tooling gap if one existed, and the DAST gap/reason if DAST was not performed.
- `summary` — a few sentences: what tooling ran, what gaps exist, and the headline finding if any.
- `report` — the pointer to `sast-dast-results.md`.
