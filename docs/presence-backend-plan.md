# Presence & Portfolio: backend delivery boundary

Source: Events Circle Presence & Portfolio Implementation Guide, supplied 17 September 2026. This document covers its first recommended PR: Core fit gaps, domain rules, and contracts. It does **not** claim the complete module or new APIs are implemented.

## Ownership and Core fit

| Capability        | Current implementation                                          | Next action                                                                                                                             |
| ----------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Supplier identity | Core Supplier and organization membership                       | Reuse; do not duplicate business name, city or service areas in Presence                                                                |
| Permissions       | Core tenant membership, roles and enabled-module features       | Reuse presence.read/write for V1, including publication; editors can publish; a later presence.publish permission can separate approval |
| Media             | Core README only; no upload/processing service                  | Implement Core upload authorization, ownership, storage adapter, processing and safe deletion before any new media-backed publish API   |
| Catalogs          | Supplier category/city are existing strings; no catalog service | Add Core stable category/location IDs and active-state lookup with a compatibility migration; never reinterpret existing text as UUIDs  |
| Audit and events  | Transactional audit, durable outbox, opt-in delivery worker     | Reuse inside the same mutation transaction; do not send notifications before commit                                                     |
| Notifications     | Core read APIs; no Presence delivery consumer                   | Keep future integration asynchronous; delivery is not a publication precondition                                                        |
| Leads             | Standalone public capture endpoint                              | Reuse current supplier-based capture; optional project/listing context requires a coordinated contract change                           |
| Presence          | Profile GET/PUT and public slug lookup                          | Expand in place; existing endpoint behavior is unchanged in this PR                                                                     |

The new Core media port is an interface only. It is not registered with Nest and cannot authorize uploads. Storage provider selection/credentials and processing implementation remain necessary. READY status must come from server-side processing, never a client flag. Persisted attachments need foreign keys and transaction-level revalidation so deletion cannot race attachment.

## V1 design decisions for the expansion

- Keep one NestJS backend and one PostgreSQL database. Implement no production frontend here; the user plans a separate module frontend repository.
- Use DRAFT, PUBLISHED, UNPUBLISHED and ARCHIVED. Restoring an archive returns a private draft. Suspension requires a separate platform administrator authorization design and is deferred.
- Publication requires canonical supplier/category validity, a valid normalized slug, a meaningful description, and a READY owned logo. Portfolio/listing publication additionally requires a title and READY cover with alt text. Requiring a published listing to publish the profile is deliberately avoided, allowing portfolio-only businesses.
- Domain readiness takes verified Core facts. HTTP clients must never submit trusted `logoReady`, `categoryActive`, `supplierExists` or `allMediaReady` values.
- Normalize new slugs by trimming/lowercasing, 3–80 ASCII alphanumeric/hyphen characters; reserve platform names. DB uniqueness remains authoritative. Existing slug conflicts with the stronger policy must be reported during migration; no automatic rename. Optional old-slug redirects are deferred.
- FIXED/FROM prices require positive safe-integer minor units and a supported currency. FREE/ON_REQUEST omit both amount and currency. The initial supported set is USD, EUR, GBP, LBP, AED, SAR, QAR, KWD, BHD, OMR, JOD, EGP, CAD and AUD; this is a bounded product list, not all ISO currencies. Currency-specific decimal display belongs in the future client.
- Only OFFER listings have optional validity dates. A future start hides the offer until that instant; an end is exclusive. Expired offers remain stored privately and cannot be published again until corrected. Public queries must enforce time even if an expiry worker has not run.
- A collection permits at most 50 media references, at most one cover, no duplicate IDs, meaningful alt text (300 characters), and captions up to 1,000 characters. Publishing projects/listings requires exactly one cover. Gallery content remains independent.
- Social links use HTTPS and exact supported provider hosts. They are links only: backend URL fetching/preview generation is outside scope. Rich HTML is not accepted.
- Full-collection reorder must be an exact permutation of the scoped collection. The eventual repository must verify it and apply positions atomically with optimistic concurrency; a page of IDs cannot reorder the entire collection.
- Preserve `presence.profile.updated.v1` and its existing payload. Additional typed event contracts are planned in the shared package; they are not emitted by this increment. Emit lifecycle events only when state changes. Domain transitions alone do not enforce permission/readiness; application services must enforce all three.
- Reuse presence.write for publication in V1, preserving current editor behavior. Do not silently change permissions or paid entitlements.

## Remaining implementation stages and acceptance

1. Core media/catalog adapters and additive database migrations: preserve existing profiles, map published booleans to states, retain canonical Supplier ownership, add scoped projects/listings/gallery and media relations. Test clean deployment and upgrades with existing data. Backfill publication provenance explicitly; existing profiles without logos need a reviewed legacy-readiness policy before rollout.
2. Tenant-safe repositories and management APIs: profile fields, social links, opening hours, SEO, portfolio/listings/gallery CRUD, atomic ordering, publish/unpublish/archive, readiness, version conflict handling. Mutations must include audit/outbox; unknown and foreign content IDs return the same 404.
3. Public aggregate and paginated child/detail/share APIs: deliberate DTOs, parent and child publication filters, READY media only, offer windows, safe contact visibility, module-aware inquiry CTA. Derive ETag/Last-Modified from all public dependencies and prevent stale public responses after withdrawal; no public cache policy is changed in this increment.
4. Freeze generated OpenAPI/client types after API implementation; verify role matrix, cross-tenant guessing/reordering/media attachment, transactional rollback, concurrent slug collisions, idempotent events, expiry, module compositions, and complete create-to-public-to-inquiry journey. Then hand off frontend work.

The domain tests added here verify pure policy only. They do not prove database isolation, media processing, HTTP errors, or complete module readiness. The existing 16 backend tests and 34-check audit remain the regression baseline. No new routes, database tables, production media, or seed customer data are created by this increment.
