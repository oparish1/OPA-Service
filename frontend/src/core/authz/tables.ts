/**
 * The static tables the shared policy ships. Each name is both the
 * `policy/authz/<name>.json` file the build script reads and the
 * `data.authz.<name>` key the browser loader validates, so the producer and the
 * consumer cannot drift on the set.
 */
export const AUTHZ_TABLE_NAMES = ['catalogue', 'roles', 'role_map', 'routes'] as const;
