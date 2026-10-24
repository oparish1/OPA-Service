import { describe, expect, it } from 'vitest';
import { PROVIDER_MODULES } from '../../index';

describe('Okta registration', () => {
  it('composes the Okta module in the production registry', () => {
    expect(PROVIDER_MODULES.some(module => module.id === 'okta')).toBe(true);
  });
});
