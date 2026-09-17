import { eventNames } from '@events-circle/contracts';
export const leadsEvents = {
  created: eventNames.leadCreated,
  stageChanged: eventNames.leadStageChanged,
} as const;
