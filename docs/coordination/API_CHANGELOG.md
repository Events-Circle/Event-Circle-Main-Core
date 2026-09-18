# API changelog

## Presence image V1 expansion

- Core media multipart upload and scoped reads; category/location catalogs; optional supplier catalog IDs and private contacts.
- Presence profile brand/SEO/social/hours/contact visibility; publication/readiness endpoints. New publication requires a processed owned logo; legacy published rows are preserved on migration but subsequent publication writes require readiness.
- Portfolio/listing/gallery CRUD, archive/restore, publication, pagination and optimistic ordering under `/presence/collections/:collection`; public counterparts, media and share endpoints.
- Shared query port and additive lifecycle events. Existing updated event stays compatible.
- See `docs/presence-backend-handoff.md` for full field/state/error semantics.

## 2026-09-17 Presence domain/contracts increment

- Add shared lifecycle, pricing, readiness and planned event/query contracts. Preserve the existing profile-updated V1 event and payload.
- No new HTTP endpoints or changes to current profile behavior. Domain rules and the Core media port are preparation for the expanded backend; their types do not indicate live implementations.
- Frontend implementation is scheduled for a separate module repository after backend contract acceptance. See `docs/presence-backend-plan.md`.

## 2026-09-17 audit repairs

- Leads, sessions, consents, subscriptions and notifications retain array responses and now accept `limit` (1-100) and `cursor` UUID. Read `X-Next-Cursor` for the next page; absent means end. Invalid or foreign-scope cursors return 400. CORS exposes the header.
- Lead response DTO now explicitly includes nullable email/phone/campaign and createdAt/updatedAt timestamps. Request fields remain independently validated.
- Blank supplier/profile/lead/consent text and punctuation-only phone numbers now return 400; supported input is trimmed. Phone policy: 7-15 digits, optional leading + and formatting separators, up to 30 characters.
- API request correlation is persisted in new audit entries and outbox rows. No API action enables external event consumers.

## 0.2.0 — 2026-09-16 (breaking, pre-release)

- One API at port 4000 replaces Core 4000 and Growth 4001.
- `/v1/auth/*` and account routes move under `/api/v1/core`.
- Supplier canonical identity moves into Core; creation returns supplier and organization IDs. Ownership uses membership and X-Organization-Id.
- Presentation routes move under `/api/v1/presence`; Leads under `/api/v1/leads`.
- Public inquiry addresses supplier UUID and requires consent version; it works without Presence enabled.
- Lead list returns a bounded array; stage patch returns updated lead. Update clients rather than assuming prior response envelopes.
- Generated OpenAPI types replace the earlier hand-written Fastify contracts. Namespace entitlements as presence.* and leads.*.
- Old routes and the context-copy script are removed. Monorepo shared packages replace copied backend contexts.

Regenerate OpenAPI and api-client declarations with every API change. Coordinate consumer changes in the same PR.

## 2026-09-18 — Presence package pricing (Step 3)

Presence listing writes accept optional `priceUnit` (`EVENT`, `HOUR`, `PERSON`, `PACKAGE`, `ITEM`, `TOTAL`, or null), ordered `inclusions` (up to 20 distinct, nonblank strings of up to 200 characters), and `pricingNote` (up to 500 characters). Management and public listing responses include these fields. They belong to Presence, not shared supplier identity or billing.

The additive migration leaves existing units unspecified, with empty inclusions/notes. Omitted new fields preserve existing values; explicit null clears the unit, [] clears inclusions, and an empty string clears the note. Quote/free modes clear the stored unit and reject an explicitly supplied non-null unit. Portfolio/gallery writes reject listing-only fields. Existing tenant checks, version conflicts, publication readiness, and public visibility remain authoritative. These are advertised prices, not checkout or booking functionality.

Validation: all 44 backend tests pass, including migrations, ordered inclusion normalization, bounds, rejection of duplicate/invalid values, old-client preservation, explicit clearing, stale versions and public responses.
