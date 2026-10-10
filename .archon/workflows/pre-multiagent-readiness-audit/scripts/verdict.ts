/**
 * Derives the readiness verdict and writes the report's final form.
 *
 * The agent proposes; this node decides. The final verdict is the more severe of
 * the agent's proposal and a floor computed only from facts this script can check.
 * A floor never lowers a verdict, so an agent that judges the system worse than the
 * rules do is always honoured.
 *
 * Floor rules, each with the reason it exists:
 *   NOT_READY               any critical finding — the multi-agent blast radius is
 *                           already unacceptable, whatever else is true.
 *   READY_WITH_CONDITIONS   any high finding;
 *                           unsafe (shared, unsynchronized) state under a shape
 *                           where agents can run concurrently;
 *                           high-risk failure modes no test induces;
 *                           no green baseline suite — absent, red, or unfinished;
 *                           structural metrics wholly unmeasured;
 *                           a lens report missing;
 *                           any listed prerequisite (READY names none).
 *
 * The verdict, the ordered prerequisites and the go/no-go are rendered here rather
 * than by the agent, so the report cannot disagree with the value a caller gates on.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { artifactsDir, emit, refuse, trimmed } from '../../.shared/io.ts';

type Verdict = 'READY' | 'READY_WITH_CONDITIONS' | 'NOT_READY';

const RANK: Record<Verdict, number> = { READY: 0, READY_WITH_CONDITIONS: 1, NOT_READY: 2 };
const BY_RANK: readonly Verdict[] = ['READY', 'READY_WITH_CONDITIONS', 'NOT_READY'];

interface Reason {
  readonly rank: number;
  readonly text: string;
}

function parse(name: string, raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Binding ${name} is not valid JSON.`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strings(name: string, raw: string): string[] {
  const value = parse(name, raw);
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    throw new Error(`Binding ${name} is not an array of strings.`);
  }
  return value.map(item => (item as string).trim()).filter(item => item !== '');
}

function count(name: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`Binding ${name} is not a non-negative integer.`);
  }
  return value;
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function run(): void {
  const proposed = trimmed(process.env.INPUTS_PROPOSED) as Verdict;
  const project = trimmed(process.env.INPUTS_PROJECT) || 'this project';
  const shape = trimmed(process.env.INPUTS_SHAPE);
  const concurrent = trimmed(process.env.INPUTS_CONCURRENT) === 'true';
  const metrics = trimmed(process.env.INPUTS_METRICS);
  const summary = trimmed(process.env.INPUTS_SUMMARY);
  const unsafe = count('unsafe_state', Number(trimmed(process.env.INPUTS_UNSAFE_STATE)));
  const untested = count('untested', Number(trimmed(process.env.INPUTS_UNTESTED)));

  const found = parse('findings', trimmed(process.env.INPUTS_FINDINGS));
  if (!isObject(found)) throw new Error('Binding findings is not an object.');
  const critical = count('findings.critical', found.critical);
  const high = count('findings.high', found.high);

  const prerequisites = strings('prerequisites', trimmed(process.env.INPUTS_PREREQUISITES));
  const openDecisions = strings('open_decisions', trimmed(process.env.INPUTS_OPEN_DECISIONS));
  const topRisks = strings('top_risks', trimmed(process.env.INPUTS_TOP_RISKS));
  const missing = strings('missing', trimmed(process.env.INPUTS_MISSING));

  // A skipped baseline arrives as the text "null": no suite was present to run.
  const baselineRaw = parse('baseline', trimmed(process.env.INPUTS_BASELINE));
  const baseline = isObject(baselineRaw) ? baselineRaw : null;
  const baselineGreen = baseline !== null && baseline.green === true;

  const pointer = parse('body', trimmed(process.env.INPUTS_BODY));
  if (!isObject(pointer) || typeof pointer.run_id !== 'string' || typeof pointer.path !== 'string') {
    throw new Error('Binding body is not an artifact pointer.');
  }

  const reasons: Reason[] = [];
  if (critical > 0) {
    reasons.push({
      rank: 2,
      text: `${plural(critical, 'critical finding')} at the multi-agent blast radius`,
    });
  }
  if (high > 0) reasons.push({ rank: 1, text: `${plural(high, 'high finding')}` });
  if (concurrent && unsafe > 0) {
    reasons.push({
      rank: 1,
      text: `${plural(unsafe, 'piece')} of shared, unsynchronized state under a concurrent shape (${shape})`,
    });
  }
  if (untested > 0) {
    reasons.push({ rank: 1, text: `${plural(untested, 'high-risk failure mode')} with no test that induces it` });
  }
  if (!baselineGreen) {
    const cause = baseline === null ? '' : String(baseline.red_cause ?? '');
    reasons.push({
      rank: 1,
      text:
        baseline === null
          ? 'no baseline test evidence: the project has no test suite to measure'
          : cause === 'incomplete'
            ? 'the baseline test suite did not finish'
            : `the baseline test suite is red${cause === '' ? '' : ` (${cause})`}`,
    });
  }
  if (metrics === 'none') reasons.push({ rank: 1, text: 'structural metrics are wholly unmeasured' });
  if (missing.length > 0) {
    reasons.push({ rank: 1, text: `the ${missing.join(', ')} lens report is missing, so the audit is incomplete` });
  }
  // A proposed READY that still lists prerequisites contradicts itself; the list wins.
  if (prerequisites.length > 0 && proposed === 'READY') {
    reasons.push({ rank: 1, text: 'the audit lists prerequisites, which READY does not carry' });
  }

  const floor = reasons.reduce((max, reason) => Math.max(max, reason.rank), 0);
  const finalRank = Math.max(RANK[proposed], floor);
  const verdict = BY_RANK[finalRank] as Verdict;
  const raised = finalRank > RANK[proposed];
  const raisedBecause = raised
    ? reasons.filter(reason => reason.rank > RANK[proposed]).map(reason => reason.text)
    : [];

  // Conditions the boundary itself enforced are appended after the agent's own
  // ordered list, so the agent's sequencing is never reshuffled.
  const finalPrerequisites = raised
    ? [...prerequisites, ...raisedBecause.map(reason => `Resolve: ${reason}.`)]
    : prerequisites;

  if (verdict !== 'READY' && finalPrerequisites.length === 0) {
    throw new Error(
      `A ${verdict} verdict names no prerequisite. A verdict that says what is wrong ` +
        'but not what must become true is not actionable; the synthesis must list at least one.'
    );
  }

  const confidence =
    missing.length > 0 || !baselineGreen || metrics === 'none'
      ? 'low'
      : metrics === 'partial'
        ? 'medium'
        : 'high';
  const next = verdict === 'READY' ? 'none' : openDecisions.length > 0 ? 'plan' : 'deliver';

  const bodyPath = join(artifactsDir(), pointer.path);
  const body = readFileSync(bodyPath, 'utf-8').trim();
  const label = verdict.replaceAll('_', ' ');

  const head: string[] = [
    `# Pre-Multi-Agent Readiness Audit Report — ${project}`,
    '',
    `## Readiness Verdict: ${label}`,
    `- Target shape: ${shape}`,
    `- Confidence: ${confidence}`,
    `- Rationale: ${summary}`,
  ];
  if (raised) {
    head.push(
      `- The audit boundary raised this verdict from ${proposed.replaceAll('_', ' ')}: ${raisedBecause.join('; ')}.`
    );
  }
  if (finalPrerequisites.length > 0) {
    head.push('- What must be true before extending to multi-agent, in order:');
    finalPrerequisites.forEach((item, index) => head.push(`  ${index + 1}. ${item}`));
  }

  const total = finalPrerequisites.length;
  const are = total === 1 ? 'is' : 'are';
  const goNoGo =
    verdict === 'READY'
      ? 'GO. Proceed to multi-agent design.'
      : verdict === 'READY_WITH_CONDITIONS'
        ? `CONDITIONAL GO. Proceed to multi-agent design only once the ${plural(total, 'prerequisite')} above ${are} met.`
        : `NO-GO. Do not extend to multi-agent until the ${plural(total, 'prerequisite')} above ${are} met and the audit is re-run.`;
  const route =
    next === 'none'
      ? ''
      : next === 'plan'
        ? '\n\nNext: run archon-plan first. At least one prerequisite depends on an open architectural decision that a local refactor must not make.'
        : '\n\nNext: every prerequisite is a decided, local change. Run archon-deliver with this report as the work order.';

  const report = [...head, '', body, '', '## Recommendation', goNoGo + route, ''].join('\n');
  writeFileSync(join(artifactsDir(), 'readiness-audit.md'), report, 'utf-8');

  emit({
    verdict,
    ready: verdict === 'READY',
    confidence,
    shape,
    raised,
    raised_because: raisedBecause,
    next,
    prerequisites: finalPrerequisites,
    open_decisions: openDecisions,
    top_risks: topRisks,
    summary,
    report: { type: 'archon_artifact', run_id: pointer.run_id, path: 'readiness-audit.md' },
  });
}

try {
  run();
} catch (error) {
  refuse(error instanceof Error ? error.message : String(error));
}
