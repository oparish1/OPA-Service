import { createElement } from 'react';
import { Building2 } from 'lucide-react';
import type { FrontendProviderModule } from '../providers/types';

/** A fake provider module so core tests can render more than one provider without real ids. */
export function fakeProvider(
  id: string,
  name: string,
  links: FrontendProviderModule['links'] = {}
): FrontendProviderModule {
  return {
    id,
    name,
    ssoDomain: `${id}.example`,
    links,
    renderIcon: size => createElement(Building2, { size, 'aria-hidden': true }),
  };
}

export const ALPHA_MODULE = fakeProvider('alpha', 'Alpha Identity', {
  forgotPasswordUrl: 'https://example.com/reset',
  changePasswordUrl: 'https://example.com/change',
  manageAccountUrl: 'https://example.com/manage',
});

export const BETA_MODULE = fakeProvider('beta', 'Beta Identity', {
  forgotPasswordUrl: 'https://example.com/reset',
});
