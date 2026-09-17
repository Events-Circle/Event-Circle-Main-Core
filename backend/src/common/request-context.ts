import { AsyncLocalStorage } from 'node:async_hooks';
/** Request IDs are server-generated. Jobs reuse the persisted correlation ID. */
export const requestContext = new AsyncLocalStorage<{ correlationId: string }>();
