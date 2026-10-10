/**
 * Certify the readiness verdict before any document is composed from it.
 *
 * The prompts judge and draft; this boundary verifies what a schema cannot: the
 * relations between fields. Each commitment's shape and its `kind`/`source`
 * vocabularies were certified on the node that produced it, so membership is not
 * re-checked. What remains is the governing rule of the skill — every number, tier
 * and retention window is a commitment someone is held to, so it comes from the
 * stakeholder or stays unresolved:
 *
 *   - a stakeholder-sourced commitment carries a value and the evidence it came from;
 *   - an unresolved one carries no value (a plausible fill-in is the failure);
 *   - every action the system can take is classified, into a known tier;
 *   - no action that is irreversible, or not known to be reversible, is Autonomous;
 *   - each decision has exactly one Accountable role and it is never the system.
 *
 * `ready` means every commitment and every interview dimension is resolved. An
 * honest `ready: false` completes the run; the documents then carry the gaps.
 */

import { emit, refuse, text } from '../../.shared/io.ts';

const TIERS = ['autonomous', 'review', 'approval'];
const SYSTEM_ACTOR = /^(the\s+)?(ai|system|model|agent|assistant|bot)\b/i;

interface Commitment {
  readonly kind: string;
  readonly subject: string;
  readonly value: string;
  readonly source: string;
  readonly evidence: string;
}
interface Action {
  readonly name: string;
  readonly reversible: string;
}

/** A `from:` binding arrives as the producer's JSON, already certified against its schema. */
function bound(value: string | undefined): any {
  return JSON.parse(text(value));
}

const actions: Action[] = bound(process.env.INPUTS_ACTIONS);
const answers: { unresolved: string[] } = bound(process.env.INPUTS_ANSWERS);
const commitments: Commitment[] = [
  ...bound(process.env.INPUTS_AUTHORITY).commitments,
  ...bound(process.env.INPUTS_AUDIT).commitments,
  ...bound(process.env.INPUTS_TRAINING).commitments,
  ...bound(process.env.INPUTS_TELEMETRY).commitments,
];

function check(): string | null {
  for (const c of commitments) {
    const label = `${c.kind} "${c.subject}"`;
    if (c.source === 'unresolved' && c.value.trim() !== '') {
      return `${label} is marked unresolved but carries the value "${c.value}". A value nobody supplied is a guess: clear it, or cite the stakeholder answer it came from.`;
    }
    if (c.source === 'stakeholder' && (c.value.trim() === '' || c.evidence.trim() === '')) {
      return `${label} is sourced from the stakeholder but has no value or no evidence. Cite the answer it came from, or mark it unresolved.`;
    }
  }

  const tiers = commitments.filter((c) => c.kind === 'tier');
  for (const a of actions) {
    const t = tiers.find((c) => c.subject === a.name);
    if (t === undefined) {
      return `Action "${a.name}" from the inventory has no tier. Classify every action, individually; leave the tier unresolved if the stakeholder has not decided.`;
    }
    if (t.source === 'stakeholder' && !TIERS.includes(t.value)) {
      return `Tier for "${a.name}" is "${t.value}"; a tier is one of ${TIERS.join(', ')}.`;
    }
    if (t.value === 'autonomous' && a.reversible !== 'yes') {
      return `"${a.name}" is Autonomous but its reversibility is "${a.reversible}". An action a human cannot undo does not run without one; leave the tier unresolved or raise it.`;
    }
  }

  const seen = new Map<string, string>();
  for (const c of commitments.filter((x) => x.kind === 'accountable')) {
    const prior = seen.get(c.subject);
    if (prior !== undefined && prior !== c.value) {
      return `Decision "${c.subject}" names two Accountable roles ("${prior}", "${c.value}"). Exactly one, by role or title.`;
    }
    seen.set(c.subject, c.value);
    if (SYSTEM_ACTOR.test(c.value.trim())) {
      return `Decision "${c.subject}" makes "${c.value}" accountable. "The system decided" is never an answer to who is responsible.`;
    }
  }
  if (seen.size === 0) return 'No Accountable role is committed for any decision or incident.';
  return null;
}

const problem = check();
if (problem !== null) {
  refuse(`change-readiness verdict: ${problem}`);
} else {
  const open = [
    ...commitments.filter((c) => c.source === 'unresolved').map((c) => `${c.kind}: ${c.subject}`),
    ...answers.unresolved.map((d) => `interview: ${d}`),
  ];
  emit({
    ready: open.length === 0,
    unresolved: open,
    committed: commitments.filter((c) => c.source === 'stakeholder').length,
    summary:
      open.length === 0
        ? 'Every commitment is sourced from the stakeholder.'
        : `${open.length} item(s) still need the stakeholder before sign-off.`,
  });
}
