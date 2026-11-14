/** Claim coercion shared by the provider authz modules; no provider id is named here. */

export function claimString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function claimStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/** Splits a library's space-delimited scope string into non-empty entries. */
export function claimScopes(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}
