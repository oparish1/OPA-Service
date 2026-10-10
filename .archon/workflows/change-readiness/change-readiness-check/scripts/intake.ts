/**
 * Report which interview dimensions the stakeholder has answered.
 *
 * Deterministic on purpose: whether an answer exists is not a judgment. A missing
 * business owner or stakes answer blocks the run (state `blocked`) because no
 * accountable party or authority tier can be committed without them; any other gap
 * is carried forward as unresolved and never defaulted. The questionnaire it writes
 * is what the pause message points the operator at.
 */

import { writeFileSync } from 'node:fs';
import { artifactsDir, emit, trimmed } from '../../.shared/io.ts';
import { BLOCKING, DIMENSIONS, readAnswers } from '../../.shared/answers.ts';

const QUESTION: Record<string, string> = {
  business_owner: 'Who is the business owner (name/title), and who are the AI/system owner and compliance/legal contacts?',
  end_users: 'Who are the end users and the approvers/reviewers, by role and headcount?',
  stakes: 'What is the worst realistic outcome of a wrong action, and which actions cannot be undone? Give numbers (money, records, customers).',
  regulatory: 'Which regulations or retention rules apply, with the required retention window if one exists?',
  rollout: 'What is the rollout scope, timeline and pilot size?',
  tooling: 'Where do reviewers already work (inbox, Slack, queue, dashboard) and what logging/monitoring exists?',
};

const { answered, unresolved } = readAnswers(trimmed(process.env.INPUTS_ANSWERS));
const blocking = unresolved.filter((d) => (BLOCKING as readonly string[]).includes(d));

writeFileSync(
  `${artifactsDir()}/questionnaire.md`,
  ['# Stakeholder questionnaire', '', ...DIMENSIONS.filter((d) => unresolved.includes(d)).flatMap((d) => [`## ${d}`, QUESTION[d] ?? '', ''])].join('\n'),
);

emit({
  state: blocking.length > 0 ? 'blocked' : 'answered',
  blocking: blocking.join(', '),
  answered,
  unresolved,
});
