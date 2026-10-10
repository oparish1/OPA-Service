/**
 * One return for every legitimate terminal result of this workflow.
 *
 * Unlike archon-ship's outcome (where `delivered:false` is the meaningful
 * negative result to distinguish from `delivered:true`), this workflow's
 * value is delivered the moment synthesize succeeds: the audit report and
 * remediation plan exist either way, whether or not any Release Blocker
 * existed, was fixed, was opened as a PR, or was filed as an issue. So
 * `completed` carries no branch of its own — a run that reaches this node at
 * all has synthesize's report behind it, by the same cascade logic
 * ship/scripts/outcome.ts documents: a synthesize failure blocks this node's
 * dependency and the run never reaches here to emit anything.
 *
 * What this node actually does is compose one summary a person can read
 * without opening every artifact file: the backlog counts and
 * recommendation from synthesize, then whichever of the optional branches
 * ran (fix-blockers/post-fix-validate/open-pr, file-issues), each reported
 * only when it actually ran rather than as a misleading "skipped" line for
 * every run that chose fix_blockers:false or file_issues:false.
 *
 * Bound inputs (`with:` bindings, canonical text/JSON in env):
 * - INPUTS_RELEASE_BLOCKER_COUNT / INPUTS_PARALLEL_CLEANUP_COUNT /
 *   INPUTS_DEFERRABLE_COUNT / INPUTS_GO_NO_GO / INPUTS_RECOMMENDATION:
 *   synthesize's certified fields.
 * - INPUTS_FIX_DONE / INPUTS_FIX_GREEN / INPUTS_FIX_SUMMARY: fix-blockers'
 *   fields, bound with `from:` and `if_skipped: null`, so each arrives as
 *   canonical text or the literal string "null" when that branch did not run.
 * - INPUTS_VALIDATE_GREEN: post-fix-validate's field, same null convention.
 * - INPUTS_PR_URL: open-pr's qualified PR record's `url` field, same null
 *   convention.
 * - INPUTS_ISSUES_FILED: file-issues' certified array, bound with `from:` and
 *   `if_skipped: null`, arriving as canonical JSON text or "null".
 */

import { artifactsDir, emit, text } from '../../.shared/io.ts';

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

const artifacts = artifactsDir();

const releaseBlockerCount = text(process.env.INPUTS_RELEASE_BLOCKER_COUNT) || '0';
const parallelCleanupCount = text(process.env.INPUTS_PARALLEL_CLEANUP_COUNT) || '0';
const deferrableCount = text(process.env.INPUTS_DEFERRABLE_COUNT) || '0';
const goNoGo = text(process.env.INPUTS_GO_NO_GO);
const recommendation = text(process.env.INPUTS_RECOMMENDATION);

const fixDone = text(process.env.INPUTS_FIX_DONE);
const fixGreen = text(process.env.INPUTS_FIX_GREEN);
const fixSummary = text(process.env.INPUTS_FIX_SUMMARY);
const validateGreen = text(process.env.INPUTS_VALIDATE_GREEN);
const prUrl = text(process.env.INPUTS_PR_URL);
const issuesFiled = parsedArray(text(process.env.INPUTS_ISSUES_FILED));

const lines: string[] = [
  `Audit complete (${goNoGo}): ${releaseBlockerCount} release blocker(s), ` +
    `${parallelCleanupCount} parallel cleanup(s), ${deferrableCount} deferrable item(s).`,
  `Recommendation: ${recommendation}`,
  `Audit report: ${artifacts}/audit-report.md`,
  `Remediation plan: ${artifacts}/remediation-plan.md`,
];

if (!isNull(fixDone)) {
  lines.push(
    `Sprint 0 fix run: done=${fixDone} green=${fixGreen}${
      isNull(validateGreen) ? '' : `, revalidated green=${validateGreen}`
    }. ${fixSummary}`
  );
} else {
  lines.push('Sprint 0 was not fixed in this run (fix_blockers was false, or there was nothing to fix).');
}

if (!isNull(prUrl)) {
  lines.push(`Draft PR opened for the Sprint 0 fixes: ${prUrl}`);
}

if (issuesFiled.length > 0) {
  lines.push(`Filed ${issuesFiled.length} issue(s) for the remaining backlog.`);
} else {
  lines.push('No issues were filed in this run (file_issues was false, or nothing remained to file).');
}

emit({ completed: true, summary: lines.join('\n') });
