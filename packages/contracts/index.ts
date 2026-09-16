import { z } from 'zod';

export const identifier = z.uuid();
export const email = z.email().max(254).transform(value => value.toLowerCase());
export const credentials = z.object({ email, password: z.string().min(12).max(128) }).strict();
export const registration = credentials.extend({ displayName: z.string().trim().min(1).max(100) });
export const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
}).strict();
export const leadStages = ['NEW', 'HOT', 'FOLLOW_UP', 'QUALIFIED', 'WON', 'LOST'] as const;
export const freeFeatures = ['growth:presence', 'growth:leads'] as const;
export type Identity = { userId: string; sessionId: string };
export type Access = { userId: string; features: string[] };
export type TokenPair = { accessToken: string; refreshToken: string; tokenType: 'Bearer'; expiresIn: number };
