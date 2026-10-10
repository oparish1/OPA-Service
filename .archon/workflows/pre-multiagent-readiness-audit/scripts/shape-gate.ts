/**
 * The audit's one question a run cannot ask: which multi-agent shape is planned.
 *
 * Severity for every lens depends on it — a shared-state race is critical under
 * parallel workers and close to irrelevant under strictly sequential handoffs — so
 * a guessed shape would make the whole fan-out's ratings meaningless. This node
 * refuses instead of guessing, before any lens is paid for.
 *
 * The shape vocabulary is owned by the `enum` on `prime`'s output, where the engine
 * certifies it. Nothing here re-lists it: a declared value the agent could not
 * resolve to itself reaches this node as a mismatch and is refused as one.
 */

import { emit, refuse, trimmed } from '../../.shared/io.ts';

const declared = trimmed(process.env.INPUTS_DECLARED).toLowerCase();
const resolved = trimmed(process.env.INPUTS_RESOLVED);
const agentFound = trimmed(process.env.INPUTS_AGENT_FOUND) === 'true';

if (!agentFound) {
  refuse(
    'No agent execution loop was found in the audited scope, so there is nothing to ' +
      'audit. Point the `scope` input at the directory or entry point of the agent.'
  );
} else if (resolved === 'unknown' || resolved === '') {
  refuse(
    'The planned multi-agent shape is not stated by the `shape` input, the `design` ' +
      "input, or the repository's own documents. Severity depends on it, so the audit " +
      'does not assume one. Re-run with the `shape` input set.'
  );
} else if (declared !== '' && declared !== resolved) {
  refuse(
    `The \`shape\` input was "${declared}" but priming resolved "${resolved}". An ` +
      'input that is not a shape the audit recognizes, or that the design contradicts, ' +
      'is refused rather than reconciled. Correct the input or the design reference.'
  );
} else {
  emit({ shape: resolved, concurrent: resolved !== 'handoff' });
}
