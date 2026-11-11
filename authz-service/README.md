# authz-service

The standalone authorization policy. It owns the shared Rego engine, the
capability/role/route data tables and the versioned `authz.v1` API. The gateway
pulls the signed bundle published from this service and answers the browser's
capability call; repointing the backend OPA is child `#4`.

## Layout

- `authz/` — the shared engine (`authz.rego`), the provider claim files under
  `providers/`, and the four static tables (`catalogue.json`, `roles.json`,
  `role_map.json`, `routes.json`). `data.json` and `input.json` are local dev
  samples; the bundle build merges only the four tables, and consumers supply
  `data.authz.config` at runtime.
- `authz/v1/` — the stable `authz.v1` entry points: `capabilities.rego` and
  `check.rego`.
- `authz/v1/gateway/` — the gateway wrapper logic, one package per provider
  (`authz.v1.gateway.<provider>`) plus the shared `authz.v1.gateway.common`
  helpers. Each wrapper keeps the gateway-only audience/issuer checks, the
  audit vocabulary and the `capabilities` rule. The gateway consumes these
  packages from the published bundle; the APISIX `opa` plugin enforces with
  `authz/v1/gateway/<provider>` and the capabilities route queries the same
  package for `authz.v1.capabilities`.
- `fixtures/` — the personas, gate cases, must-deny list and generated decision
  snapshot used by the tests and the frontend codegen.
- `test/` — the shared engine suite, the provider wrapper suites, the
  gateway↔core parity suite, the v1 entry-point suite and the test utilities.
- `keys/bundle-signing.pub` — the committed verification key for the signed
  bundle.
- `scripts/build-bundle.ts` — stages the policy, merges the tables into the
  bundle's `data.json`, signs the bundle with OPA-native ES256 and verifies it.
- `VERSION` — the current bundle version. Git tags use `authz-service/v<version>`.

## `authz.v1` contract

| Entry point | Input | Output |
| --- | --- | --- |
| `authz.v1.capabilities` | `{provider, claims}`; `data.authz.config` from the OPA data document | capability map `{<capability>: {allowed, reason}}` |
| `authz.v1.gateway.<provider>` | APISIX `input`: `input.request.{method,path,headers.authorization}`, `input.route.labels.{audience,tenant,hosted_domain}` | `allow` (bool), `headers` (`X-User-*` on allow, `X-Auth-*` on deny), `reason` (comma-joined audit reasons) |
| `authz.v1.check` | `{subject: {provider, claims}, action, resource}`; `data.authz.config` from the OPA data document | `{allowed, reason}` |

The gateway-only audience and issuer checks stay inside
`authz.v1.gateway.<provider>`, exactly as they were in the old wrappers.
`authz.v1.check` maps `action` (an HTTP method) and `resource` (a request path)
through the shared route table, so it inherits the existing method/route guards.
It fails closed: an undefined capability or decision returns `allowed: false`
with an empty reason. The finer `subject`/`action`/`resource` vocabulary is
owned by child `#4`; this issue fixes the shape so the entry point and its
contract can be tested and published.

## Versioning and publishing

- `authz.v1` is the API package version. A breaking API change becomes
  `authz.v2` and a bundle major release.
- Publish on a Git tag matching `authz-service/v*`. The tag suffix is the
  version and is written to the bundle revision.
- The bundle is an OCI artifact pushed to
  `ghcr.io/<owner>/opa-service/authz-bundle:<version>` by the
  `.github/workflows/authz-service-checks.yml` publish job. It runs only for
  `authz-service/v*` tags after the checks job passes.

## Build, sign and verify locally

```sh
# Throwaway key pair; never commit the private key.
openssl ecparam -name prime256v1 -genkey -noout -out /tmp/authz-signing.pem
openssl ec -in /tmp/authz-signing.pem -pubout -out /tmp/authz-signing.pub

bun run authz-service/scripts/build-bundle.ts \
  --signing-key /tmp/authz-signing.pem \
  --verification-key /tmp/authz-signing.pub \
  --revision 0.2.1 \
  --out /tmp/authz-bundle.tar.gz
```

The script stages `authz-service/authz`, merges the four table files into the
staged `authz/data.json`, builds and signs the bundle with OPA-native ES256,
verifies the signature against the supplied public key and asserts that every
shared table is present and no environment config (`data.authz.config`) was
baked in. A successful run prints the bundle path, revision and capability
count.

To publish locally against a registry:

```sh
oras login ghcr.io -u <user>
oras push --artifact-type application/vnd.opa.bundle.v1+json \
  ghcr.io/<owner>/opa-service/authz-bundle:0.2.1 \
  /tmp/authz-bundle.tar.gz:application/vnd.opa.bundle.layer.v1+gzip
```

## Signing-key management

- **Generation.** The production key is an EC P-256 key pair:
  `openssl ecparam -name prime256v1 -genkey -noout -out /tmp/private.pem` and
  `openssl ec -in /tmp/private.pem -pubout -out authz-service/keys/bundle-signing.pub`.
  The private PEM is never committed; the matching public PEM is.
- **Storage.** The private PEM lives in the GitHub Actions secret
  `AUTHZ_BUNDLE_SIGNING_KEY`. The publish workflow writes it to a temporary file,
  builds the bundle, and deletes the file in an `always()` step. The committed
  public key is what consumers and CI verify against.
- **Rotation.** Generate a new P-256 pair. Replace the public key at
  `authz-service/keys/bundle-signing.pub` (or point the workflow's
  `--verification-key` at the new key file), publish a bundle signed with the
  new private key, ship the updated verification key to consumers, then remove
  the old key from consumers. Replace the `AUTHZ_BUNDLE_SIGNING_KEY` secret only
  when the new key is ready to sign.

## Checks

From the repository root:

```sh
opa fmt --fail --list authz-service
opa check --strict authz-service
opa test authz-service -v --timeout 60s
bun run frontend/scripts/authz-codegen.ts check
```

The `opa test` command is the acceptance command for the folder. The codegen
check regenerates the frontend types and persona snapshot in memory and fails
when either is stale.
