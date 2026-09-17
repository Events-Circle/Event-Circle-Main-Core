import growthOs from './editions/growth-os.js';
import presence from './editions/circle-presence.js';
import leads from './editions/circle-leads.js';
export type Runtime = {
  nodeEnv: string;
  host: string;
  port: number;
  issuer: string;
  audience: string;
  keyId: string;
  privateKeyPath: string;
  publicKeyPath: string;
  cors: string[];
  trustProxy: string[];
  edition: string;
  enabled: string[];
};
export const availableModules = ['presence', 'leads'] as const;
export const moduleCatalog = [
  'presence',
  'content',
  'promotions',
  'leads',
  'hosted-events',
  'insights',
  'circle-ai',
  'connections-automation',
] as const;
export function runtime(env: NodeJS.ProcessEnv = process.env): Runtime {
  const required = (name: string) => {
    const value = env[name];
    if (!value) throw new Error(`Missing configuration: ${name}`);
    return value;
  };
  const edition = env.EDITION ?? 'growth-os';
  const editions: Record<string, readonly string[]> = Object.fromEntries(
    [growthOs, presence, leads].map((e) => [e.id, e.modules]),
  );
  const allowed = editions[edition];
  if (!allowed) throw new Error('Edition is not implemented');
  const enabled =
    env.ENABLED_MODULES === undefined ? [...allowed] : env.ENABLED_MODULES.split(',').filter(Boolean);
  if (new Set(enabled).size !== enabled.length || enabled.some((id) => !allowed.includes(id)))
    throw new Error('Invalid or unavailable edition module');
  const cors = (env.CORS_ORIGINS ?? '').split(',').filter(Boolean);
  const trustProxy = (env.TRUST_PROXY_CIDRS ?? '').split(',').filter(Boolean);
  if (trustProxy.some((value) => ['true', '*', '0.0.0.0/0', '::/0'].includes(value)))
    throw new Error('Explicit trusted proxy addresses required');
  const issuer = required('JWT_ISSUER');
  new URL(issuer);
  const production = env.NODE_ENV === 'production';
  for (const origin of cors)
    if (new URL(origin).origin !== origin || (production && !origin.startsWith('https://')))
      throw new Error('Invalid CORS origin');
  if (production && !issuer.startsWith('https://')) throw new Error('HTTPS issuer required');
  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    host: env.HOST ?? '127.0.0.1',
    port,
    issuer,
    audience: required('JWT_AUDIENCE'),
    keyId: required('JWT_KEY_ID'),
    privateKeyPath: required('JWT_PRIVATE_KEY_PATH'),
    publicKeyPath: required('JWT_PUBLIC_KEY_PATH'),
    cors,
    trustProxy,
    edition,
    enabled,
  };
}
export const RUNTIME = Symbol('RUNTIME');
