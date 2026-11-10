import { describe, expect, test } from 'bun:test';
import { parseBundleRef } from './fetch-bundle';

describe('bundle ref parsing', () => {
  test('splits a published reference into registry, repository and tag', () => {
    expect(parseBundleRef('ghcr.io/oparish1/opa-service/authz-bundle:0.1.0')).toEqual({
      registry: 'ghcr.io',
      repository: 'oparish1/opa-service/authz-bundle',
      tag: '0.1.0',
    });
  });

  test('rejects a reference missing a registry, repository or tag', () => {
    for (const ref of [
      'authz-bundle:0.1.0',
      'ghcr.io/oparish1/opa-service/authz-bundle',
      'ghcr.io/:0.1.0',
      'ghcr.io/repo:',
    ]) {
      expect(() => parseBundleRef(ref), ref).toThrow();
    }
  });
});
