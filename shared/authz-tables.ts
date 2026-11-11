/**
 * The static tables the shared authz policy ships. Each name is both the
 * `authz-service/authz/<name>.json` file the bundle build reads and the
 * `data.authz.<name>` key it merges, so the producer and the bundle cannot
 * drift on the set.
 */
export const AUTHZ_TABLE_NAMES = ['catalogue', 'roles', 'role_map', 'routes'] as const;
