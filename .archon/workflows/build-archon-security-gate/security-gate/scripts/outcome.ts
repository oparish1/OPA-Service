/**
 * One return for every legitimate terminal result of this workflow.
 *
 * `passed` is a deliberate collapse of three states into one bit, for a
 * composing caller that only wants to branch on "does this block
 * deployment": true for PASS and CONDITIONAL_PASS alike, false only for
 * FAIL. CONDITIONAL_PASS is a real, distinct state — "proceed if the named
 * conditions are tracked and enforced" — and collapsing it into `passed`
 * does not discard that distinction, because `summary` always states
 * `gate_decision` in full, plainly and first, exactly as
 * security-assessment-signoff.md itself does. A caller that needs the
 * three-way distinction reads `gate_decision` from the summary or from the
 * sign-off document directly; a caller that only needs "is this blocked"
 * reads `passed`. This is the same shape archon-ship's own `delivered`
 * boolean uses to collapse a richer set of terminal states into one bit
 * while keeping the full detail in `summary`.
 *
 * Like archon-ship-figma's and archon-prototype-audit's outcome scripts:
 * synthesize is this workflow's load-bearing node and a failure there
 * blocks this node's dependency entirely — the run never reaches here to
 * emit anything — so every path this script actually executes already has
 * a real gate_decision behind it.
 *
 * Bound inputs (`with:` bindings, canonical text/JSON in env):
 * - INPUTS_GATE_DECISION / INPUTS_CRITICAL_COUNT / INPUTS_HIGH_COUNT /
 *   INPUTS_MEDIUM_COUNT / INPUTS_LOW_COUNT / INPUTS_MOST_URGENT_ACTION:
 *   synthesize's certified fields.
 * - INPUTS_ISSUES_FILED: file-issues' certified array, bound with `from:`
 *   and `if_skipped: null`, arriving as canonical JSON text or "null" when
 *   that branch did not run.
 */

import { emit, text } from '../../.shared/io.ts';

function isNull(raw: string): boolean {
  return raw === '' || raw === 'null';
}

function parsedArray(raw: string): unknown[] {
  if (isNull(raw)) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

const gateDecision = text(process.env.INPUTS_GATE_DECISION);
const criticalCount = text(process.env.INPUTS_CRITICAL_COUNT) || '0';
const highCount = text(process.env.INPUTS_HIGH_COUNT) || '0';
const mediumCount = text(process.env.INPUTS_MEDIUM_COUNT) || '0';
const lowCount = text(process.env.INPUTS_LOW_COUNT) || '0';
const mostUrgentAction = text(process.env.INPUTS_MOST_URGENT_ACTION);
const issuesFiled = parsedArray(text(process.env.INPUTS_ISSUES_FILED));

const passed = gateDecision !== 'FAIL';

const lines: string[] = [
  `Gate decision: ${gateDecision.replace('_', ' ')} — ${criticalCount} Critical, ` +
    `${highCount} High, ${mediumCount} Medium, ${lowCount} Low finding(s).`,
  `Most urgent action: ${mostUrgentAction}`,
];

if (issuesFiled.length > 0) {
  lines.push(`Filed ${issuesFiled.length} issue(s) for the Critical/High findings.`);
} else {
  lines.push('No issues were filed in this run (file_issues was false).');
}

emit({ passed, summary: lines.join('\n') });
