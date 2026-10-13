import { useState } from 'react';
import type { ApiResponse } from '../mocks/types';
import { body, code, color, font, label, radius, space } from '../styles/tokens';
import { Badge } from './Badge';
import { CodeBlock } from './CodeBlock';

interface ResponseCardProps {
  response: ApiResponse | null;
}

/** AA/ResponseCard — State=Body|Headers; idle shell before the first request. */
export function ResponseCard({ response }: ResponseCardProps) {
  const [tab, setTab] = useState<'body' | 'headers'>('body');
  const tone = response?.status === 200 ? 'success' : 'error';

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: space[16],
        padding: space[24],
        background: color.background.canvas,
        border: `1px solid ${color.border.subtle}`,
        borderRadius: radius.card,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: space[12] }}>
        <h2 style={{ margin: 0, ...label[16], fontFamily: font.body, color: color.text.primary }}>Response</h2>
      </div>

      {response === null ? (
        <p style={{ margin: 0, ...body[14], fontFamily: font.body, color: color.text.secondary }}>
          Run the request to see the response
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: space[12], flexWrap: 'wrap' }}>
            <Badge tone={tone}>{response.statusLabel}</Badge>
            <span style={{ ...body[13], fontFamily: font.body, color: color.text.secondary }}>
              {response.duration} · {response.size}
            </span>
            <span style={{ ...body[12], fontFamily: font.body, color: color.text.secondary }}>
              {response.timestamp}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[20],
              borderBottom: `1px solid ${color.border.subtle}`,
            }}
          >
            {(['body', 'headers'] as const).map(item => (
              <button
                className="aa-focusable"
                key={item}
                type="button"
                aria-selected={tab === item}
                onClick={() => setTab(item)}
                style={{
                  padding: `${space[8]}px 0`,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${tab === item ? color.action.primary : 'transparent'}`,
                  color: tab === item ? color.text.link : color.text.secondary,
                  ...body[13],
                  fontFamily: font.body,
                  cursor: 'pointer',
                }}
              >
                {item === 'body' ? 'Body' : `Headers (${response.headers.length})`}
              </button>
            ))}
            <span style={{ ...body[12], fontFamily: font.body, color: color.text.secondary }}>
              JSON · Pretty
            </span>
          </div>

          {tab === 'body' ? (
            <CodeBlock value={response.body} copyable />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {response.headers.length === 0 ? (
                <span style={{ ...body[13], fontFamily: font.body, color: color.text.secondary }}>
                  Nothing to show yet
                </span>
              ) : (
                response.headers.map(header => (
                  <div
                    key={header}
                    style={{
                      padding: `${space[12]}px ${space[24]}px`,
                      borderTop: `1px solid ${color.border.subtle}`,
                      ...code[12],
                      fontFamily: font.code,
                      color: color.text.secondary,
                    }}
                  >
                    {header}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
