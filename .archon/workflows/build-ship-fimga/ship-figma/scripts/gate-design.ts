/**
 * The design gate: figma-ground asked whether this work's UI surface is fully
 * accounted for by the approved Figma prototype and its design system, before
 * delivery can spend anything implementing it.
 *
 * Same shape as archon-deliver's gate-ready.ts and gate-green.ts: a
 * deterministic join on a verdict the producing node already certified, not a
 * re-judgment. It passes on either fact figma-ground itself declared — no UI
 * surface is in scope (`ui_required: false`), or every element in scope mapped
 * with nothing left open (`grounded: true`) — and refuses on everything else,
 * naming exactly what remains unanswered so a person can resolve it at the
 * source (the Figma frame, or the design system) and rerun. That is the same
 * recovery path this pack's own triage BLOCKED and plan ready:false already
 * use: an honest "not yet" beats a confident guess.
 *
 * Bound inputs (`with:` bindings, canonical text/JSON in env):
 * - INPUTS_UI_REQUIRED / INPUTS_GROUNDED: figma-ground's two certified
 *   booleans, canonical boolean text.
 * - INPUTS_OPEN_QUESTIONS / INPUTS_UNMAPPED_ELEMENTS: figma-ground's certified
 *   arrays, bound with `from:` and arriving as canonical JSON text — the same
 *   binding shape archon-triage uses for its `blocked_by` array.
 * - INPUTS_SUMMARY: figma-ground's summary, read back into the refusal so the
 *   operator does not have to open design-brief.md just to see why this
 *   stopped.
 */

import { emit, refuse, trimmed } from '../../.shared/io.ts';

const uiRequired = trimmed(process.env.INPUTS_UI_REQUIRED);
const grounded = trimmed(process.env.INPUTS_GROUNDED);
const summary = trimmed(process.env.INPUTS_SUMMARY);

function parsedArray(raw: string | undefined): unknown[] {
  try {
    const value = JSON.parse(raw ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function describe(entry: unknown): string {
  if (entry && typeof entry === 'object' && 'element' in entry && 'question' in entry) {
    const { element, question } = entry as { element: unknown; question: unknown };
    return `${String(element)} — ${String(question)}`;
  }
  return String(entry);
}

const openQuestions = parsedArray(process.env.INPUTS_OPEN_QUESTIONS);
const unmappedElements = parsedArray(process.env.INPUTS_UNMAPPED_ELEMENTS);

if (uiRequired === 'false') {
  // No UI surface in scope: nothing for this gate to hold, whatever grounded
  // says. figma-ground declares grounded:true trivially in this case too, but
  // this branch does not depend on that agreement holding.
  emit({ gate: 'design' });
} else if (grounded === 'true') {
  emit({ gate: 'design' });
} else {
  const sections = [
    'refusing to spend on delivery: this work needs a UI and figma-ground could ' +
      'not fully ground it against the approved Figma prototype and design system.',
    summary ? `figma-ground's summary: ${summary}` : '',
    openQuestions.length
      ? 'Open questions (answer these, or resolve them in Figma, then rerun):\n' +
        openQuestions.map(q => `- ${String(q)}`).join('\n')
      : '',
    unmappedElements.length
      ? 'Unmapped elements (map each to a design-system component, or add one, then rerun):\n' +
        unmappedElements.map(u => `- ${describe(u)}`).join('\n')
      : '',
  ].filter(Boolean);
  refuse(sections.join('\n\n'));
}
