import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { RUNNER_AUTH_VALUES, relayRequest } from '../request-runner';
import type { RelayOutcome, RunnerAuth, RunnerErrorCode } from '../request-runner';
import type { Services } from '../services';

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

const bodySchema = z.object({
  url: z.string().min(1),
  auth: z.enum(RUNNER_AUTH_VALUES),
});

const FAILURE_STATUS: Record<RunnerErrorCode, number> = {
  invalid_url: 400,
  blocked_host: 400,
  session_token_not_allowed_for_host: 400,
  request_timeout: 504,
  request_failed: 502,
};

function targetParts(url: string): { host: string; path: string } | null {
  try {
    const parsed = new URL(url);
    return { host: parsed.host, path: parsed.pathname };
  } catch {
    return null;
  }
}

function baseMetadata(url: string, auth: RunnerAuth): Record<string, string | number | boolean> {
  const metadata: Record<string, string | number | boolean> = { auth };
  const parts = targetParts(url);
  if (parts) {
    metadata.host = parts.host;
    metadata.path = parts.path;
  }
  return metadata;
}

export function registerRequestRunnerRoutes(
  app: FastifyInstance,
  services: Services,
  csrf: PreHandler
): void {
  const { config, store, cipher, audit } = services;

  app.post(
    '/api/request-runner',
    {
      config: {
        auth: 'required',
        rateLimit: { max: config.rateLimitRequestRunner, timeWindow: '1 minute' },
      },
      preHandler: csrf,
    },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth?.sessionId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const parsed = bodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_request' });
      }
      const { url, auth: authOption } = parsed.data;

      let sessionToken: string | undefined;
      if (authOption === 'session') {
        const tokens = store.getTokens(auth.sessionId);
        if (tokens) sessionToken = cipher.open(tokens.accessTokenEnc);
      }

      const outcome: RelayOutcome = await relayRequest({
        url,
        auth: authOption,
        sessionToken,
        allowedHosts: config.requestRunnerAllowedHosts,
        ownOrigin: config.publicBaseUrl,
      });
      const metadata = baseMetadata(url, authOption);
      if (outcome.durationMs !== undefined) metadata.durationMs = outcome.durationMs;

      if ('error' in outcome) {
        audit.record({
          event: 'request.runner',
          outcome: 'failure',
          actorOid: auth.oid || null,
          actorTid: auth.tid || null,
          provider: auth.provider,
          subject: auth.subject,
          sessionId: auth.sessionId,
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
          metadata,
        });
        return reply.code(FAILURE_STATUS[outcome.error]).send(outcome);
      }

      metadata.status = outcome.status;
      audit.record({
        event: 'request.runner',
        outcome: 'success',
        actorOid: auth.oid || null,
        actorTid: auth.tid || null,
        provider: auth.provider,
        subject: auth.subject,
        sessionId: auth.sessionId,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
        metadata,
      });
      return reply.send(outcome);
    }
  );
}
