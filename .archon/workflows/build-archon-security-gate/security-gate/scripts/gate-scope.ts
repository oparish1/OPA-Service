/**
 * The scope gate: prime-scope-security asked whether the review's scope
 * (agentic / non-agentic / both) and multi-tenancy are both resolved, before
 * any of the five audit lenses spend anything reading the codebase against
 * them — both change what counts as a Critical finding downstream.
 *
 * Same shape as archon-deliver's gate-ready.ts/gate-green.ts,
 * archon-ship-figma's gate-design.ts and archon-prototype-audit's
 * gate-scope.ts: a deterministic join on a verdict the producing node
 * already certified, not a re-judgment. It passes on scope_resolved:true and
 * refuses on everything else, naming exactly what remains unanswered so a
 * person can resolve it and rerun — the same recovery path this pack's own
 * triage BLOCKED already uses elsewhere: an honest "not yet" beats a
 * confident guess about scope or tenancy on a security gate.
 *
 * Bound inputs (`with:` bindings, canonical text/JSON in env):
 * - INPUTS_SCOPE_RESOLVED: prime-scope-security's certified boolean,
 *   canonical text.
 * - INPUTS_OPEN_QUESTIONS: prime-scope-security's certified array, bound
 *   with `from:` and arriving as canonical JSON text — the same binding
 *   shape archon-triage uses for its `blocked_by` array.
 * - INPUTS_SUMMARY: prime-scope-security's summary, read back into the
 *   refusal so the operator does not have to open scope.md just to see why
 *   this stopped.
 */

import { emit, refuse, trimmed } from '../../.shared/io.ts';

const scopeResolved = trimmed(process.env.INPUTS_SCOPE_RESOLVED);
const summary = trimmed(process.env.INPUTS_SUMMARY);

function parsedArray(raw: string | undefined): unknown[] {
  try {
    const value = JSON.parse(raw ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const openQuestions = parsedArray(process.env.INPUTS_OPEN_QUESTIONS);

if (scopeResolved === 'true') {
  emit({ gate: 'scope' });
} else {
  const sections = [
    'refusing to spend on any audit lens: this review\'s scope (agentic / ' +
      'non-agentic / both) or its multi-tenancy is not yet resolved and ' +
      'both change how a Critical finding is scored.',
    summary ? `prime-scope-security's summary: ${summary}` : '',
    openQuestions.length
      ? 'Open questions (answer these, then rerun):\n' +
        openQuestions.map(q => `- ${String(q)}`).join('\n')
      : '',
  ].filter(Boolean);
  refuse(sections.join('\n\n'));
}
