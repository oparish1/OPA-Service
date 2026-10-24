import { describe, expect, it } from 'vitest';
import { PROVIDER_MODULES } from '../../index';

describe('Google registration', () => {
  it('composes the Google module in the production registry', () => {
    expect(PROVIDER_MODULES.some(module => module.id === 'google')).toBe(true);
  });
});
