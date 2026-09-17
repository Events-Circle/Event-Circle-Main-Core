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
  outboxWorkerEnabled?: boolean;
  storageUrl?: string;
  storageAccessKeyId?: string;
  storageSecretAccessKey?: string;
  storageRegion?: string;
  storageForcePathStyle?: boolean;
  storageBucket?: string;
  publicWebUrl?: string;
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
  if (env.OUTBOX_WORKER_ENABLED !== undefined && !['true', 'false'].includes(env.OUTBOX_WORKER_ENABLED))
    throw new Error('Invalid OUTBOX_WORKER_ENABLED');
  for (const origin of cors)
    if (new URL(origin).origin !== origin || (production && !origin.startsWith('https://')))
      throw new Error('Invalid CORS origin');
  if (production && !issuer.startsWith('https://')) throw new Error('HTTPS issuer required');
  const port = Number(env.PORT ?? 4000);
  const storageValues = [
    env.STORAGE_URL,
    env.STORAGE_ACCESS_KEY_ID,
    env.STORAGE_SECRET_ACCESS_KEY,
    env.STORAGE_BUCKET,
    env.STORAGE_REGION,
  ];
  if (storageValues.some(Boolean) && !storageValues.every(Boolean))
    throw new Error('Incomplete media configuration');
  if (env.STORAGE_KEY) throw new Error('Legacy STORAGE_KEY is unsupported; configure Railway S3 credentials');
  if (env.STORAGE_URL) {
    const url = new URL(env.STORAGE_URL);
    if (url.protocol !== 'https:' || url.origin !== env.STORAGE_URL || url.username || url.password)
      throw new Error('Invalid STORAGE_URL');
  }
  if (env.STORAGE_BUCKET && !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(env.STORAGE_BUCKET))
    throw new Error('Invalid STORAGE_BUCKET');
  if (env.STORAGE_FORCE_PATH_STYLE !== undefined && !['true', 'false'].includes(env.STORAGE_FORCE_PATH_STYLE))
    throw new Error('Invalid STORAGE_FORCE_PATH_STYLE');
  if (
    env.PUBLIC_WEB_URL &&
    (new URL(env.PUBLIC_WEB_URL).origin !== env.PUBLIC_WEB_URL || !env.PUBLIC_WEB_URL.startsWith('https://'))
  )
    throw new Error('Invalid PUBLIC_WEB_URL');
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
    outboxWorkerEnabled: env.OUTBOX_WORKER_ENABLED === 'true',
    storageUrl: env.STORAGE_URL,
    storageAccessKeyId: env.STORAGE_ACCESS_KEY_ID,
    storageSecretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    storageRegion: env.STORAGE_REGION,
    storageForcePathStyle: env.STORAGE_FORCE_PATH_STYLE === 'true',
    storageBucket: env.STORAGE_BUCKET,
    publicWebUrl: env.PUBLIC_WEB_URL,
  };
}
export const RUNTIME = Symbol('RUNTIME');
