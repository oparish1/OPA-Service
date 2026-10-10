/**
 * The run's one terminal result: whether the deliverables are ready for sign-off.
 * `ready: false` is a valid completion — an honest draft with named gaps — and is
 * reported as such rather than as a failure.
 */

import { emit, text } from '../../.shared/io.ts';

const ready = text(process.env.INPUTS_READY) === 'true';
const open = (JSON.parse(text(process.env.INPUTS_UNRESOLVED)) as string[]).length;

emit({
  ready,
  summary: ready
    ? 'Charter and enablement package are fully sourced and ready for business-owner sign-off.'
    : `Drafts written with ${open} unresolved item(s) marked in place; not ready for sign-off until the stakeholder answers them.`,
});
