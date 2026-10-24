import { ShieldCheck } from 'lucide-react';
import type { FrontendProviderModule } from '../providers/types';

/** A provider-neutral module for core tests; never installed by the running app. */
export const TEST_PROVIDER_MODULE: FrontendProviderModule = {
  id: 'test',
  name: 'Test Provider',
  ssoDomain: 'test.example',
  links: {
    forgotPasswordUrl: 'https://example.com/reset',
    changePasswordUrl: 'https://example.com/change',
    manageAccountUrl: 'https://example.com/manage',
  },
  renderIcon: size => <ShieldCheck size={size} aria-hidden />,
};
