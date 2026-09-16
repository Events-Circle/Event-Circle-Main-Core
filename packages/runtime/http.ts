import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import type { Config } from './config.js';

export class HttpError extends Error {
  constructor(public statusCode: number, public code: string) { super(code); }
}
export async function httpServer(config: Config, service: string, ready: () => Promise<unknown>) {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : {
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
      serializers: { req: req => ({ method: req.method, path: req.url?.split('?')[0], remoteAddress: req.ip }) },
    },
    bodyLimit: 16 * 1024,
    trustProxy: config.TRUST_PROXY_CIDRS ? config.TRUST_PROXY_CIDRS.split(',') : false,
    requestTimeout: 15000,
  });
  await app.register(helmet);
  await app.register(cors, { origin: config.CORS_ORIGINS.split(',').filter(Boolean), credentials: false });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  app.addHook('onSend', async (_req, reply, payload) => { reply.header('Cache-Control', 'no-store'); return payload; });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: 'VALIDATION_ERROR', requestId: request.id });
    if (error instanceof HttpError) return reply.code(error.statusCode).send({ error: error.code, requestId: request.id });
    const e = error as { code?: string; statusCode?: number };
    if (e.code === 'P2002') return reply.code(409).send({ error: 'CONFLICT', requestId: request.id });
    if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500) {
      return reply.code(e.statusCode).send({ error: 'REQUEST_REJECTED', requestId: request.id });
    }
    // Avoid logging ORM query parameters or user-supplied data on failures.
    request.log.error({ code: e.code ?? 'INTERNAL_ERROR', requestId: request.id }, 'Request failed');
    return reply.code(500).send({ error: 'INTERNAL_ERROR', requestId: request.id });
  });
  app.get('/health/live', async () => ({ status: 'ok', service }));
  app.get('/health/ready', async (_req, reply) => {
    try { await ready(); return { status: 'ready', service }; }
    catch { return reply.code(503).send({ status: 'unavailable', service }); }
  });
  return app;
}
export async function listen(app: FastifyInstance, port: number, host: string) {
  const shutdown = async () => { await app.close(); process.exit(0); };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  await app.listen({ port, host });
}
