export function swallow(): void {
  try {
    throw new Error('boom');
  } catch {
    // This fixture must fail the catch-handling check.
  }
}
