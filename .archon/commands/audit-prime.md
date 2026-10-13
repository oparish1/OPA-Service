# Prime the codebase for a pre-multi-agent readiness audit

You are the first node of `archon-pre-multiagent-readiness-audit`. This audit is
advisory: never modify the checkout. Write only under `$ARTIFACTS_DIR/audit/`.

Every later node starts with a fresh context and knows only what you write to
`$ARTIFACTS_DIR/audit/prime.md`. That file is the audit's shared ground truth, so
every claim in it carries a real `file:line` reference.

## Run inputs

- Declared multi-agent shape: `$INPUTS.shape` (may be empty)
- Scope to audit: `$INPUTS.scope` (may be empty)
- Design reference: `$INPUTS.design` (may be empty)
- Existing logs/traces: `$INPUTS.traces` (may be empty)

## 1. Prime

Read the repository the way a new maintainer would: project structure, core docs
(README, architecture notes, ADRs, `AGENTS.md`/`CLAUDE.md`), the key files and the
current state (recent history, open work). If `$INPUTS.design` names a document or
issue, read it in full.

Locate, inside the scope and record with `file:line`:

1. **The agent's core execution loop** — where a turn or task starts, how the model
   is called and how the loop ends. If the scope contains more than one
   independent agent loop and `$INPUTS.scope` did not select one, do not pick: set
   `agent_found` to false and say which loops you found.
2. **Every tool or function the agent can call**, with its implementation location.
3. **All state read or written** — in-memory, cache, database, files, vector store —
   and who reads and writes each.
4. **The test suite** — where it lives, its framework and the coverage tool the
   project already configures (if any). Do not run anything.
5. **Model-call configuration** — retries, timeouts, temperature, model names.
6. **Existing instrumentation** — logging, tracing, token counting.

## 2. Resolve the target shape

Severity in every later step depends on the planned shape and it cannot be
inferred from code. Resolve it in this order and stop at the first source that
answers:

1. `$INPUTS.shape`, if non-empty. It must be one of `orchestrator`, `parallel`,
   `handoff`, `other`. If it is anything else, return `shape: unknown` and say so
   in `summary` — do not repair it.
2. The design reference or the repository's own documents (a design doc, ADR, or
   issue that states the planned pattern). `shape_source: document`.
3. Otherwise `shape: unknown`, `shape_source: none`. **Never guess a shape.**

Definitions: `orchestrator` — one agent delegating to sub-agents; `parallel` —
concurrent worker agents; `handoff` — strictly sequential agent-to-agent handoffs;
`other` — anything else (describe it in prime.md and treat it as concurrent).

## 3. Write `$ARTIFACTS_DIR/audit/prime.md`

Sections: **Scope**, **Resolved shape** (value, source, quoted evidence and which
current boundaries the design would turn into agent boundaries), **Execution loop**,
**Tools**, **State inventory** (one row per piece of state: name, location, readers,
writers), **Tests** (location, framework, coverage tool or "none configured"),
**Model-call configuration**, **Existing instrumentation**, **Traces supplied**
(the `$INPUTS.traces` path, or "none").

## 4. Return

`tests_present` is true only if an executable test suite exists in scope. Keep
`summary` to two sentences. Return only the structured result.
