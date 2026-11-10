import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Provisions the published, signed policy bundle into a file OPA can load with
 * `--bundle`. The bundle is an OCI artifact in GHCR; this resolves it with an
 * anonymous pull token and writes its gzip layer to AUTHZ_BUNDLE_OUT. OPA
 * verifies the signature itself, so nothing here trusts the payload.
 */

const DEFAULT_REF = 'ghcr.io/oparish1/opa-service/authz-bundle:0.1.0';
const DEFAULT_OUT = '/bundles/authz-bundle.tar.gz';

export interface BundleRef {
  registry: string;
  repository: string;
  tag: string;
}

export function parseBundleRef(ref: string): BundleRef {
  const slash = ref.indexOf('/');
  const colon = ref.lastIndexOf(':');
  if (slash < 1 || colon < slash + 2 || colon === ref.length - 1) {
    throw new Error(`invalid bundle ref "${ref}"; expected <registry>/<repository>:<tag>`);
  }
  return {
    registry: ref.slice(0, slash),
    repository: ref.slice(slash + 1, colon),
    tag: ref.slice(colon + 1),
  };
}

interface Descriptor {
  mediaType?: string;
  digest: string;
}

interface OciManifest {
  mediaType?: string;
  layers?: Descriptor[];
  manifests?: Descriptor[];
}

const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
].join(', ');

async function pullToken(ref: BundleRef): Promise<string> {
  const response = await fetch(
    `https://${ref.registry}/token?scope=repository:${ref.repository}:pull`
  );
  if (!response.ok) {
    throw new Error(`token request failed: ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as { token?: string; access_token?: string };
  const token = body.token ?? body.access_token;
  if (!token) throw new Error('token response carried no token');
  return token;
}

async function fetchManifest(
  ref: BundleRef,
  token: string,
  reference: string
): Promise<OciManifest> {
  const response = await fetch(
    `https://${ref.registry}/v2/${ref.repository}/manifests/${reference}`,
    { headers: { authorization: `Bearer ${token}`, accept: MANIFEST_ACCEPT } }
  );
  if (!response.ok) {
    throw new Error(`manifest request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as OciManifest;
}

async function resolveBundleManifest(ref: BundleRef, token: string): Promise<OciManifest> {
  const manifest = await fetchManifest(ref, token, ref.tag);
  // The bundle payload is platform-independent, so an index's first child is
  // the manifest that carries the layer.
  if (manifest.manifests?.length) {
    return fetchManifest(ref, token, manifest.manifests[0]!.digest);
  }
  return manifest;
}

function bundleLayer(manifest: OciManifest): Descriptor {
  const layer = manifest.layers?.find(candidate => candidate.mediaType?.includes('gzip'));
  if (!layer) throw new Error('the bundle manifest carries no gzip layer');
  return layer;
}

export async function fetchBundle(ref: BundleRef, out: string): Promise<void> {
  const token = await pullToken(ref);
  const layer = bundleLayer(await resolveBundleManifest(ref, token));
  const response = await fetch(
    `https://${ref.registry}/v2/${ref.repository}/blobs/${layer.digest}`,
    { headers: { authorization: `Bearer ${token}` }, redirect: 'follow' }
  );
  if (!response.ok) {
    throw new Error(`blob request failed: ${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, bytes);
}

if (import.meta.main) {
  try {
    await fetchBundle(
      parseBundleRef(process.env.AUTHZ_BUNDLE_REF ?? DEFAULT_REF),
      process.env.AUTHZ_BUNDLE_OUT ?? DEFAULT_OUT
    );
  } catch (error) {
    console.error(`bundle fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
