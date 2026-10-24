import { Check, CircleAlert, Copy } from 'lucide-react';
import { useCopyFeedback } from '../hooks/useCopyFeedback';
import { code, color, font, radius, space } from '../styles/tokens';
import { TextLink } from './TextLink';

interface CodeBlockProps {
  value: unknown;
  copyable?: boolean;
}

/** Reusable JSON body display: surface.code fill, IBM Plex Mono Code/14/22. */
export function CodeBlock({ value, copyable = false }: CodeBlockProps) {
  const { status, copy } = useCopyFeedback();
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const copyLabel = status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Copy';
  const copyIcon =
    status === 'copied' ? (
      <Check size={15} aria-hidden />
    ) : status === 'failed' ? (
      <CircleAlert size={15} aria-hidden />
    ) : (
      <Copy size={15} aria-hidden />
    );

  return (
    <div
      style={{
        position: 'relative',
        padding: space[24],
        background: color.surface.code,
        borderRadius: radius.card,
      }}
    >
      {copyable ? (
        <div style={{ position: 'absolute', top: space[12], right: space[12] }}>
          <TextLink onClick={() => copy(text)} trailingIcon={copyIcon}>
            {copyLabel}
          </TextLink>
        </div>
      ) : null}
      <pre
        style={{
          margin: 0,
          ...code['14/22'],
          fontFamily: font.code,
          color: color.text.primary,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </pre>
    </div>
  );
}
