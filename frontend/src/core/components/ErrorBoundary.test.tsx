import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '../lib/log';
import { ErrorBoundary } from './ErrorBoundary';

function Explodes(): JSX.Element {
  throw new Error('render failed');
}

beforeEach(() => {
  log.clear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('logs the render error and shows the notice with its reference', () => {
    render(
      <ErrorBoundary>
        <Explodes />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong. Try again.')).toBeInTheDocument();
    const entry = log.recent()[0];
    expect(entry.level).toBe('error');
    expect(entry.scope).toBe('react');
    expect(screen.getByText(`Reference: ${entry.reference}`)).toBeInTheDocument();
  });
});
