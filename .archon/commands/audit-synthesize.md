# Synthesize the readiness audit

You are the deciding node of `archon-pre-multiagent-readiness-audit`. Advisory:
never modify the checkout. Write only `$ARTIFACTS_DIR/audit/report-body.md` and
return the structured result.

Start fresh and read everything: `$ARTIFACTS_DIR/audit/prime.md`, then
`coupling.md`, `state.md`, `tools.md`, `coverage.md`, `metrics.md`,
`compounding.md`, plus `$ARTIFACTS_DIR/validation.md` if the baseline ran. Lenses
that failed all their retries are named here: `$INPUTS.missing_lenses` (a JSON
array, possibly empty). For each, the affected section states plainly that it is
incomplete; never fill the gap from your own assumptions.

Verify before you assert: reopen the cited locations behind every critical or high
finding and drop any you cannot reproduce from the code. Counts must reflect what
survives.

## Write `audit/report-body.md`

Use exactly these `##` sections, in this order. **Do not write a
"Readiness Verdict" or "Recommendation" section and do not write a Refactors
section** — the verdict node renders the first two from the final verdict and
refactoring is outside this workflow.

1. `## Structural Stability Metrics` — the table from `metrics.md` and the
   state-isolation totals from `state.md`:

   | Metric | Measured Value | Method / Sample Size | Assessment |
   |---|---|---|---|
   | End-to-end latency (p50/p95) | | | |
   | LLM call vs. tool call vs. overhead split | | | |
   | Context window utilization (avg / peak) | | | |
   | Fixed overhead (system+tools) vs variable context | | | |
   | State isolation: safe / synchronized / unsafe counts | | | |

   Follow with an **Evidence gaps** list: unmeasurable metrics, a missing baseline,
   any missing lens. Nothing is estimated to fill a gap.
2. `## Verified Code Coverage` — the coverage table and gap list from `coverage.md`.
3. `## Findings: Coupling, State & Tool Failure Handling` — findings from the three
   Step 1 lenses, each with `file:line`, why it is tolerable today, why it is
   dangerous under delegation and its **multi-agent** severity from `compounding.md`.
4. `## Findings: Compounding Risk Under Delegation` — the ranked list from
   `compounding.md`: single-agent shortcut → specific multi-agent failure → severity.
5. `## Open Architectural Decisions (not resolved unilaterally)` — every decision a
   local change cannot make. Write "None." if there are none.

## Return

- `project`: the project's name.
- `proposed_verdict`: your own judgement. `READY` only if you would stake the
  architectural decision on it; `READY_WITH_CONDITIONS` if specific things must
  become true first; `NOT_READY` if the shape cannot safely be built on the current
  code. Note that a boundary node will raise your proposal where hard facts require
  it (critical or high findings, unsafe state under a concurrent shape, no green
  baseline, unmeasured metrics, a missing lens) but never lower it.
- `findings`: counts by multi-agent severity, matching section 3 and 4 exactly.
- `unsafe_state`: the `unsafe=` total from `state.md`.
- `untested_high_risk_failure_modes`: gap-list rows rated high or critical.
- `metrics_measured`: the `Metrics measured:` line from `metrics.md`, or `none` if
  that lens is missing.
- `prerequisites`: ordered, most foundational first; each one concrete and
  checkable ("wrap tool X behind an interface that returns a typed error"), not
  "improve error handling". Empty only if you propose `READY`.
- `open_decisions`: the entries from section 5.
- `top_risks`: at most three, each a single sentence.
- `summary`: one to three sentences of rationale.
- `body`: the artifact pointer for `audit/report-body.md`.
