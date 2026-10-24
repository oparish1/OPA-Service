import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { RouteOptions } from 'fastify';
import { createRouteInventory } from '../src/core/routes/inventory';
import { createTestHarness } from './helpers/harness';
import type { Harness } from './helpers/harness';
import { createTestIdp } from '../src/core/testing';
import type { TestIdp } from '../src/core/testing';

let idp: TestIdp;
let harness: Harness;

beforeEach(async () => {
  idp = createTestIdp();
  await idp.start();
  harness = await createTestHarness({ idp });
});

afterEach(async () => {
  await harness.app.close();
  harness.store.close();
  idp.stop();
});

describe('route inventory (A10)', () => {
  it('registers no unguarded non-static route', () => {
    expect(harness.inventory.unguarded()).toEqual([]);
  });

  it('declares auth and scope on the protected routes', () => {
    const me = harness.inventory.routes.find(route => route.url === '/v1/me');
    const projects = harness.inventory.routes.find(route => route.url === '/v1/projects');
    expect(me?.auth).toBe('required');
    expect(me?.scope).toBe('profile.read');
    expect(projects?.auth).toBe('required');
    expect(projects?.scope).toBe('projects.read');
  });

  it('declares the request runner as requiring auth', () => {
    const runner = harness.inventory.routes.find(route => route.url === '/api/request-runner');
    expect(runner?.auth).toBe('required');
    expect(runner?.method).toBe('POST');
  });

  it('flags a deliberately unguarded route', () => {
    const inventory = createRouteInventory();
    inventory.onRoute({ method: 'GET', url: '/unguarded' } as unknown as RouteOptions);
    expect(inventory.unguarded()).toHaveLength(1);
  });

  it('returns 401 for /v1/me and /v1/projects without a session or bearer token', async () => {
    expect((await harness.app.inject({ method: 'GET', url: '/v1/me' })).statusCode).toBe(401);
    expect((await harness.app.inject({ method: 'GET', url: '/v1/projects' })).statusCode).toBe(401);
  });
});
