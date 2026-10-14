import type { FastifyInstance } from 'fastify';
import type { Services } from '../services';

const PROJECTS = {
  projects: [
    { id: 'prj_01', name: 'Atlas', status: 'active' },
    { id: 'prj_02', name: 'Beacon', status: 'active' },
    { id: 'prj_03', name: 'Cedar', status: 'archived' },
  ],
};

export function registerV1Routes(app: FastifyInstance, services: Services): void {
  const { store } = services;

  app.get(
    '/v1/me',
    { config: { auth: 'required', scope: 'profile.read' } },
    async request => {
      const auth = request.auth;
      const user = auth?.userId ? store.getUserById(auth.userId) : null;
      return {
        id: `usr_${user?.oid ?? auth?.oid ?? ''}`,
        display_name: user?.displayName ?? '',
        email: user?.email ?? '',
        organisation: user?.organisation ?? 'Agentic Advantage',
        role: 'developer',
        permissions: ['profile.read', 'projects.read'],
      };
    }
  );

  app.get(
    '/v1/projects',
    { config: { auth: 'required', scope: 'projects.read' } },
    async () => PROJECTS
  );
}
