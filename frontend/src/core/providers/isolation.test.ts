import { describe, expect, it } from 'vitest';
import { findProviderIsolationViolations } from '../../../../shared/provider-isolation';

// Vite may expose `import.meta.url` under its `/@fs` virtual prefix in tests.
const repoRoot = new URL('../../../../', import.meta.url).pathname.replace(/^\/@fs/, '');

describe('provider isolation', () => {
  it('keeps every file outside the exempt set to at most one provider id', () => {
    expect(findProviderIsolationViolations(repoRoot)).toEqual([]);
  });
});
