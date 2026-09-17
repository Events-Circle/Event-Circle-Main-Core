export type UUID = string;
export type Identity = { userId: UUID; sessionId: UUID };
export type ModuleId =
  | 'presence'
  | 'content'
  | 'promotions'
  | 'leads'
  | 'hosted-events'
  | 'insights'
  | 'circle-ai'
  | 'connections-automation';
