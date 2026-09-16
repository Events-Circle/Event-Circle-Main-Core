# Architecture and implementation scope

## Authoritative decisions

Based on the supplied modular architecture, Growth OS V1 and technology summary PDFs, with the owner's explicit correction taking precedence over the original repository diagram:

1. One `Event-Circle-Main-Core` repository contains **only backend code**: shared backend plus each module backend.
2. Frontend apps have separate repositories. Expo/React Native with TypeScript/TSX is the established mobile stack; no web frontend framework is selected here.
3. Repository co-location does not merge runtime services or databases. Each module owns its schema, database credentials and deployment lifecycle.
4. Core User ID links data. There are no cross-database foreign keys or module reads from Core tables.
5. Cloudflare WAF/Tunnel fronts public APIs. Authentication and ownership authorization still happen inside the services.
6. Backend context sharing means a versioned reference export in this initial implementation. It does not duplicate live backend ownership into frontend repositories.

Fastify is the initial TypeScript HTTP framework chosen for this foundation; it was not prescribed by the technology PDF.

## Identity and access

One user can browse as a consumer and own a supplier profile using the same Core identity. Creating a supplier does not create a second account or password. The current foundation allows one owned supplier per Core User ID. Team memberships and multiple supplier organizations require a later explicit business model.

Core signs Ed25519 JWT access tokens with `iss`, `aud`, `sub`, `sid`, `iat`, `exp`, a key ID and `at+jwt` type. Only Core gets the private key. Modules receive the public key. Modules check signature, token type, issuer, audience, expiry and identity locally, then call Core `/v1/access` to check live session validity and entitlements. They fail closed with 503 if Core cannot answer; they never assume paid access during an outage.

Refresh tokens are 32 random bytes; only SHA-256 digests are persisted. Consumption is conditional and transactional. Replay revokes the session family, including access tokens checked against that session. Used digests remain until expiry so reuse remains detectable. Clients must serialize refresh requests; parallel refresh attempts can intentionally trigger replay defense. The session's 30-day maximum is absolute, not extended by refresh.

The initial free access set is `growth:presence` and `growth:leads`. This is a development baseline, not a final pricing decision. Subscription features are added only while status is `active` or `trialing` and the current time is within the start/end interval. Cancellation at period end preserves access until expiry. Browser requests cannot create or alter subscriptions. A verified billing provider integration is still required.

## Domain ownership

| Core database | Growth database |
| --- | --- |
| Users and common preferences | Supplier business identity and public presence |
| Sessions and refresh digests | Lead contact details and inquiry text |
| Consent records | Lead status and declared acquisition source |
| Subscription records and features | Module activity records |
| Notification inbox | Future content, campaigns, business knowledge and integrations |
| Security audit metadata | Future consultation and follow-up workflows |

Public supplier responses exclude Core User ID. Private module queries filter by the verified Core identity. Public leads require contact permission for the inquiry and at least one contact method. That permission is not a blanket marketing opt-in. Source/campaign fields are visitor-declared hints, not verified advertising attribution. No response to a public inquiry exposes a lead ID or private supplier data.

## Growth OS roadmap

The five supplier destinations remain Home, Create, Promote, Leads and Circle AI. My Presence and Connections/AI Settings are secondary areas. Current APIs implement the first presence and leads slice, not those complete screens.

| Milestone | Required behavior |
| --- | --- |
| Account lifecycle | Verified email, recovery, credential change, suspension, retention and deletion coordination across modules |
| Shared messaging | Transactional outbox, idempotent consumers, delivery adapters honoring preferences, retries and alerts |
| Billing | Chosen provider, signed/idempotent webhooks, plan catalogue, event ordering, trials and reconciliation |
| Presence/content | Media uploads, galleries, listings, Event Posts, Hosted Events, discovery, moderation and engagement |
| Circle AI | Supplier-approved Business Brain, suggest/prepare/automatic modes, per-action permissions, versioned approvals and activity logs |
| Lead workflows | Conversations, qualification, contact opt-out, follow-up stop rules and conflict-safe consultation booking |
| Integrations | OAuth and encrypted provider tokens for Instagram/Facebook/Meta Ads, Gmail/Outlook and calendars |
| Promotions | Internal placement, external campaigns, approved spend caps, scheduling, verified attribution and reporting |
| Operations | Durable workers, backup/restore drills, alerting, observability, abuse controls and incident runbooks |

Do not pretend a queued action was sent or a promotion launched until its provider confirms success. External promotion destinations should return prospects to Events Circle. Guest inquiry remains possible without registration.

## New module procedure

1. Add `modules/<name>/` with its own API, Prisma schema and migration history.
2. Add a distinct generated client, database/role and service configuration. Never import another service's client.
3. Reuse only neutral contracts and runtime helpers; verify Core tokens and call `/v1/access`.
4. Scope reads and writes by verified identity and explicit business ownership; test cross-user denial.
5. Add generation/build/test scripts, independent image target and CI checks.
6. Add the module explicitly to the context-export allowlist. Share only its source and shared reference.
7. Configure its API hostname through Cloudflare and attach health/backup/rollback procedures.

Core API changes must remain backward-compatible within `/v1`. Shared helper changes require both services' tests. Deployment rollback must be compatible with existing migrations; use expand-and-contract schema changes rather than destructive automatic down-migrations.
