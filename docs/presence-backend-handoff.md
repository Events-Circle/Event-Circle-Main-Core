# Presence & Portfolio backend handoff

This implements the image-based V1 backend journey in Main Core. The separate module frontend repository has **not** been created. No live database, storage bucket, hosting service, or mobile distribution account has been provisioned by this change.

## Implemented scope

- Shared Core: immutable processed image assets, organization-scoped upload/read permission, private Supabase storage adapter, small stable category/location catalog, optional canonical supplier catalog IDs and private contact fields.
- Presence: extended profile, logo/cover, tagline, social links, opening hours, SEO, section visibility/order, explicit contact visibility, profile readiness/publication; portfolios, listings, galleries; ordered media; publication/archive/restore; bounded cursor pagination; optimistic versions and atomic reorder; audit/outbox records in the same database transaction.
- Public: deliberate profile/child DTOs, six-item collection previews, paginated collections and details, publication-gated media, share URL/QR payload and module-aware Leads inquiry path. Anonymous endpoints use the existing global throttler. Profile ETags are calculated from the current aggregate; every reuse requires revalidation. Other public endpoints and media remain `no-store` so withdrawal does not leave a reusable public response.
- Core + Presence works without Leads. The CTA is present only when Leads is enabled and Core accepts inquiries. Capture remains the existing Leads endpoint and derives tenant ownership on the server.
- The existing Expo shell now exports **both Android and iOS** in CI. This verifies JavaScript bundle compatibility, not native builds, installation, or device behavior. iOS device testing and signing wait for the user's Apple Developer account.

## Routes and client behavior

All paths below are under `/api/v1`. Management requests require an access token and `X-Organization-Id`; both are checked by Core. OWNER and EDITOR may manage and publish Presence and upload media; VIEWER may read. Supplier canonical identity is still OWNER-only.

| Route                                                                   | Behavior                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| GET core/catalogs/categories, core/catalogs/locations                   | Active catalog entries; initial reviewed list is small, not an exhaustive geography                           |
| POST core/media                                                         | Multipart `file`; JPEG/PNG/WebP, 5 MB maximum, one static image                                               |
| GET core/media/:id/file                                                 | Authenticated organization-owned processed image                                                              |
| GET / PUT presence/profile                                              | Read/update profile; creation uses PUT; optional fields preserve existing values when omitted                 |
| GET presence/readiness                                                  | Machine-readable profile blockers and completion score                                                        |
| POST presence/profile/publish, presence/profile/unpublish               | Body `{version}` from GET profile                                                                             |
| GET / POST presence/collections/:collection                             | Paginated collection / create private draft                                                                   |
| GET / PUT presence/collections/:collection/:id                          | Read / replace editable content; PUT requires the current content version                                     |
| POST presence/collections/:collection/:id/publish, /unpublish, /restore | Versioned lifecycle action; restore produces DRAFT                                                            |
| DELETE presence/collections/:collection/:id                             | Versioned archive; body `{version}`; never deletes a published record's history                               |
| POST presence/collections/:collection/reorder                           | Body `{version, ids}`; profile version plus a full permutation of all collection IDs, including archived rows |
| GET presence/public/:slug                                               | Published aggregate, safe supplier identity and optional inquiryPath                                          |
| GET presence/public/:slug/collections/:collection                       | Public pagination; optional listing type filter                                                               |
| GET presence/public/:slug/collections/:collection/:id                   | Published child detail                                                                                        |
| GET presence/public/:slug/media/:id                                     | Image bytes only while referenced by visible published content or profile branding                            |
| GET presence/public/:slug/share                                         | Configured public website URL, QR payload and SEO                                                             |

`:collection` is `portfolio`, `listings`, or `gallery`. One namespaced Presence content table uses an explicit kind discriminator; application rules and SQL constraints distinguish listings. This replaces the guide's illustrative separate project/listing tables while preserving one owner and typed APIs.

Collections return arrays and `X-Next-Cursor`. `limit` is 1–100. Order is displayOrder then UUID; pagination assumes the collection is not reordered between page fetches. There is a 500-record limit per collection (including archives). After a reorder, refetch rather than continuing an old cursor. Every child mutation increments the profile version; clients must refresh that version before profile lifecycle or full reorder actions. Child PUT replaces all editable child fields, so send the complete edited form. New clients should always supply profile version on PUT too; optional version remains for old profile clients.

