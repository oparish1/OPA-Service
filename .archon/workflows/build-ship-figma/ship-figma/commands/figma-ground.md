# Ground the UI Against Figma

Ground this work's visual and interaction surface against the approved Figma high-fidelity prototype and its linked design system, before delivery spends anything building it. You read Figma and this repository; you change nothing in either. No one watches the run; the design brief and your declared fields are the only things that persist.

This procedure is adapted from the repository's `figma-driven-ui-ux` skill for a run nobody is watching: where that skill stops to ask you a question in conversation, you instead record the question and declare `grounded: false` — an honest "not yet grounded" that stops delivery until a person answers it, the same shape `archon-triage` uses for `BLOCKED` and `archon-plan` uses for `ready: false`. Never fill a gap with a plausible guess and note it afterward; recording the exact open question is the entire point of this node.

## What is being built

Read `$ARTIFACTS_DIR/triage.md` first. When `$ARTIFACTS_DIR/plan.md` or `$ARTIFACTS_DIR/investigation.md` exists, read it too — together they are the accepted work order this brief must cover.

## The Figma source

Frame (may be empty):

$INPUTS.figma_frame

Design system, when it lives apart from the frame (may be empty):

$INPUTS.design_system

## Step 1: Is a UI actually in scope?

Required if the work order describes something end-users manually initiate, needs human-in-the-loop approval or input, presents results visually, or needs a monitoring or configuration interface. Not required if it's a fully automated background process, triggered by system events or schedules, or its results are consumed API-to-API by other systems with no human-facing surface.

Declare `ui_required`. If false, this node has nothing to ground: declare `grounded: true` trivially, leave `figma_frame`, `design_system`, `screens`, `component_mapping`, and `unmapped_elements` as empty arrays or `null` per their schema, leave `open_questions` empty, write a one-line summary saying why no UI is in scope, write the design brief's Source section noting "No UI surface — Figma was not consulted," and stop. Do not attempt to connect to Figma.

## Step 2: Confirm the Figma connection

If `ui_required` is true, confirm you have a working Figma connection among your available tools. If not, declare `grounded: false`, add exactly this to `open_questions`: "No Figma connection is available; connect the Figma MCP server (see the pack's README) and rerun." — and stop. Do not guess at what an unreachable design would say.

## Step 3: Confirm an approved high-fidelity frame exists

If `$INPUTS.figma_frame` is empty, declare `grounded: false`, add "No Figma frame was supplied for this work; provide the approved high-fidelity frame URL as `figma_frame` and rerun." to `open_questions`, and stop.

Otherwise, load the frame and judge by inspection whether it is a high-fidelity, near-final prototype — real component instances, real copy, every relevant state actually drawn — rather than a wireframe, a sketch, or a low-fidelity mock. If it reads as low-fidelity or clearly unapproved, declare `grounded: false` and add a specific question naming what is missing, for example: "The supplied frame appears to be a low-fidelity wireframe, not an approved high-fidelity prototype; supply the approved version, or explicitly confirm in the issue that delivery should proceed against this wireframe and accept that every gap below will be asked as a question rather than assumed."

## Step 4: Load the design system

Before reading the target frame, load the design system: the shared component library the frame draws from — its components, variants, and tokens (color, spacing, typography scale). Use `$INPUTS.design_system` when given; otherwise use the library the frame itself links to. Confirm you can enumerate its actual components and variants rather than proceeding from a partial or assumed read. If no design system can be found at all — the frame uses only local, one-off styles — declare `grounded: false` and add "No linked design system was found for this frame; supply `design_system`, or confirm the frame is meant to define its own one-off styles for this work." to `open_questions`.

Also load every additional Figma node URL given in `design_system` or named in the work item (for example a States and New Components node), and treat the components and states it defines as part of the design system. Confirm you fetched each such node before declaring grounded.

Also read `.archon/design-decisions.md` in this repository. Every decision there is an approved answer: treat any question it answers as resolved and do not re-ask it. Elements it lists as local-implementation components are mapped: record them in component_mapping as "Local: <name>" and never in unmapped_elements. Add to open_questions only gaps that this file and the Figma sources leave genuinely unanswered.

## Step 5: Load and audit the target frame

Fetch the specific frame(s) for the screen(s) in scope. Enumerate every distinct screen and state it shows plainly — default, loading or in-progress, error, empty, and any validation states on inputs — into `screens`. A frame that shows these states is specifying required behavior, not decoration; do not summarize loosely or collapse states together.

## Step 6: Map every element

For every UI element in the frame, identify the design-system component and variant it corresponds to, and record it in `component_mapping`. When an element does not clearly map to an existing design-system component or variant, do not approximate with the nearest one and do not invent a one-off style yourself — add it to `unmapped_elements` with the specific question that would resolve it: which existing component to use instead, whether it should become a new addition to the design system, or whether it is a deliberate one-off exception.

## Step 7: Surface every remaining gap

Note anything the frame or design system leaves ambiguous or silent that a builder would otherwise have to invent: an interaction detail, responsive or breakpoint behavior, an edge-case state the frame does not show (a zero-results state, for instance), or which backend endpoint a given screen should call. For each, write a specific, directly answerable question into `open_questions` — "the frame doesn't show a zero-results state for the group list — what should it show?" rather than a vague flag.

## Declare `grounded`

`grounded` is true only when `ui_required` is true, `unmapped_elements` is empty, and `open_questions` is empty. Otherwise false. This mirrors `rooted` on an investigation and `ready` on a plan elsewhere in this pack: a false here is a valid, honest completion, not a failure, and a caller gates on it deterministically rather than reading prose.

## Write the design brief

Write `$ARTIFACTS_DIR/design-brief.md`. Title it `# Design brief: <the work in a few words>`. Sections:

- **Source** — the frame's URL and node id, the design system's URL, or the Step 1/6 note when there is no UI surface.
- **Screens & states** — the enumeration from Step 5.
- **Component mapping** — a table: element, design-system component, variant, and any notes a builder needs (states a variant covers, content constraints).
- **Data implied per screen** — the fields, types, and states each screen's components imply, read from what the frame actually shows.
- **Component hierarchy** — a proposed breakdown of what should become a reusable component versus a page-level composition, consistent with the conventions already in this repository.
- **Open questions** — the list from Step 7, verbatim.
- **Unmapped elements** — the list from Step 6, verbatim.

## Declare

- `ui_required` — boolean, from Step 1.
- `grounded` — boolean, from the rule above.
- `figma_frame` — `{ url, node_id }` for the frame actually used, or `null` when no UI is in scope.
- `design_system` — `{ url }` for the library actually used, or `null` when none was found or none applies.
- `screens` — the Step 5 enumeration.
- `component_mapping` — the Step 6 mapping.
- `unmapped_elements` — the Step 6 list, each with its question.
- `open_questions` — the Step 7 list, plus anything Steps 2–4 added.
- `summary` — a few sentences a person reads first: whether this is grounded, and if not, the single most important open question.
- `report` — the pointer to `design-brief.md`.
