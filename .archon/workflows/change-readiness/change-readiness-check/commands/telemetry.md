# Feedback Loops And Adoption Telemetry

Define the adoption and trust signals this organization can actually instrument and the loop that turns them into change. Write it to `$ARTIFACTS_DIR/telemetry.md`. You draft and report only; the repository must be exactly as you found it.

Governing rule: every number, tier assignment and retention window is a commitment someone will be held to. It comes from the stakeholder answers, never from what sounds reasonable for a system like this. Where the answers do not supply one, emit the commitment with `source: "unresolved"` and an empty `value` and say in the report exactly which question would resolve it. A plausible fill-in is the failure this workflow exists to prevent; the run refuses it at the verdict boundary.

Read `references/feedback-telemetry.md` in this pack first. Then read `$ARTIFACTS_DIR/inventory.md` (what is already observable), `$ARTIFACTS_DIR/authority.md` and the stakeholder answers file `$INPUTS.answers`.

The operator's request:

$ARGUMENTS

## What to write

Pick only metrics the existing tooling can measure: override rate (by action and tier), escalation frequency, time-to-first-trust, a recurring pulse survey and incident rate and severity. For each, say where the signal comes from today or what instrumentation the system owner would need to add. Define at least one low-friction in-the-moment feedback channel, who reviews it and how often, what it feeds and how users learn their feedback changed something. State the review cadence for the business and system owners and that the Charter's thresholds are re-approved when the metrics justify it.

## Commitments

Review cadences, survey intervals and any alert threshold are commitments. Emit each as a `cadence` or `threshold` commitment, sourced from the answers or unresolved. Do not invent a target override rate.

Declare `commitments`, `summary` and `report`:

```json
{"type": "archon_artifact", "run_id": "$WORKFLOW_ID", "path": "telemetry.md"}
```

Before declaring, re-read the report: every metric names a real signal source and `git status` matches what you started with.
