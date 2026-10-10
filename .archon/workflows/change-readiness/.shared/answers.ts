/**
 * The stakeholder-answers file: the one place a readiness run gets its commitments.
 *
 * The file is Markdown with one `## <dimension>` section per interview dimension.
 * A dimension is answered when its section holds text that is not a placeholder.
 * Nothing here interprets an answer; it only says whether one was given, because a
 * threshold, tier or retention window that nobody supplied must stay unresolved
 * rather than be filled with something plausible.
 */

import { readFileSync, statSync } from 'node:fs';

export const DIMENSIONS = [
  'business_owner',
  'end_users',
  'stakes',
  'regulatory',
  'rollout',
  'tooling',
] as const;

/** Without these two no accountable party or authority tier can be committed. */
export const BLOCKING = ['business_owner', 'stakes'] as const;

const PLACEHOLDER = /^(tbd|todo|unknown|n\/a|\?+|-+)?$/i;

export interface Answers {
  readonly answered: string[];
  readonly unresolved: string[];
}

/** Read the answers file; an empty or absent path means nothing was answered. */
export function readAnswers(path: string): Answers {
  const sections = new Map<string, string>();
  if (path !== '' && statSync(path, { throwIfNoEntry: false })?.isFile()) {
    let current = '';
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const heading = /^##\s+([a-z_]+)\s*$/i.exec(line);
      if (heading) {
        current = (heading[1] ?? '').toLowerCase();
        sections.set(current, '');
      } else if (current !== '') {
        sections.set(current, `${sections.get(current) ?? ''}${line}\n`);
      }
    }
  }
  const answered: string[] = [];
  const unresolved: string[] = [];
  for (const dim of DIMENSIONS) {
    const body = (sections.get(dim) ?? '').trim();
    (PLACEHOLDER.test(body) ? unresolved : answered).push(dim);
  }
  return { answered, unresolved };
}
