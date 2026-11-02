import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findCatchSites } from '../../../../shared/catch-handling';

const repoRoot = new URL('../../../../', import.meta.url).pathname.replace(/^\/@fs/, '');

describe('catch handling check', () => {
  it('rejects a logger mention in a comment or a string', () => {
    const comment = findCatchSites(
      'function f() { try {} catch { // TODO: log.error( later\n } }',
      'comment.ts'
    );
    expect(comment.violations).toHaveLength(1);

    const literal = findCatchSites(
      'function f() { try {} catch { const x = "log.error("; } }',
      'literal.ts'
    );
    expect(literal.violations).toHaveLength(1);
  });

  it('accepts a real logger call, a rethrow, and an exemption', () => {
    const logged = findCatchSites(
      'function f() { try {} catch (error) { log.error("scope", "message", error); } }',
      'logged.ts'
    );
    expect(logged.violations).toHaveLength(0);

    const rethrown = findCatchSites('function f() { try {} catch (error) { throw error; } }', 'throw.ts');
    expect(rethrown.violations).toHaveLength(0);

    const exempt = findCatchSites(
      'function f() { try {} catch { // log-exempt: display fallback\n } }',
      'exempt.ts'
    );
    expect(exempt.violations).toHaveLength(0);
  });

  it('fails on the bare-catch fixture', () => {
    const source = readFileSync(
      join(repoRoot, 'scripts/fixtures/catch-handling/bare-catch.ts'),
      'utf8'
    );
    const report = findCatchSites(source, 'bare-catch.ts');
    expect(report.sites).toHaveLength(1);
    expect(report.violations).toHaveLength(1);
  });
});
