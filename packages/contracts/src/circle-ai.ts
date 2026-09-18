/** Planning decisions never authorize external execution. No prompt or lead PII in events. */
export interface CircleAiPlanCreated {
  planId: string;
  kind: string;
}
export interface CircleAiPlanEdited {
  planId: string;
}
export interface CircleAiPlanDecided {
  planId: string;
  decision: 'APPROVED' | 'REJECTED';
}
export const circleAiEventNames = {
  created: 'circle-ai.plan.created.v1',
  edited: 'circle-ai.plan.edited.v1',
  decided: 'circle-ai.plan.decided.v1',
} as const;
