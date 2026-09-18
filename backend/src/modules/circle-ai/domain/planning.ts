export const actionKinds = [
  'GROW_LEADS',
  'PLAN_WEEK',
  'REPLY_LEADS',
  'CREATE_POST',
  'PROMOTE_LISTING',
  'GENERAL',
] as const;
export type ActionKind = (typeof actionKinds)[number];
/** Transparent, deterministic intake. This is not an LLM response or an executed action. */
export function preparePlan(prompt: string, kind: ActionKind) {
  const prerequisites: Record<ActionKind, string> = {
    GROW_LEADS: 'Leads analytics, approved supplier context and a configured AI provider',
    PLAN_WEEK: 'Content Studio, channel connections and a configured AI provider',
    REPLY_LEADS: 'A selected lead, messaging permission, a delivery connection and a configured AI provider',
    CREATE_POST: 'Content Studio, approved media, a connected channel and a configured AI provider',
    PROMOTE_LISTING: 'A published listing, Promotions, an ad account and explicit budget approval',
    GENERAL: 'A configured Core AI provider and approved business context',
  };
  return {
    title: {
      GROW_LEADS: 'Lead growth plan',
      PLAN_WEEK: 'Weekly content plan',
      REPLY_LEADS: 'Lead reply plan',
      CREATE_POST: 'Social post plan',
      PROMOTE_LISTING: 'Campaign plan',
      GENERAL: 'Business assistance',
    }[kind],
    response: `Your request has been saved for planning. Required before execution: ${prerequisites[kind]}. Nothing has been generated, sent, scheduled, published or purchased.`,
    draft: prompt,
    blockedReason: prerequisites[kind],
  };
}
