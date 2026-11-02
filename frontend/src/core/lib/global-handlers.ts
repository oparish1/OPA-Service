import { describeError, log } from './log';

/** Logs uncaught browser errors and unhandled rejections; returns the cleanup. */
export function installGlobalHandlers(target: Window = window): () => void {
  const onError = (event: ErrorEvent) => {
    log.error('window', 'Unhandled error', {
      error: describeError(event.error ?? event.message),
      source: event.filename,
      line: event.lineno,
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    log.error('window', 'Unhandled promise rejection', { error: describeError(event.reason) });
  };

  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
