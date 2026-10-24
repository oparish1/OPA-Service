import { Building2 } from 'lucide-react';
import type { ProviderId } from '../../../../shared/providers';
import type { FrontendProviderModule } from '../../core/providers/types';

export const entraModule: FrontendProviderModule = {
  id: 'entra' satisfies ProviderId,
  name: 'Microsoft Entra ID',
  ssoDomain: 'agentic-advantage.example',
  links: {
    forgotPasswordUrl: 'https://example.com/reset',
    changePasswordUrl: 'https://example.com/change',
    manageAccountUrl: 'https://example.com/manage/entra',
  },
  renderIcon: size => <Building2 size={size} aria-hidden />,
};
