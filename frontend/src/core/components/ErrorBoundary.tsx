import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { GENERIC_ERROR } from '../lib/copy';
import { describeError, log } from '../lib/log';
import { Notice } from './Notice';

interface ErrorBoundaryState {
  failed: boolean;
  reference: string | null;
}

/** Keeps a render failure from becoming a blank page and logs it with a reference. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, reference: null };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const reference = log.error('react', 'Unhandled render error', {
      error: describeError(error),
      componentStack: info.componentStack?.split('\n').slice(0, 5).join('\n'),
    });
    this.setState({ reference });
  }

  render() {
    if (this.state.failed) {
      return (
        <Notice
          tone="error"
          heading={GENERIC_ERROR}
          reference={this.state.reference ?? undefined}
        />
      );
    }
    return this.props.children;
  }
}
