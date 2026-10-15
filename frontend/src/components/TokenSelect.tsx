import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useListbox } from '../hooks/useListbox';
import { code, color, font, label as labelToken, radius, size, space } from '../styles/tokens';

export interface TokenOption<T extends string = string> {
  value: T;
  label: string;
}

interface TokenSelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly TokenOption<T>[];
  onChange: (value: T) => void;
  expired?: boolean;
}

/**
 * AA/TokenSelect — Authorization selector used by the shared RequestPanel.
 * Closed shows the selected option; Open lists every option.
 */
export function TokenSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  expired = false,
}: TokenSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  const { wrapperRef, triggerRef } = useListbox(open, () => setOpen(false));

  return (
    <div ref={wrapperRef} style={{ display: 'flex', flexDirection: 'column', gap: space[6], position: 'relative' }}>
      <span style={{ ...labelToken[12], fontFamily: font.body, color: color.text.secondary }}>{label}</span>
      <button
        ref={triggerRef}
        className="aa-focusable"
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[12],
          width: '100%',
          height: size.navItemHeight,
          padding: `0 ${space[14]}px`,
          border: `1px solid ${open ? color.action.primary : color.border.subtle}`,
          borderRadius: radius.input,
          background: color.background.canvas,
          ...code[14],
          fontFamily: font.code,
          color: expired ? color.status.error : color.text.primary,
          cursor: 'pointer',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? 'Select a token'}
        </span>
        <ChevronDown size={16} aria-hidden color={color.text.secondary} />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={label}
          style={{
            position: 'absolute',
            zIndex: 10,
            top: '100%',
            left: 0,
            right: 0,
            margin: `${space[4]}px 0 0`,
            padding: space[4],
            listStyle: 'none',
            background: color.background.canvas,
            border: `1px solid ${color.border.control}`,
            borderRadius: radius.input,
          }}
        >
          {options.map(option => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                className="aa-focusable"
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: `${space[10]}px ${space[12]}px`,
                  background: option.value === value ? color.surface.subtle : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  ...code[14],
                  fontFamily: font.code,
                  color: color.text.primary,
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
