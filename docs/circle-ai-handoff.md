# Circle AI — first vertical slice

Source requirements: project architecture PDFs and supplied Circle AI image. Image data informs scope, not its styling or sample metrics. Module frontend: Events-Circle/Circle-AI. Authentication continues to use Core; Presence is unchanged.

## Implemented

- Authenticated organization-scoped planning request intake with caller-provided deduplication UUID. Reusing a UUID with a different body or actor is rejected.
- Saved prompt, transparent deterministic acknowledgement, editable plan draft, versioned owner approval/rejection, cursor history, all-time planning counts.
- OWNER reads/writes/approves; EDITOR reads/writes; VIEWER reads. Permission checks are performed on every request. Foreign IDs are 404.
- Business changes, audit and versioned outbox events share a transaction. No prompt/contact text appears in event payloads. New private table has RLS, browser-role revocation and restrictive Core foreign keys.
- Core-only, Circle-AI-only and Growth OS composition. Existing Presence/Leads compositions unchanged.

## Not implemented or claimed

This is NOT a functioning generative AI service. No model or API key is selected. Request acknowledgements are deterministic and explicitly labelled as planning intake. No fabricated lead metrics, generated posts, campaign reach estimates, completed replies or scheduled posts. Approving a plan does not execute it. There are no external consumers for these events.

Business Brain remains a shared Core capability to implement behind the AI gateway; do not duplicate it in Circle AI. Next slice needs an approved model/provider, server-side key, cost/retention controls, per-organization business context, safe structured outputs and provider timeout/error tests. Never expose keys in EXPO_PUBLIC variables.

Daily lead summaries and qualified counts need a Leads public query contract; campaign and publishing data need their owning modules. Content, Promotions and Connections must expose permission-checked execution contracts before Circle AI can invoke them. Add idempotent execution, exact resource/budget approval, immutable approval snapshots, expiry, retries and monitoring before enabling side effects. Do not reinterpret these planning approvals as authority to execute future campaigns.

## API

All paths under /api/v1/circle-ai, token plus X-Organization-Id required:

- GET brief: honest capability flags and all-time counts, not daily lead analytics.
- GET plans: limit/cursor, X-Next-Cursor.
- POST plans: requestId UUID, kind, prompt (1–4000 characters).
- PATCH plans/:id: version and draft; only DRAFT records.
- POST plans/:id/decision: version and APPROVED/REJECTED; owner only.

Generate backend/openapi.json and packages/api-client/src/openapi.d.ts together. Frontend pins both from the same reviewed commit; moving main is never fetched during builds.

## Deployment and coordination

Core changes are on a feature branch to avoid concurrent Presence work. Review and merge before deploying. Apply committed migration using the existing server role. Append circle-ai to an explicitly configured ENABLED_MODULES only after migration. No production/staging database has been altered by authoring this branch. Current existing API without the new module returns a clear unavailable state in the frontend.

Circle-AI uses a distinct package/bundle identifier and must be linked to its own EAS project, not Presence's project. Same Core accounts do not imply shared secure storage between separately installed apps. Native-device verification and browser CORS approval are separate gates.
