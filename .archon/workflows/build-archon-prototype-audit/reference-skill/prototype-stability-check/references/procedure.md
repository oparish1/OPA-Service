# Prototype Stability Check — Full Procedure

This file contains the detailed step-by-step process. Load it once the skill has
activated and you're ready to execute.

## Step 0: Prime the Codebase

**Always run this step first.** Reuse the `prime-codebase` skill exactly as documented,
forwarding any `[jira-issue-keys]` and `[confluence-page-ids]` arguments given to this skill:

1. If Jira keys or Confluence page ids were provided, follow `prime-codebase` Step 0 to load
   that external context (task goals, acceptance criteria, specs).
2. Run `prime-codebase` Steps 1–4 in full: project structure (`git ls-files`, `tree`), core
   docs (README/CLAUDE.md), key files (entry points, config, schemas) and current state
   (`git log`, `git status`).
3. If this session has already primed the codebase earlier in the conversation, you may reuse
   that context instead of re-running it — but confirm it's still fresh (no major commits
   since) before skipping.

If a `[path-glob]` argument is given (e.g. `src/agents/**`), scope the audit below to that
subtree; otherwise audit the whole primed codebase, weighting effort toward the core execution
path (the main entry point, the orchestration/agent loop and anything the prime step flagged
as central). If priming doesn't make the core execution path obvious (e.g. multiple plausible
entry points, or an unclear boundary between prototype code and vendored/generated code), ask
the user which subtree to focus on rather than guessing — an audit scoped to the wrong code
wastes the session.

Also ask the user (briefly, before starting Step 1) what this prototype's deployment context
and risk tolerance are — e.g. internal demo vs. handling real user data vs. anything
financial/medical/safety-relevant — if that isn't already stated or obvious from the codebase
(README, domain, existing compliance code). This materially changes what counts as a "release
blocker" in Step 3 and guessing it wrong either overstates risk on a throwaway prototype or
understates it on something that actually matters.

Do not proceed to Step 1 without having completed priming — the audit's findings need to be
anchored in actual file paths and actual architecture, not generic advice.

## Step 1: Structural Weakness Audit

Read through the core execution path identified during priming (not every file — prioritize
breadth-first triage over exhaustive line-by-line review). For each area, look for and record
concrete findings with file:line references:

**Hardcoded prompt / logic smells**
- Prompt strings, system messages, or few-shot examples inlined directly in business logic
  rather than templated/configurable
- Magic strings used as control flow (e.g. matching on raw LLM output text instead of
  structured output/tool calls)
- Model names, temperatures, token limits, or provider-specific parameters hardcoded rather
  than configured

**Unhandled edge cases**
- No handling for empty/null/malformed inputs
- No handling for API failures, timeouts, or rate limits on external calls (LLM APIs, tool
  calls, network requests)
- Silent failures — `except: pass`, swallowed errors, or fallback values returned without
  logging
- Off-by-one or boundary conditions in loops, pagination, or retries

**Missing unit/mock boundaries**
- Business logic tightly coupled to I/O (network, filesystem, LLM calls) with no seam for
  mocking
- No dependency injection — hard imports of concrete clients rather than interfaces/protocols
- Tests (if any exist) that call real external services instead of mocks/fixtures
- Untestable functions: side effects mixed with computation, no return values to assert on

Use `grep`/`rg` sweeps to accelerate this (e.g. searching for `except:`, `TODO`, `FIXME`,
hardcoded API keys or model strings, print-debugging left in place) but always read
surrounding context before flagging — don't report matches without verifying they're real
issues.

## Step 2: Context & State Integrity Audit

This is the category most specific to LLM/agentic prototypes. Look for:

**Context leaks**
- Conversation history, memory, or context objects that are mutated in place and shared
  across requests/sessions/users without isolation
- Global variables or module-level state holding per-request data (a classic source of
  cross-request contamination in agent loops)
- Context window construction that doesn't truncate/scope properly, risking stale or
  unrelated context bleeding into a new task

