import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import type { CSSProperties } from 'react';
import { useListbox } from '../hooks/useListbox';
import { body, color, font, opacity, radius, size, space } from '../styles/tokens';

export type InputKind = 'text' | 'select' | 'recovery-select';

export interface InputOption {
  value: string;
  label: string;
}

interface InputProps {
  kind?: InputKind;
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  error?: string;
  options?: readonly InputOption[];
  disabled?: boolean;
  inputType?: 'text' | 'email';
}

/** AA/Form/Input — Kind=Text|Select|Recovery select with Default/Error/Open/Disabled states. */
export function Input({
  kind = 'text',
  label,
  value,
  onChange,
  placeholder,
  error,
  options = [],
  disabled = false,
  inputType = 'text',
}: InputProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [open, setOpen] = useState(false);
  const isSelect = kind === 'select' || kind === 'recovery-select';
  const isOpen = !disabled && open;
  const isError = Boolean(error);
  const isDisabled = disabled;
  const { wrapperRef, triggerRef } = useListbox(isOpen, () => setOpen(false));

  const borderColor = isError ? color.border.error : isOpen ? color.action.primary : color.border.control;

  const fieldStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: size.inputHeight,
    padding: `0 ${space[14]}px`,
    borderRadius: radius.input,
    border: `1px solid ${borderColor}`,
    background: color.background.canvas,
    color: color.text.primary,
    opacity: isDisabled ? opacity.disabled : 1,
    ...body[15],
    fontFamily: font.body,
  };

  function select(option: InputOption) {
    onChange?.(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={wrapperRef} style={{ display: 'flex', flexDirection: 'column', gap: space[6], position: 'relative' }}>
      <label htmlFor={inputId} style={{ ...body[13], fontFamily: font.body, color: color.text.secondary }}>
        {label}
      </label>

      {isSelect ? (
        <div style={{ position: 'relative' }}>
          <button
            className="aa-focusable"
            id={inputId}
            ref={triggerRef}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-invalid={isError || undefined}
            aria-describedby={isError ? errorId : undefined}
            disabled={isDisabled}
            onClick={() => setOpen(current => !current)}
            style={{ ...fieldStyle, justifyContent: 'space-between', cursor: isDisabled ? 'default' : 'pointer', textAlign: 'left' }}
          >
            <span style={{ color: value ? color.text.primary : color.text.secondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value || placeholder || 'Select an option'}
            </span>
            <ChevronDown size={16} aria-hidden color={color.text.secondary} />
          </button>

          {isOpen ? (
            <ul
              role="listbox"
              aria-label={label}
              style={{
                position: 'absolute',
                zIndex: 10,
                top: `calc(100% + ${space[4]}px)`,
                left: 0,
                right: 0,
                margin: 0,
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
                    onClick={() => select(option)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: `${space[10]}px ${space[12]}px`,
                      background: option.value === value ? color.surface.subtle : 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      ...body[14],
                      fontFamily: font.body,
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
      ) : (
        <input
          className="aa-focusable"
          id={inputId}
          type={inputType}
          value={value}
          disabled={isDisabled}
          placeholder={placeholder}
          aria-invalid={isError || undefined}
          aria-describedby={isError ? errorId : undefined}
          onChange={event => onChange?.(event.target.value)}
          style={fieldStyle}
        />
      )}

      {isError && error ? (
        <span
          id={errorId}
          role="alert"
          style={{ ...body[13], fontFamily: font.body, color: color.status.error }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
