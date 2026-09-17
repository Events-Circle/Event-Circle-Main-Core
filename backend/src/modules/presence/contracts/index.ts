import { eventNames } from '@events-circle/contracts';
export const presenceEvents = { updated: eventNames.presenceUpdated } as const;
export const PRESENCE_QUERIES = Symbol('PRESENCE_QUERIES');
export type { PresenceQueries } from '@events-circle/contracts';
