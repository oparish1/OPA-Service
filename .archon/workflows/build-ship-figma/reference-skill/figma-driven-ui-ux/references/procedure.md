# Figma-Driven UI/UX Implementation — Full Procedure

This document is the detailed procedure for the `figma-driven-ui-ux` skill.
Read `SKILL.md` first for the objective and the hard rule on asking rather
than assuming; this file expands each step.

## Step 0: Prime the Codebase

**Always run this step first.** Reuse the `prime-codebase` skill exactly as
documented:

1. If Jira issue keys or Confluence page ids are relevant/available, follow
   `prime-codebase` Step 0 to load that context first.
2. Run `prime-codebase` Steps 1–4 in full: project structure, core docs, key
   files, current state.
3. If the codebase was already primed earlier in this session and nothing
   material changed, reuse that context.

While priming, specifically identify: the frontend framework and component
conventions already in use (so generated components match, rather than
introducing a second styling system alongside an existing one), any existing
design-system integration (a shared component library, Tailwind config,
design tokens file), the routing structure (where new pages/components
should live), and the backend API/webhook endpoints the frontend will need
to call.

## Step 0.5: Confirm UI/UX Is Actually Warranted — and That a Design Already Exists

Before implementing anything, confirm this is the right track for the work:

**Is a UI required at all?**
- Required if: end-users must manually initiate the process, human-in-the-loop
  approval/input is needed, results need visual presentation, or a
  monitoring/configuration interface is needed.
- Not required if: it's a fully automated background process, triggered by
  system events/schedules, or results are consumed API-to-API by other
  systems.
- If the task doesn't clearly need a UI, say so and stop here rather than
  generating frontend code for something that shouldn't have one.

**Does an approved high-fidelity design actually exist?**
- This skill implements an *already-approved* Figma high-fidelity prototype.
  If only paper sketches or a low-fidelity mockup exist, or if a
  high-fidelity prototype exists but hasn't been through stakeholder
  approval, say so explicitly and ask the user whether they want to pause to
  complete that step first, or explicitly authorize proceeding anyway — do
  not default to either path yourself.
- If the user explicitly authorizes proceeding against a lower-fidelity
  input, treat every element the source leaves ambiguous as a required
  question in Step 3, not a place for a more-conservative default — a
  low-fidelity source has more gaps, which means more questions to ask, not
  more latitude to guess.

## Step 1: Establish the Figma Connection

Check whether a working Figma connector is already available in this
session's tool list before setting anything up.

**If not connected**, offer the available options rather than picking one
unilaterally — the user may already have a preferred setup:
- The Figma connector via the connector directory (search and suggest it
  rather than assuming CLI setup — see the MCP App handling below).
- The Figma MCP server via CLI, if the user is working in an environment
  where they run `claude mcp add` directly:
  `claude mcp add --scope user --transport http figma https://mcp.figma.com/mcp`
  (global) or without `--scope user` for project-local.
- Either path requires a Figma API key (Figma → Settings → Security) to
  authorize read access, and the Figma desktop app's MCP server enabled if
  using the local server variant rather than the remote one.

Since Figma is a consumer-style connector, follow the standard connector
flow: search the registry and present it as a suggestion for the user to
connect, rather than connecting on their behalf.

## Step 2: Load the Design System and Target Frame — Audit Before Generating

Once connected, load context in this order, and do not skip the audit step
to jump straight to code generation:

1. **Design system first.** Fetch the design system Figma file/frame (the
   shared component library — variants, variables, styles, tokens) before
   the target screen. Confirm you can enumerate its actual components,
   variants, and design tokens (colors, spacing, typography scale) rather
   than proceeding on an assumed or partial read.
2. **Target frame second.** Fetch the specific high-fidelity frame(s) for the
   screen(s) being implemented.
3. **Audit and map explicitly**, in this order, before writing any code:
   - **Audit**: what screens, states, and components does the frame contain?
     Enumerate them plainly (don't summarize loosely — list every distinct
     screen/state visible: default, loading/agent-status states like
     thinking/working/complete, error states, empty states).
   - **Design system mapping**: for every UI element in the frame, identify
     which design-system component/variant it corresponds to. If an element
     in the frame does not clearly map to an existing design-system
     component, stop and ask the user how it should be handled (a specific
     existing component, a new addition to the design system, or a one-off
     exception) rather than approximating with the nearest available
     component or inventing a one-off style on your own judgment.
   - **Data modeling**: identify what data each screen/component needs
     (fields, types, states) based on what's shown or implied in the frame
     (form inputs, result displays, status indicators).
   - **Component hierarchy**: propose the component breakdown (what becomes
     a reusable component vs. a page-level composition) consistent with the
     conventions found during priming.
   - **Confirm before generating**: present the audit, mapping, data model,
     and hierarchy back to the user (or state them plainly in your response)
     before writing implementation code, so gaps or misreadings are caught
     before code exists rather than after.

## Step 3: Generate Code — Faithfully, Asking Before Filling Any Gap

Implement the components to match the frame and design system as closely as
the available data allows:

