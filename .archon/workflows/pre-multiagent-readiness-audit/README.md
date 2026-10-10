# archon-pre-multiagent-readiness-audit

Audits a single-agent codebase before it is extended into a multi-agent pattern and
returns a readiness verdict. Advisory: the checkout is left as found and nothing
public is written. Derived from the `pre-multiagent-readiness-audit` skill.

## Where it sits in the SDLC pack

An upstream question, not a delivery stage. It answers "should we build this?", so it
runs beside `triage` and feeds `plan`:

```
audit → verdict.next = plan     (a prerequisite needs an architectural decision)
                     = deliver  (every prerequisite is a decided, local change)
                     = none     (READY)
```

## Graph

```
prime → shape-gate → baseline (archon-validate, only if a suite exists)
                        │
      ┌──────────┬──────┴───┬──────────┬──────────┐
   coupling    state      tools      metrics      │
                            └→ coverage           │
      └──────────┴──────────┴──────────┴──────────┘
                     lens-check (all_done)
                          compounding
                          synthesize
                           verdict
```

| Skill step | Node |
|---|---|
| 0 Prime, confirm shape | `prime`, `shape-gate` |
| 1 Coupling / state / tool failure | `coupling`, `state`, `tools` |
| 2 Failure-path coverage | `baseline` + `coverage` |
| 3 Compounding risk | `compounding` |
| 4 Latency, context, state isolation | `metrics` (+ isolation counts in `state`) |
| 5 Refactor (opt-in) | **out of scope** — see below |
| 6 Report | `synthesize` (body) + `verdict` (verdict and recommendation) |

## Inputs

| Input | Purpose |
|---|---|
| `shape` | `orchestrator`, `parallel`, `handoff` or `other`. Empty is allowed only if `design` or the repo's docs state it. |
| `scope` | The agent to audit. Empty means the repo's single agent loop. |
| `design` | Optional design doc, ADR or issue describing the proposed multi-agent design. |
| `traces` | Optional path to real logs/traces, the preferred source for latency and context metrics. |

## How the verdict is derived

The agent proposes a verdict. `scripts/verdict.ts` decides the final one: the more
severe of the proposal and a floor computed from checkable facts. A floor only ever
raises a verdict.

| Fact | Floor |
|---|---|
| any `critical` finding (multi-agent severity) | NOT_READY |
| any `high` finding | READY_WITH_CONDITIONS |
| unsafe (shared, unsynchronized) state, and the shape is not `handoff` | READY_WITH_CONDITIONS |
| high-risk failure modes with no test | READY_WITH_CONDITIONS |
| no green baseline suite (absent, red or unfinished) | READY_WITH_CONDITIONS |
| structural metrics wholly unmeasured | READY_WITH_CONDITIONS |
| a lens report missing | READY_WITH_CONDITIONS |
| any listed prerequisite | READY_WITH_CONDITIONS |

`ready` is true only for an unconditional READY. `confidence` is `low` when there is no
green baseline, no metrics, or a lens is missing, and `medium` when metrics are partial.
A non-READY verdict must name at least one prerequisite, or the node refuses.

## Deliberate departures from the skill

- **No interactive questions.** A run cannot ask, so each question became an input or a
  refusal. The shape is never assumed (`shape-gate` refuses). A missing test suite is
  never silently created: the coverage lens says there is nothing to measure and the
  verdict drops to conditions.
- **Never instruments.** The skill asks before adding temporary instrumentation; a run
  cannot ask, so the answer is always no. Metrics come from traces, existing test
  invocations, or are reported `unmeasurable`.
- **Step 5 (refactor) is not in this workflow.** It writes code, which contradicts the
  pack's advisory convention. The follow-up is `archon-deliver` with the report as the
  work order, or `archon-plan` first when `next` is `plan`, because the skill itself
  says a message bus or shared store is a decision a refactor must not make.

## Template lineage (all from this pack)

- `investigate` / `plan` / `triage`: advisory agent node, `mutates_checkout: false`,
  `output_type`, and an engine-certified artifact pointer to the report.
- `triage`: a `verdict` script node that derives the outcome from the agent's fields
  rather than trusting them.
- `review`: parallel `context: fresh` lenses with `retry`, an `all_done` barrier, and a
  deciding node that discloses a lens that never finished.
- `deliver`: `include: archon-validate` for the deterministic suite run.

## Things to confirm against your engine

The zip's `commands/`, `scripts/` and `fixtures/` folders were empty, so these are
assumptions I could not check:

1. **Command variable syntax.** `audit-prime.md` reads workflow inputs as `$INPUTS.<name>`
   and `audit-synthesize.md` reads `$INPUTS.missing_lenses`. Compare with an existing
   `commands/*.md` and adjust.
2. **Coverage via `archon-validate`.** The `baseline` node passes coverage intent as
   validate's free-text `scope`. Validate's discovery step is an agent, so confirm it
   picks up the project's coverage command; otherwise the coverage lens reports what
   the logs contain.
3. **Checkout hygiene.** The baseline runs before the lenses because a test run can
   write to the checkout, and the lenses declare it unchanged.
4. **Fixtures.** Not authored, since the format was not visible. Cases the fixture
   suite should cover:
   - `shape-gate`: unknown shape, agent not found, declared/resolved mismatch, and both
     accepted shapes (`concurrent` true for `parallel`, false for `handoff`).
   - `lens-check`: all present, one empty, one missing.
   - `verdict`: clean READY; each floor rule alone; `handoff` ignoring unsafe state;
     baseline skipped; a non-READY verdict with no prerequisites refused; malformed
     bindings refused.
