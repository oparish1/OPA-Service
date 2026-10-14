import type { RouteOptions } from 'fastify';
import { isStaticRoute } from '../auth/guard';

export interface RouteEntry {
  method: string | string[];
  url: string;
  auth?: 'public' | 'required';
  scope?: string;
}

export interface RouteInventory {
  routes: RouteEntry[];
  onRoute: (routeOptions: RouteOptions) => void;
  unguarded: () => RouteEntry[];
}

/** Collects every registered route so a test can prove none bypass the guard. */
export function createRouteInventory(): RouteInventory {
  const routes: RouteEntry[] = [];
  return {
    routes,
    onRoute(routeOptions) {
      if (routeOptions.method === 'HEAD') return;
      routes.push({
        method: routeOptions.method,
        url: routeOptions.url,
        auth: routeOptions.config?.auth,
        scope: routeOptions.config?.scope,
      });
    },
    unguarded() {
      return routes.filter(route => !route.auth && !isStaticRoute(route.url));
    },
  };
}
