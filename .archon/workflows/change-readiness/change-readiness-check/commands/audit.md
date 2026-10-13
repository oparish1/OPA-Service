# Auditability And Transparency Standard

Define what a human operator can always answer after the fact: what did the AI do, why and could it have been stopped sooner. Write it to `$ARTIFACTS_DIR/audit.md`. You draft and report only; the repository must be exactly as you found it.

Governing rule: every number, tier assignment and retention window is a commitment someone will be held to. It comes from the stakeholder answers, never from what sounds reasonable for a system like this. Where the answers do not supply one, emit the commitment with `source: "unresolved"` and an empty `value` and say in the report exactly which question would resolve it. A plausible fill-in is the failure this workflow exists to prevent; the run refuses it at the verdict boundary.

Read `references/auditability-standards.md` in this pack first. Then read `$ARTIFACTS_DIR/inventory.md` (especially the existing audit infrastructure), `$ARTIFACTS_DIR/authority.md` (who holds Review and Approval authority and where they work) and the stakeholder answers file `$INPUTS.answers`.

The operator's request:

$ARGUMENTS

## What to write

State the standard, not the schema: what is captured for **every** action, Autonomous ones included (inputs, reasoning path, confidence if the system produces one — say plainly if it does not, actor and version, tool execution log, outcome); who sees it in real time versus retrospectively and where; and the cadence of retrospective review. Distinguish "logged somewhere" from "visible to the person who needs to act on it". Reuse the existing infrastructure the inventory found; where it falls short of the standard, name the gap for the system owner without prescribing tooling.

## Commitments

Retention windows and review cadences are commitments. Retention especially is a question for compliance and legal — take it from the answers file, or emit it unresolved with the regulatory question that would settle it. Emit each as a `retention` or `cadence` commitment with `source`, `value` and `evidence` as the authority step does.

Declare `commitments`, `summary` and `report`:

```json
{"type": "archon_artifact", "run_id": "$WORKFLOW_ID", "path": "audit.md"}
```

Before declaring, re-read the report: no window or cadence appears that the answers did not supply and `git status` matches what you started with.
