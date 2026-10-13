# Structural Weakness Audit

Read `$ARTIFACTS_DIR/scope.md` first — it names the core execution path this audit covers and what's excluded. Read breadth-first across `core_paths`, prioritizing triage over exhaustive line-by-line review. For each concrete finding, record it with a real `file:line` reference — never a vague area. Use `grep`/`rg` sweeps to find candidates quickly (`except:`, `TODO`, `FIXME`, hardcoded API keys or model strings, print-debugging left in place), but always read the surrounding context before recording a finding — a raw match is a lead, not a finding.

Look for, in three sub-categories:

**Hardcoded prompt / logic smells**
- Prompt strings, system messages, or few-shot examples inlined directly in business logic rather than templated or configurable.
- Magic strings used as control flow — matching on raw LLM output text instead of structured output or tool calls.
- Model names, temperatures, token limits, or provider-specific parameters hardcoded rather than configured.

**Unhandled edge cases**
- No handling for empty, null, or malformed inputs.
- No handling for API failures, timeouts, or rate limits on external calls (LLM APIs, tool calls, network requests).
- Silent failures — a bare `except: pass`, a swallowed error, or a fallback value returned without logging.
- Off-by-one or boundary conditions in loops, pagination, or retries.

**Missing unit/mock boundaries**
- Business logic tightly coupled to I/O (network, filesystem, LLM calls) with no seam for mocking.
- No dependency injection — hard imports of concrete clients rather than interfaces or protocols.
- Existing tests, if any, that call real external services instead of mocks or fixtures.
- Untestable functions: side effects mixed with computation, no return value to assert on.

## Record each finding

For every finding: `id` (e.g. `S-1`, `S-2`, ...), `subcategory` (one of the three above), `file`, `line` when a specific line applies, `description` (what's wrong and why it matters), `suggested_fix` (concrete — say exactly what to catch, where and what the resulting behavior should be, not "improve error handling"), `effort` (S/M/L).

## Write the findings report

Write `$ARTIFACTS_DIR/structural-findings.md`, grouped by the three sub-categories above, each finding with its `file:line` and the fields recorded above.

## Declare

- `findings` — the array, as recorded.
- `summary` — a few sentences: what was covered and the headline structural risk if any.
- `report` — the pointer to `structural-findings.md`.
