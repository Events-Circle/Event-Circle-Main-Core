import { readFile } from 'node:fs/promises';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { importPKCS8, importSPKI, exportJWK, SignJWT, jwtVerify } from 'jose';
import type { Config } from './config.js';
import { identifier, type Identity } from '../contracts/index.js';
import { HttpError } from './http.js';

const scrypt = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scryptCallback(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt-v1:${salt}:${(await scrypt(password, salt)).toString('hex')}`;
}
export async function checkPassword(password: string, encoded: string) {
  const [version, salt, value] = encoded.split(':');
  if (version !== 'scrypt-v1' || !salt || !value || !/^[a-f0-9]{128}$/.test(value)) return false;
  return timingSafeEqual(await scrypt(password, salt), Buffer.from(value, 'hex'));
}
export const opaqueToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function bearer(header: string | undefined) {
  if (!header?.startsWith('Bearer ') || header.length > 4096) throw new HttpError(401, 'UNAUTHORIZED');
  return header.slice(7);
}
export async function verifier(config: Config) {
  const key = await importSPKI(await readFile(config.JWT_PUBLIC_KEY_PATH, 'utf8'), 'EdDSA');
  const verify = async (token: string): Promise<Identity> => {
    try {
      const { payload, protectedHeader } = await jwtVerify(token, key, {
        issuer: config.JWT_ISSUER, audience: config.JWT_AUDIENCE, algorithms: ['EdDSA'],
        requiredClaims: ['exp', 'iat', 'sub', 'sid'], maxTokenAge: '10m',
      });
      if (protectedHeader.typ !== 'at+jwt' || protectedHeader.kid !== config.JWT_KEY_ID) throw new Error('Invalid token');
      return { userId: identifier.parse(payload.sub), sessionId: identifier.parse(payload.sid) };
    } catch { throw new HttpError(401, 'UNAUTHORIZED'); }
  };
  return { verify, jwks: { keys: [{ ...await exportJWK(key), kid: config.JWT_KEY_ID, use: 'sig', alg: 'EdDSA' }] } };
}
export async function issuer(config: Config) {
  if (!config.JWT_PRIVATE_KEY_PATH) throw new Error('JWT_PRIVATE_KEY_PATH is required for Core');
  const key = await importPKCS8(await readFile(config.JWT_PRIVATE_KEY_PATH, 'utf8'), 'EdDSA');
  const publicPart = await verifier(config);
  return {
    ...publicPart,
    sign: (identity: Identity) => new SignJWT({ sid: identity.sessionId })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'at+jwt', kid: config.JWT_KEY_ID })
      .setSubject(identity.userId).setIssuer(config.JWT_ISSUER).setAudience(config.JWT_AUDIENCE)
      .setIssuedAt().setExpirationTime('10m').sign(key),
  };
}
