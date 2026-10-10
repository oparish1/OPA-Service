# Context & State Integrity Audit

Read `$ARTIFACTS_DIR/scope.md` first — it names the core execution path this audit covers and what's excluded. This is the category most specific to LLM and agentic prototypes: where per-request or per-user data leaks across boundaries it shouldn't, where state can end up inconsistent, and where the system has no defined, deterministic path when a model call doesn't behave. Read breadth-first across `core_paths`, and record every concrete finding with a real `file:line` reference.

Look for, in three sub-categories:

**Context leaks**
- Conversation history, memory, or context objects mutated in place and shared across requests, sessions, or users without isolation.
- Global variables or module-level state holding per-request data — a classic source of cross-request contamination in agent loops.
- Context-window construction that doesn't truncate or scope properly, risking stale or unrelated context bleeding into a new task.

**State corruption risks**
- Concurrent access to shared state (agent loops, caches, session stores) without locks or immutability.
- Partial writes or updates that can leave state inconsistent if interrupted mid-operation — no transactions, no atomic writes.
- Retry logic that re-runs side-effecting operations (writes, tool calls with side effects) without idempotency guards.

**Deterministic fallback controls**
- No fallback path when the LLM call fails, returns malformed output, or exceeds retries — does the system degrade gracefully, or crash or hang?
- No validation layer between LLM output and downstream consumption — e.g. parsing JSON from a model response with no schema check and no defined fallback.
- Non-deterministic behavior (temperature above 0, unseeded randomness) in paths where reproducibility matters, with no override for testing.

## Record each finding

For every finding: `id` (e.g. `C-1`, `C-2`, ...), `subcategory` (one of the three above), `file`, `line` when a specific line applies, `description` (what's wrong and why it matters), `suggested_fix` (concrete, not vague), `effort` (S/M/L).

## Write the findings report

Write `$ARTIFACTS_DIR/context-state-findings.md`, grouped by the three sub-categories above, each finding with its `file:line` and the fields recorded above.

## Declare

- `findings` — the array, as recorded.
- `summary` — a few sentences: what was covered, and the headline context/state risk if any.
- `report` — the pointer to `context-state-findings.md`.
