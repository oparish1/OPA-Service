import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findCatchHandlingViolations, findCatchSites } from '../../../../shared/catch-handling';

const repoRoot = new URL('../../../../', import.meta.url).pathname.replace(/^\/@fs/, '');

describe('catch handling check', () => {
  it('fails on the bare-catch fixture', () => {
    const source = readFileSync(
      join(repoRoot, 'scripts/fixtures/catch-handling/bare-catch.ts'),
      'utf8'
    );
    const report = findCatchSites(source, 'bare-catch.ts');
    expect(report.sites).toHaveLength(1);
    expect(report.violations).toHaveLength(1);
  });

  it('passes for every non-test catch site in frontend/src', () => {
    expect(findCatchHandlingViolations(repoRoot).violations).toEqual([]);
  });
});
