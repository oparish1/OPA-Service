import { describe, expect, it } from 'vitest';
import { PROVIDER_MODULES } from '../../index';

describe('Entra registration', () => {
  it('composes the Entra module in the production registry', () => {
    expect(PROVIDER_MODULES.some(module => module.id === 'entra')).toBe(true);
  });
});