**State corruption risks**
- Concurrent access to shared state (agent loops, caches, session stores) without locks or
  immutability
- Partial writes/updates that can leave state inconsistent if interrupted mid-operation (no
  transactions, no atomic writes)
- Retry logic that re-runs side-effecting operations (writes, tool calls with side effects)
  without idempotency guards

**Deterministic fallback controls**
- No fallback path when the LLM call fails, returns malformed output, or exceeds retries —
  does the system degrade gracefully or crash/hang?
- No validation layer between LLM output and downstream consumption (e.g. parsing JSON from
  a model response without a schema check and a defined fallback)
- Non-deterministic behavior (temperature > 0, unseeded randomness) in paths where
  reproducibility matters, with no override for testing

## Step 3: Prioritized Refactoring Backlog

Consolidate every finding from Steps 1–2 into a single backlog and classify each item into
exactly one of three categories:

- **Release Blockers** — would cause data corruption, crashes in common paths, security
  exposure, or make the harness itself unreliable if left unfixed. Fix before anything else
  proceeds.
- **Parallel Feature Cleanups** — real debt, but isolated enough to fix alongside ongoing
  feature work without blocking it. Bundle these with the sprint(s) touching that area of code.
- **Deferrable Debt** — valid but low-risk or low-frequency-path issues; track them but don't
  let them block velocity.

For each backlog item, capture: `title`, `category`, `file(s):line(s)`, `description` (what's
wrong and why it matters), `suggested fix` (concrete, not vague) and `estimated effort`
(S/M/L).

Order items within each category by risk × blast radius, highest first.

Classification into these three categories is a judgment call and the boundary between
"Release Blocker" and "Parallel Feature Cleanup" is often genuinely unclear without knowing
the user's priorities. Where a finding could reasonably sit in either of two categories, don't
silently pick one — note the ambiguity in the report itself (e.g. "classified as Parallel
Cleanup, but arguably a Release Blocker if X matters for this deployment") so the user can
override it, rather than presenting the classification as a settled fact.

## Step 4: MVP Code Audit Report

Produce the audit report as a markdown deliverable (use the `docx` skill instead only if the
user explicitly wants a Word document). Structure — see `references/report-templates.md` for
the exact markdown templates for both deliverables.

## Step 5: Claude Code-Sequenced Remediation Plan

Convert the Prioritized Backlog into a sprint-sequenced execution plan formatted for Claude
Code to consume and drive. This is a separate deliverable from the audit report (keep the
audit as the diagnosis, this as the treatment plan).

Structure it as a numbered sequence of Claude Code tasks, sprint by sprint. See
`references/report-templates.md` for the exact template.

Each task must be phrased so Claude Code can pick it up directly with minimal
re-interpretation: concrete file paths, a clear definition of done and explicit
test/verification criteria. Avoid vague instructions like "improve error handling" — say
exactly what to catch, where and what the resulting behavior should be.

## Step 6: Execute Critical Structural Fixes

Before handing the rest of the plan off to be scheduled, execute the **Sprint 0 / Release
Blockers** now, in this session, so the prototype is stable enough for harness work to begin:

1. Work through Sprint 0 tasks in dependency order.
2. For each: make the fix and if a test framework exists in the codebase, add or update a
   test that exercises it (favor the mock/fixture boundaries identified in Step 1 rather than
   hitting real external services). If no test framework exists in the codebase, don't
   silently skip testing or silently introduce a new one — ask the user whether to add a
   minimal test setup now or defer test coverage to a later sprint, since introducing a test
   framework is itself a stack decision.
3. Run the existing test suite (or the relevant subset) after each fix to confirm no
   regression.
4. Do not attempt Parallel Feature Cleanups or Deferrable Debt items in this step — those are
   intentionally left for the sequenced plan, not fixed inline, to avoid scope creep into
   feature-adjacent code the user hasn't asked you to touch yet.
5. If a release blocker turns out to be larger than estimated (e.g. requires an architectural
   decision only the user can make), stop, flag it clearly in your response and leave it open
   in the plan rather than guessing.
