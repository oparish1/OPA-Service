import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProviderIcon } from '../../../core/components/ProviderIcon';
import { setProviderRegistry } from '../../../core/providers/active';
import { googleModule } from '../index';

setProviderRegistry([googleModule]);

describe('Google provider icon', () => {
  it('renders the multicolour Google mark', () => {
    const { container } = render(<ProviderIcon id="google" />);
    expect(container.querySelector('path[fill="#4285F4"]')).not.toBeNull();
    expect(container.querySelector('path[fill="#EA4335"]')).not.toBeNull();
  });
});
