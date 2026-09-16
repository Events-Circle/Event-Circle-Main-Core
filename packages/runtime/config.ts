import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  CORE_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  GROWTH_PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  JWT_ISSUER: z.url(),
  JWT_AUDIENCE: z.string().min(1),
  JWT_KEY_ID: z.string().min(1),
  JWT_PUBLIC_KEY_PATH: z.string().min(1),
  JWT_PRIVATE_KEY_PATH: z.string().optional(),
  CORE_API_URL: z.url().optional(),
  CORS_ORIGINS: z.string().default(''),
  TRUST_PROXY_CIDRS: z.string().default(''),
});
export type Config = z.infer<typeof schema>;
export function configuration(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) throw new Error(`Invalid configuration: ${parsed.error.issues.map(i => i.path.join('.')).join(', ')}`);
  const c = parsed.data;
  if (c.CORS_ORIGINS.split(',').includes('*') || ['true', '*'].includes(c.TRUST_PROXY_CIDRS)) {
    throw new Error('Explicit CORS origins and trusted proxy CIDRs are required');
  }
  for (const origin of c.CORS_ORIGINS.split(',').filter(Boolean)) {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid CORS origin');
    if (c.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('Production CORS requires HTTPS');
  }
  if (c.NODE_ENV === 'production' && !c.JWT_ISSUER.startsWith('https://')) throw new Error('Production issuer requires HTTPS');
  return c;
}
