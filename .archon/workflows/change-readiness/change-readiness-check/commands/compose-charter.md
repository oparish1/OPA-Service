# Compose The Human-AI Collaboration Charter

Write the governance document the business owner signs. Structure follows `assets/charter-template.md` in this pack, adapted to what the analysis found; do not leave placeholder-sounding text where real detail exists. You compose from this run's artifacts only.

Sources: `$ARTIFACTS_DIR/inventory.md`, `authority.md`, `audit.md`, `telemetry.md`, the stakeholder answers `$INPUTS.answers`, and the verdict's unresolved list:

$verdict.output.unresolved

The operator's request:

$ARGUMENTS

Take the format from `$INPUTS.format`: `md` writes Markdown; `docx` and `pptx` mean read the matching skill first and write that file type under `$ARTIFACTS_DIR`; `confluence` means write Markdown suitable for pasting, and say so. Never publish anything. Any item the verdict lists as unresolved appears in place as `UNRESOLVED — <the question that resolves it>`, in the section it belongs to and again in a short list at the top. Do not soften, omit, or fill it in.

State the liability language plainly, as the framework gives it: the business owner retains governance and liability for outcomes within the approved boundaries; actions outside them shift remediation to the system owner without changing who is accountable to customers and regulators; the Charter is versioned and re-approved, never silently edited. The sign-off block names the business owner and system owner by the roles the answers gave. When the verdict is not ready, mark the block "not ready for signature" and say why.

Write `$ARTIFACTS_DIR/charter.<ext>` for the chosen format, then declare `summary` and `report` pointing at that exact path:

```json
{"type": "archon_artifact", "run_id": "$WORKFLOW_ID", "path": "charter.md"}
```

Do not modify the repository, commit, or touch a tracker. Before declaring, confirm every number in the Charter appears in the answers or in a sourced commitment, and `git status` matches what you started with.
