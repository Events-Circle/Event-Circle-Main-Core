import createClient from 'openapi-fetch';
import type { paths } from './openapi.js';
export const createApiClient = (baseUrl: string, accessToken?: string) =>
  createClient<paths>({
    baseUrl,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
export type { paths } from './openapi.js';
