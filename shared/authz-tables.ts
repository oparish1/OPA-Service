/**
 * The static tables the shared authz policy ships. Each name is both the
 * `authz/<name>.json` contract file and the `data.authz.<name>` key the browser
 * supplies beside its runtime config, so the contract and the bundle cannot
 * drift on the set.
 */
export const AUTHZ_TABLE_NAMES = ['catalogue', 'roles', 'role_map', 'routes'] as const;
