# Prime the Codebase and Resolve the Audit's Scope

Ground this audit in the actual codebase before either lens starts, and resolve exactly what they should audit and against what standard. No one watches this run. Where the source skill this workflow is built from would ask you a question in conversation, you instead record it as an open question and declare `scope_resolved: false` — an honest "not yet resolved" that stops the run here, the same shape `archon-triage`'s `BLOCKED` uses elsewhere in this pack. Never guess at deployment context, risk tolerance, or which code is the core path and proceed anyway.

## Step 1: Prime

Run `/prime-codebase` (or reuse its output if this session already primed this repository and nothing material has changed since). Forward these if given:

- Jira issue keys: $INPUTS.jira_issue_keys
- Confluence page ids: $INPUTS.confluence_page_ids

Follow `/prime-codebase`'s own Step 0 to load that context first when either is given, then its Steps 1–4 in full: project structure, core docs, key files, current state.

## Step 2: Resolve what to audit

If `$INPUTS.path_glob` is given, scope to that subtree and record it as `core_paths`. Otherwise, from what priming found, identify the core execution path — the main entry point, the orchestration or agent loop, and anything priming flagged as central — and record that as `core_paths`; record what you're deliberately excluding (vendored code, generated code, clearly peripheral subsystems) as `excluded`.

If priming leaves the core execution path genuinely ambiguous — several plausible entry points, no clear boundary between prototype code and vendored or generated code — do not guess. Add a specific question to `open_questions`, for example: "This repository has two plausible entry points, `src/cli.py` and `src/server.py` — which is the prototype's actual core path to audit?"

## Step 3: Resolve deployment context and risk tolerance

This materially changes what counts as a Release Blocker later, so get it right rather than assumed. Check first whether it's already stated or obvious from the codebase (README, domain, existing compliance code, an internal-tools marker, handling of payment or health data). If it is, record it as `deployment_context` and `risk_tolerance` with a one-line citation of where you found it.

If it is not evident, add a specific question to `open_questions` rather than assuming either the more conservative or the more permissive reading, for example: "Is this prototype an internal demo, something that will handle real user data, or something financial/medical/safety-relevant? That changes what this audit should treat as a release blocker."

## Declare `scope_resolved`

True only when `core_paths` is non-ambiguous and both `deployment_context` and `risk_tolerance` are known or well-evidenced — i.e. `open_questions` is empty. Otherwise false.

## Write the scope note

Write `$ARTIFACTS_DIR/scope.md`:

```markdown
# Prototype audit scope

## Core execution path
[core_paths, with a one-line reason each]

## Excluded
[excluded, with a one-line reason each]

## Deployment context
[deployment_context, and how it was determined]

## Risk tolerance
[risk_tolerance, and how it was determined]

## Open questions
[open_questions verbatim, or "None."]
```

## Declare

- `scope_resolved`, `core_paths`, `excluded`, `deployment_context`, `risk_tolerance`, `open_questions` — as above.
- `summary` — a few sentences: what will be audited, and if not yet resolved, the single most important open question.
- `report` — the pointer to `scope.md`.
