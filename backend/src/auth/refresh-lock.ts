/**
 * Serialises refreshes per session. A rotating refresh token is single-use, so
 * two concurrent refreshes for one session would make the second present a token
 * the provider has already invalidated and trigger reuse detection.
 */
const locks = new Map<string, Promise<unknown>>();

export async function withSessionRefreshLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const result = previous.then(() => fn());
  const tail = result.then(
    () => undefined,
    () => undefined
  );
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return result;
}