- Use only design-system components/tokens identified in Step 2's mapping.
  Do not introduce new colors, spacing values, or one-off components that
  aren't derived from the design system, even if they'd look reasonable —
  reasonable-looking and approved are not the same thing here.
- Implement every state enumerated in the audit: agent status indicators
  (thinking/working/complete), error states, empty states, loading states,
  and validation states on inputs — not just the primary/happy-path screen.
  A frame that shows these states is specifying required behavior, not
  decoration.
- **When the frame is ambiguous or silent on something** (an interaction
  detail, a responsive breakpoint behavior, an edge-case state not shown),
  **stop and ask the user a specific question before implementing that
  part** — do not pick a plausible default and mention it afterward. For
  example, if the frame doesn't show a state for zero results, ask "the
  frame doesn't show a zero-results state — what should this look like?"
  rather than implementing something and asking the user to confirm it after
  the fact. This is the core discipline this skill exists to enforce: silent
  gap-filling followed by a flag is still gap-filling — the question has to
  come first.
- Only proceed on your own judgment for a specific gap if the user is
  unavailable to answer in-session and explicitly tells you to proceed
  anyway — and even then, implement the most minimal, easily-revised
  placeholder possible (not a fully-styled guess) and mark it unmistakably
  as a placeholder in both the code (a comment) and the report, so it can't
  be mistaken for a deliberate design decision later.
- Confirm the exact backend endpoint(s) to wire the UI to before writing the
  integration code — ask if it's not already specified, since this varies
  per project and per environment (local dev vs. deployed) and guessing a
  plausible-looking URL risks silently pointing at the wrong environment.
- Match the existing codebase's component conventions identified during
  priming (file structure, styling approach, state management pattern) so
  the new code integrates rather than sitting apart as a
  differently-structured island.

## Step 4: Frontend Integration Testing

Confirm the implemented frontend is wired correctly to the backend before
treating the work as done:

- Manually exercise the primary flow(s) end-to-end against the specified
  backend endpoint and confirm real request/response behavior (not just
  that the UI renders).
- If the project already has Playwright (or another e2e framework)
  configured, extend or add tests matching its existing patterns (mocked
  backend/API calls, matching whatever mocking convention — e.g. mocked
  Supabase/agent API — is already in place) rather than introducing a
  different testing approach:
  ```bash
  cd frontend
  npx playwright install --with-deps   # if not already installed
  npm run test
  npm run test:ui       # interactive
  npm run test:headed   # see the browser
  npx playwright test --debug
  ```
- Cover at minimum: the primary user workflow, input validation, each
  agent-status/loading state implemented in Step 3, and each error state
  implemented in Step 3 — since these were explicit requirements from the
  audited frame, not optional extras.
- If no e2e framework exists yet and the user wants one introduced, confirm
  that scope explicitly before adding new tooling/dependencies — that's a
  larger decision than implementing the frame.

## Step 5: Design-Fidelity Verification Report

Produce a concise report confirming what was built matches what was
designed. Default to presenting it inline in your response. Only write it to
disk if the user wants a persisted artifact — and in that case, use the
output directory the caller supplied (a workflow's artifacts-directory
argument, or a path/location the user names) rather than assuming a fixed
location; if no output directory has been supplied and the user wants a
file, ask where to save it before writing.

```markdown
# Design-Fidelity Verification Report — [screen/feature name]

## Source
- Figma frame: [link/node-id]
- Design system: [link/name, version if known]

## Implemented
- Screens/states covered: [list — default, loading, error, empty, etc.]
- Design-system components used: [list, with any variant notes]

## Questions Asked & Gaps Resolved
[every place the frame was ambiguous/silent, the specific question asked, and the answer
received — this section should not be empty for anything but a fully-unambiguous,
fully-covered frame. If the user was unavailable and explicitly authorized a placeholder,
record that explicitly, including where the placeholder marker was left in the code.]

## Elements Not Mapped to the Design System
[anything in the frame that didn't clearly correspond to an existing design-system
component, the question asked about it, and how the user decided it should be handled]

## Backend Wiring
- Endpoint(s) connected: [list]
- Confirmed functional end-to-end: [yes/no, and how verified]

## Test Coverage Added
[Playwright specs added/modified, and what states/flows they cover]
```

## Delivery Checklist

Deliver, in this order:

1. The implemented frontend code (components, routes, styles) in the
   codebase.
2. Playwright test coverage (new or extended) for the implemented flow.
3. The Design-Fidelity Verification Report (inline, or written to the
   supplied output directory — see Step 5).
4. A short summary leading with any questions that were asked and answered
   during the work, and any that remain open — these need stakeholder or
   design input before this can be considered a faithful implementation, not
   just a working one.

Never substitute an assumption for asking the user when the frame is
ambiguous or silent on something. If a gap was resolved, it should be
because the user answered a specific question — not because a
plausible-looking default was chosen and mentioned afterward. The report's
entire value is in distinguishing what matches the approved design (or an
explicit user answer) from what the agent decided on its own; a "reasonable
guess" implemented before asking is not a faithful implementation, regardless
of how it's written up afterward.
