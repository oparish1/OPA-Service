import { useState } from 'react';
import type { ApiResponse, BodyKind } from '../types';
import { body, code, color, font, label, radius, space } from '../styles/tokens';
import { Badge } from './Badge';
import type { BadgeTone } from './Badge';
import { CodeBlock } from './CodeBlock';
import { SkeletonBlock } from './Skeleton';

interface ResponseCardProps {
  response: ApiResponse | null;
  loading?: boolean;
}

const BODY_LABEL: Record<BodyKind, string> = {
  json: 'JSON · Pretty',
  text: 'Text',
  empty: 'Empty',
  binary: 'Binary',
};

function toneFor(status: number): BadgeTone {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'neutral';
  return 'error';
}

/** AA/ResponseCard — State=Body|Headers; idle, loading and real-response states. */
export function ResponseCard({ response, loading = false }: ResponseCardProps) {
  const [tab, setTab] = useState<'body' | 'headers'>('body');
  const bodyKind = response?.bodyKind ?? 'json';

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

      {loading ? (
        <SkeletonBlock lines={4} />
      ) : response === null ? (
        <p style={{ margin: 0, ...body[14], fontFamily: font.body, color: color.text.secondary }}>
          Run the request to see the response
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: space[12], flexWrap: 'wrap' }}>
            <Badge tone={toneFor(response.status)}>{response.statusLabel}</Badge>
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
              {BODY_LABEL[bodyKind]}
            </span>
          </div>

          {tab === 'body' ? (
            bodyKind === 'empty' ? (
              <span style={{ ...body[13], fontFamily: font.body, color: color.text.secondary }}>
                No response body.
              </span>
            ) : bodyKind === 'binary' ? (
              <span style={{ ...body[13], fontFamily: font.body, color: color.text.secondary }}>
                {`Binary content (${response.sizeBytes ?? 0} B) is not displayed.`}
              </span>
            ) : (
              <CodeBlock value={response.body} copyable />
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {response.headers.length === 0 ? (
                <span style={{ ...body[13], fontFamily: font.body, color: color.text.secondary }}>
                  No response headers.
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