The generated source of truth is `backend/openapi.json` and `packages/api-client/src/openapi.d.ts`. Use media IDs returned from Core and never accept a caller's READY flag. Ordered `media` arrays carry role, altText and caption. Gallery records can group up to 50 images. Images must be owned by the current organization. Prices use integer minor units (up to PostgreSQL INT max); FREE/ON_REQUEST omit amount/currency. Offers use exclusive expiry and can be stored after expiry without appearing publicly.

Profile `published` remains a boolean for compatibility. Content has DRAFT/PUBLISHED/UNPUBLISHED/ARCHIVED states. New publication requires a processed logo, description, slug and canonical category. Existing category/city strings remain supported; known catalog labels are linked, unknown legacy strings are preserved. Catalog IDs supplied to Core must have the right kind and active status.

422 responses contain `code` and `details` (readiness uses `details.missing`) alongside the existing `error` and `requestId`. Invalid transport data is 400, stale versions/slug collisions are 409, foreign content/media IDs are 404, forbidden membership/role is 403. Clients must not parse internal error messages.

## Media and storage boundary

Core fully decodes permitted images with Sharp, caps input pixels at 20 million, rejects animation/SVG, auto-orients, strips metadata by re-encoding, and produces a WebP up to 2000×2000. Only successfully processed/stored assets get database metadata, so a stored asset represents READY. Storage keys/credentials never appear in API DTOs. Files are immutable and references have restrictive foreign keys.

V1 deliberately uses a bounded backend-mediated upload instead of the guide's eventual direct-to-storage flow. It provides real processing without trusting a browser completion flag. Video, resumable uploads, extra image variants, media deletion/retention and unreferenced-object garbage collection remain outside this image V1. A storage success followed by DB failure can leave a private unreferenced object; it cannot become public, and operators must account for cleanup/storage usage before production. No client receives permanent public bucket URLs. Existing downloaded copies cannot be revoked.

## Contracts and later repositories

Keep all module backend logic and Prisma migrations in Main Core. The module frontend repository should own reusable feature components plus a thin runnable app shell. Shared accounts, authentication behavior, navigation integration and API types must not be independently forked per module. This updates the older all-apps-in-one-repo recommendation to the user's chosen separate frontend repositories.

Build and pack `@events-circle/api-client` and `@events-circle/contracts` from the same reviewed commit for downstream installation. Their `files` allowlist includes only built distributions; no backend internals or secrets. They remain private; package publishing/registry selection will happen with the frontend repository. Never install the whole backend as a frontend dependency. A later combined Growth OS app composes the reusable module features and shared login/session shell.

Presence exports the `PRESENCE_QUERIES` token from its contracts boundary, implementing published listing summaries, scoped listing ownership and readiness. Consumers must treat absent modules as unavailable and import no private repository. Existing profile-updated V1 shape stays unchanged; additional lifecycle/content event payloads are in `packages/contracts/src/presence.ts`. Listing expiry is enforced on every public query; no automatic expiry notification event/worker is claimed. External event consumers remain disabled.

## Verification and remaining deployment gates

Automated tests cover processed image uploads (using an in-memory storage double), unsafe image rejection, ownership/role checks, readonly viewers and publishing editors, readiness, schema upgrades, draft/archive privacy, offer expiry, ordering/version conflicts, rollback on outbox failure, public contact privacy, ETags, share metadata, standalone composition, and the supplier-to-inquiry journey. GitHub CI additionally runs native PostgreSQL, dependency checks and Docker builds.

Still required with real accounts: private Supabase bucket creation, database connection/TLS verification, adapter upload/download smoke test, Render health/restart verification, public web deployment, Android installation and native iPhone verification later. There are no customer records seeded. Catalog entries are initial product configuration, and test fixtures run only in disposable/CI databases.

Defer to later scope: platform moderation, reviews, translated content, slug redirects, advanced contact methods, overnight/multi-interval hours, actual QR image rendering, listing/project context in Leads capture, analytics consumers and production operations. Social links and descriptions are plain content, never rendered as trusted HTML. Current opening hours support one same-day interval per weekday; timezone remains canonical account/business configuration to resolve before scheduling features.
