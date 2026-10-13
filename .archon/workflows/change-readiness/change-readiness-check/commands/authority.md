# Decision Authority, Hand-offs and Accountability

Classify every action into Autonomous, Human Review, or Human Approval with thresholds a person can test, define the hand-off at each boundary and map who is accountable. Write it to `$ARTIFACTS_DIR/authority.md`. You draft and report only; the repository must be exactly as you found it.

Governing rule: every number, tier assignment and retention window is a commitment someone will be held to. It comes from the stakeholder answers, never from what sounds reasonable for a system like this. Where the answers do not supply one, emit the commitment with `source: "unresolved"` and an empty `value` and say in the report exactly which question would resolve it. A plausible fill-in is the failure this workflow exists to prevent; the run refuses it at the verdict boundary.

Read `references/hitl-decision-framework.md` in this pack before you begin; it defines the tiers, the dimensions that set them, the hand-off protocol and the RACI.

Inputs, in order of authority:

- The stakeholder answers file: `$INPUTS.answers`. This is the only source of thresholds, tiers, dollar amounts, windows and named roles.
- The action inventory: `$ARTIFACTS_DIR/inventory.md`. Read it in full.
- `$ARTIFACTS_DIR/questionnaire.md`, if present, lists what is still unanswered.

The operator's request:

$ARGUMENTS

## Tiers

Classify **each action** from the inventory. Let reversibility, blast radius, financial or legal exposure, data sensitivity and model confidence set the tier — do not assign the tier first and rationalize thresholds after. An action that is irreversible, or not known to be reversible, is never Autonomous. Write each rule as a concrete test ("refunds under the stated amount are Review; at or above it, Approval"), using only figures the stakeholder gave. If the stakeholder gave none, the tier is unresolved; you may state what the framework would suggest in the report, clearly labelled as a suggestion and never as the commitment.

## Hand-offs

For each tier boundary: what the human sees, where it appears (match the tooling the answers name; do not invent a new surface), what happens if nobody responds and whether the decision can be delegated or re-escalated. A window or expiry that the stakeholder did not give is an unresolved `window` commitment.

## Accountability

Build the RACI for routine operation and incident response. Every decision and incident scenario has **exactly one Accountable party, named by role or title** and it is never the system. If the business owner and system owner are the same person, say so rather than leaving a row blank. Use the roles the answers name; if the answers name none, that is unresolved.

## Declare the commitments

Emit one commitment per decision you made or could not make:

- `kind` — `tier` (`subject` is the action's exact name from the inventory, `value` is `autonomous`, `review`, or `approval`), `threshold` (a number or rule), `window` (a response or override window), or `accountable` (`subject` is the decision or incident scenario, `value` the one accountable role).
- `source` — `stakeholder` only when the answers file states it; then `evidence` quotes or cites the answer it came from. Otherwise `unresolved`, `value` empty and `evidence` says which question resolves it.

Every action in the inventory needs a `tier` commitment, resolved or not.

- `summary` — a few sentences pointing to `$ARTIFACTS_DIR/authority.md`.
- `report` — a pointer, copied exactly:

  ```json
  {"type": "archon_artifact", "run_id": "$WORKFLOW_ID", "path": "authority.md"}
  ```

Before declaring, re-read the report: confirm no number appears that the answers did not supply and `git status` matches what you started with.
