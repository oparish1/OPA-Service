# Training And Onboarding Content

Draft role-based onboarding so a new user can start on day one without either blindly trusting or reflexively distrusting the system. Write it to `$ARTIFACTS_DIR/training.md`. You draft and report only; the repository must be exactly as you found it.

Governing rule: every number, tier assignment and retention window is a commitment someone will be held to. It comes from the stakeholder answers, never from what sounds reasonable for a system like this. Where the answers do not supply one, emit the commitment with `source: "unresolved"` and an empty `value` and say in the report exactly which question would resolve it. A plausible fill-in is the failure this workflow exists to prevent; the run refuses it at the verdict boundary.

Read `references/training-enablement.md` in this pack first. Then read `$ARTIFACTS_DIR/inventory.md`, `$ARTIFACTS_DIR/authority.md` and the stakeholder answers file `$INPUTS.answers`.

The operator's request:

$ARGUMENTS

## What to write

At least two tracks — end users and approvers/reviewers — plus a champions/admin track when the answers name that layer. Each covers: capabilities and limitations in plain language, drawn from the real action inventory ("can draft and send X; cannot do Y without your approval"), never a generic "AI can make mistakes"; the known edge cases, taken from the edge cases the code already revealed — if none are known, say so and commit to updating the section from the feedback loop; a walkthrough of the **actual** override and rollback controls, step by step, naming the interface the tooling answers describe; and a short "when in doubt" rule, which usually means escalate. If the controls do not exist yet, say so in the report and mark the walkthrough as depending on them; never describe a button you have not seen.

## Commitments

A response time or override window quoted to users is a commitment. Emit any you use as `window` commitments, sourced or unresolved as the authority step does. Content that quotes no number needs none.

Declare `commitments`, `summary` and `report`:

```json
{"type": "archon_artifact", "run_id": "$WORKFLOW_ID", "path": "training.md"}
```

Before declaring, re-read the report: every capability and edge case traces to the inventory and `git status` matches what you started with.
