/** Coerces a raw claim value to a string; anything that is not a string is empty. */
export function claimString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
