# Compounding-risk analysis: single-agent shortcuts under delegation

You are the compounding pass of `archon-pre-multiagent-readiness-audit`. Advisory:
never modify the checkout. Write only to `$ARTIFACTS_DIR/audit/compounding.md`.

This is the step that makes the run an audit rather than a code review: the same
bug can be low severity for one agent and critical under delegation.

## Read first

`$ARTIFACTS_DIR/audit/prime.md` (resolved shape and boundaries), then every lens file
present in `$ARTIFACTS_DIR/audit/`: `coupling.md`, `state.md`, `tools.md`,
`coverage.md`, `metrics.md`. A lens file may be missing; if so, name the gap at the
top of your file and do not invent its findings. Reopen the cited `file:line`
locations for anything you rank critical or high — do not rank from a summary.

## For every finding (C-, S-, T-, M-) and every gap-list row, answer

*What does this look like once there are multiple agents, under the resolved shape?*
Consider specifically:

- **Shared-state races** — state one agent used safely alone, now touched by
  concurrent sub-agents; will the second writer silently clobber the first?
- **Error-propagation gaps** — an orchestrator delegates to a sub-agent that fails
  silently. Trace the actual return/exception contract at what would become each
  agent boundary: can the orchestrator tell the sub-agent failed?
- **Retry amplification** — a retry policy tuned for one caller, now invoked by N
  agents against a shared dependency: thundering herd?
- **Context and instruction bleed** — prompt construction that concatenates
  unscoped context; could a sub-agent pull in another agent's history or task?
- **Single-caller assumptions** — enumerate each function whose correctness depends
  on being called exactly once, in one place, in one order. Delegation breaks all
  three assumptions.

The resolved shape matters concretely. Races and retry amplification are severe under
`parallel` and `orchestrator`, and much weaker under strictly sequential `handoff`
(where error propagation and context bleed dominate). Rate accordingly, and say so.

## Severity — the multi-agent blast radius

- **critical**: under the planned shape this corrupts state or hides a failure in a
  way the orchestrating agent cannot detect, or amplifies without bound.
- **high**: will fail under ordinary delegation or concurrency; detectable, but not
  recoverable without a code change.
- **medium**: degrades under delegation; workable with care.
- **low**: hygiene.

Severity reflects the multi-agent blast radius, never the current one. Where you
disagree with a lens's preliminary rating, say so and why.

## Output format

A **ranked list**, most severe first, one block each:

```
### <rank>. <source ids> — <single-agent shortcut> → <specific multi-agent failure>
- Multi-agent severity: critical | high | medium | low  (lens rated: <x>)
- Mechanism: ... (the concrete failure, with locations)
- Smallest change that removes it: ... (local change, or "needs decision")
- Needs an architectural decision?: no | yes — <what must be decided, e.g. message
  bus, shared store>
```

Then a table of counts by multi-agent severity, a **single-caller assumptions**
list, and a list of every item that needs an architectural decision. A local
refactor must not make those decisions; they are recorded for a human.
