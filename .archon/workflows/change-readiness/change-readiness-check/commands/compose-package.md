# Compose The User Adoption Enablement Package

Write the practitioner-facing onboarding document. Structure follows `assets/enablement-package-template.md` in this pack. It is a short, skimmable working reference, not a governance record. You compose from this run's artifacts only.

Sources: `$ARTIFACTS_DIR/inventory.md`, `authority.md`, `training.md`, `telemetry.md`, the stakeholder answers `$INPUTS.answers`, and the verdict's unresolved list:

$verdict.output.unresolved

The operator's request:

$ARGUMENTS

Take the format from `$INPUTS.format`: `md` writes Markdown; `docx` and `pptx` mean read the matching skill first and write that file type under `$ARTIFACTS_DIR`; `confluence` means write Markdown suitable for pasting, and say so. Never publish anything. Any item the verdict lists as unresolved appears in place as `UNRESOLVED — <the question that resolves it>`, in the section it belongs to and again in a short list at the top. Do not soften, omit, or fill it in.

End users get the user-facing version of the tiers without internal threshold numbers; those belong only in the approver and admin tracks. The override walkthrough describes only controls the inventory shows exist. Include the printable quick-reference appendix (sections 1, 3, 4 and 5).

Write `$ARTIFACTS_DIR/enablement-package.<ext>` for the chosen format, then declare `summary` and `report` pointing at that exact path:

```json
{"type": "archon_artifact", "run_id": "$WORKFLOW_ID", "path": "enablement-package.md"}
```

Do not modify the repository, commit, or touch a tracker. Before declaring, confirm nothing quoted to users is a figure the stakeholder did not supply, and `git status` matches what you started with.
