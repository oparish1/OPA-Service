/**
 * The static tables the shared authz policy ships. Each name is both the
 * `authz-service/authz/<name>.json` file the WASM and bundle build scripts read
 * and the `data.authz.<name>` key the browser loader validates, so the producer
 * and the consumer cannot drift on the set.
 */
export const AUTHZ_TABLE_NAMES = ['catalogue', 'roles', 'role_map', 'routes'] as const;
