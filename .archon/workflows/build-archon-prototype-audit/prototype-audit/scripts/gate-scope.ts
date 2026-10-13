/**
 * The scope gate: prime-scope asked whether the audit's target, deployment
 * context and risk tolerance are all resolved, before either audit lens
 * spends anything reading the codebase against them.
 *
 * Same shape as archon-deliver's gate-ready.ts/gate-green.ts and
 * archon-ship-figma's gate-design.ts: a deterministic join on a verdict the
 * producing node already certified, not a re-judgment. It passes on
 * scope_resolved:true and refuses on everything else, naming exactly what
 * remains unanswered so a person can resolve it — in the issue, the repo's
 * own docs, or by rerunning with an explicit path_glob — and rerun. That is
 * the same recovery path this pack's own triage BLOCKED and plan
 * ready:false already use elsewhere: an honest "not yet" beats a confident
 * guess about which code matters or how much risk tolerance this prototype
 * actually has.
 *
 * Bound inputs (`with:` bindings, canonical text/JSON in env):
 * - INPUTS_SCOPE_RESOLVED: prime-scope's certified boolean, canonical text.
 * - INPUTS_OPEN_QUESTIONS: prime-scope's certified array, bound with `from:`
 *   and arriving as canonical JSON text — the same binding shape
 *   archon-triage uses for its `blocked_by` array.
 * - INPUTS_SUMMARY: prime-scope's summary, read back into the refusal so the
 *   operator does not have to open scope.md just to see why this stopped.
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
    'refusing to spend on either audit lens: this prototype\'s scope, ' +
      'deployment context, or risk tolerance is not yet resolved.',
    summary ? `prime-scope's summary: ${summary}` : '',
    openQuestions.length
      ? 'Open questions (answer these, or rerun with an explicit path_glob, then rerun):\n' +
        openQuestions.map(q => `- ${String(q)}`).join('\n')
      : '',
  ].filter(Boolean);
  refuse(sections.join('\n\n'));
}
