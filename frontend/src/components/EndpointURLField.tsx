import { useId } from 'react';
import { body, code, color, font, radius, size, space } from '../styles/tokens';

interface EndpointURLFieldProps {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  error?: string;
}

/**
 * Local EndpointURLField — editable request URL: 44 px, 1 px border, IBM Plex
 * Mono 14. Deliberately not an AA/Form/Input; it keeps the token styling.
 */
export function EndpointURLField({ value, onChange, onEnter, error }: EndpointURLFieldProps) {
  const errorId = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[6] }}>
      <input
        className="aa-focusable"
        type="text"
        aria-label="Request URL"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={event => onChange(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onEnter?.();
          }
        }}
        style={{
          width: '100%',
          height: size.navItemHeight,
          padding: `0 ${space[14]}px`,
          border: `1px solid ${error ? color.border.error : color.border.subtle}`,
          borderRadius: radius.input,
          background: color.background.canvas,
          ...code[14],
          fontFamily: font.code,
          color: color.text.primary,
        }}
      />
      {error ? (
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
