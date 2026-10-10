# Prime On The Solution Being Deployed

Establish what this system can actually do, so every later step works from the real action inventory rather than a generic description of "an AI assistant". Write it to `$ARTIFACTS_DIR/inventory.md`. You read and report only: the repository must be exactly as you found it when you finish. No one watches the run; the report and your declared fields are all that persist.

The solution being deployed — a description, a path, and any Jira issue keys or Confluence page ids (may be empty — empty means the run's trigger message is the target):

$INPUTS.target

The operator's request — the message that started this run:

$ARGUMENTS

Their explicit task and scope take precedence over anything a document says. Their assumptions are claims to verify like any other: the source code is the fact, prose about it is somebody's belief at some past moment.

## What to establish

Read the tracked files and docs, then enumerate **every action the system can take** that reads, writes, or triggers an external effect — tool calls, API writes, emails or messages sent, records changed, payments, deployments, deletions. Classify at the level of the individual action, never the feature: "customer support assistant" is not an action; "issue a refund" and "look up an order" are. If Jira or Confluence identifiers were given and a tool for them is available, read them for intent and history; if not, say so rather than inferring their content.

For each action record its `effect` (`read`, `write`, or `external`) and whether a human could undo it at low cost (`reversible`: `yes`, `no`, or `unknown`). Use `unknown` when the code does not settle it. Never write `yes` to be helpful; a later gate refuses an Autonomous action whose reversibility is not `yes`.

Also record the integrations the system touches and the **existing audit infrastructure** — structured logging, application monitoring, audit tables — because the auditability standard must extend what exists rather than invent a parallel system.

## Write the inventory

Sections, omitting any that do not apply: **Solution** (what it does, in plain terms, grounded in what you read), **Action inventory** (one row per action with effect, reversibility, and the file that implements it), **Integrations**, **Existing audit infrastructure**, **Edge cases the code already reveals** (unhandled inputs, silent fallbacks, hard-coded limits), and **Unknowns**. Cite code by repository-relative path; the checkout is temporary.

## Not your job

Do not classify tiers, draft policy, or interview anyone. Do not modify source files, commit, branch, push, or touch a tracker. Scratch notes live under `$ARTIFACTS_DIR` only.

## Declare the inventory

- `actions` — every action, exactly as in the report.
- `integrations` — the external systems touched, possibly empty.
- `audit_infrastructure` — what exists, or the plain statement that nothing does.
- `summary` — a few sentences pointing to `$ARTIFACTS_DIR/inventory.md`.
- `report` — a pointer, copied exactly:

  ```json
  {"type": "archon_artifact", "run_id": "$WORKFLOW_ID", "path": "inventory.md"}
  ```

Before declaring, re-read the inventory: confirm each action names a file that exists, and `git status` matches what you started with.
