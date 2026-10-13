import { Input } from './Input';
import type { InputOption } from './Input';

interface RecoverySelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly InputOption[];
  error?: string;
  disabled?: boolean;
}

/**
 * AA/RecoverySelect — the Forgot password recovery dropdown, extracted from the
 * States node. Kind=Recovery select with Default/Open/Error/Disabled states.
 */
export function RecoverySelect({ label, value, onChange, options, error, disabled }: RecoverySelectProps) {
  return (
    <Input
      kind="recovery-select"
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
