import { Input } from './Input';
import type { InputOption } from './Input';

interface ProviderSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly InputOption[];
  error?: string;
  disabled?: boolean;
}

/**
 * AA/IdentitySelect — the Change password provider dropdown, extracted from the
 * States node. Kind=Select with Default/Open/Error/Disabled states.
 */
export function ProviderSelect({ label, value, onChange, options, error, disabled }: ProviderSelectProps) {
  return (
    <Input
      kind="select"
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      error={error}
      disabled={disabled}
      placeholder="Choose an identity provider"
    />
  );
}
