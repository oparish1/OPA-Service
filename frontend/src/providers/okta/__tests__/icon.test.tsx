import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProviderIcon } from '../../../core/components/ProviderIcon';
import { setProviderRegistry } from '../../../core/providers/active';
import { oktaModule } from '../index';

setProviderRegistry([oktaModule]);

describe('Okta provider icon', () => {
  it('renders a mark distinct from the neutral fallback', () => {
    const { container: okta } = render(<ProviderIcon id="okta" />);
    const { container: fallback } = render(<ProviderIcon id="unknown" />);
    expect(okta.querySelector('svg')?.innerHTML).not.toBe(fallback.querySelector('svg')?.innerHTML);
  });
});
