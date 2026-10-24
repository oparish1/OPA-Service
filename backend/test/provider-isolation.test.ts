import { describe, expect, it } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { findProviderIsolationViolations } from '../../shared/provider-isolation';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

describe('provider isolation', () => {
  it('keeps every file outside the exempt set to at most one provider id', () => {
    expect(findProviderIsolationViolations(repoRoot)).toEqual([]);
  });
});
