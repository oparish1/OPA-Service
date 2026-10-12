---
name: figma-driven-ui-ux
description: Implements frontend code strictly from an approved high-fidelity Figma prototype and its linked design system, instead of letting the agent invent UI/UX. Use when a user asks to build a frontend from Figma, implement a design, connect Figma to Claude, or match an approved design system rather than agent-styled UI.
---

# Figma-Driven UI/UX Implementation

## Objective

Left to a text description alone, a coding agent fills every unstated visual
detail — spacing, color, component choice, empty/error states — with its own
defaults, which drifts from whatever a designer and stakeholders approved.
This skill inverts that: the Figma high-fidelity prototype and its linked
design system are the **only** source of visual and interaction truth. Read
that source faithfully and implement it exactly. Ask the user before
implementing anything the source doesn't specify — never quietly invent a
plausible substitute and mention it afterward.

**Hard rule, applies throughout:** when the Figma frame or design system is
missing, ambiguous, silent on something, or contradicts the existing
codebase, stop and ask the user a direct question rather than choosing a
default or a "reasonable" interpretation. Flagging a guess after implementing
it is not a substitute for asking first. The only exception is trivial,
non-visual clarification (e.g. a file-naming convention already evident from
the codebase) — anything touching layout, states, interaction, content, or
design-system component choice is never assumed.

## Process

Full step-by-step instructions, including the connector setup flow, the
design-system audit checklist, and the verification-report template, are in
[references/procedure.md](references/procedure.md). Read it before starting
work. In outline:

0. **Prime the codebase** (reuse `prime-codebase`), then confirm a UI is
   actually warranted and that an approved high-fidelity design exists.
1. **Establish the Figma connection** (connector or MCP server).
2. **Load and audit** the design system and target frame before writing any
   code — enumerate screens/states, map every element to a design-system
   component, and confirm the plan with the user.
3. **Generate code** faithfully from that mapping, asking a specific question
   before filling any gap rather than guessing.
4. **Test the integration** end-to-end against the real backend, extending
   the project's existing e2e framework if one exists.
5. **Produce a design-fidelity verification report** (template in
   references/procedure.md) documenting what was built, every question asked
   and answered, and any elements not mapped to the design system.

## Output location

This skill does not write to a fixed path. Ask the caller (or infer from an
explicit workflow argument) for the output directory before persisting
anything to disk:

- If invoked inside a workflow that supplies an artifacts directory, write
  generated report/spec files there.
- Otherwise, ask the user where they want persisted artifacts (report,
  specs) saved, or default to printing the report inline in the response
  instead of writing a file.
- Frontend code always goes into the existing codebase's normal source
  tree (identified during priming), never into an output/artifacts
  directory.

## Output

Deliver, in this order: the implemented frontend code; Playwright test
coverage for the implemented flow; the Design-Fidelity Verification Report;
and a short summary leading with any questions asked and answered, plus any
that remain open. See references/procedure.md for the full report template
and delivery checklist.
