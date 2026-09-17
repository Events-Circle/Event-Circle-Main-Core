# Core and module verification - 17 September 2026

Historical baseline. See `2026-09-17-remediation.md` for subsequent fixes and verification; the results below describe the original audited commit.

## Verdict and scope

Audited main commit: `e3b0c5cbbaf3252bca78d5235c3d18f3630b7f5f` (source tree `7a0fbb1eda99807aa1c025c8ecf484cd1b32d6b2`).

The repository follows the agreed modular-monolith foundation, but it is **not a complete or production-ready ecosystem**. The original 13 backend tests pass. An additional 28 targeted checks produced **20 passes and 8 failures**, exposing data validation, API contract, request tracing and database integrity gaps. Dependency auditing found five advisories. Passing the existing CI does not cover these findings.

Baselines: `Events_Circle_Modular_Ecosystem_Explained.pdf` and `Events_Circle_GitHub_and_Code_Structure.pdf`. The latter's one NestJS backend / one PostgreSQL database decision supersedes the earlier chat's separate-service/database approach. The downloaded chat confirms that change and retains Cloudflare as an edge requirement.

This is a code, schema, migration, contract, dependency and isolated-runtime audit. No production or staging database was accessed. No customer records were inspected or changed. The additional checks always construct a new disposable PGlite database and overwrite their own process's database URL. Main's existing suite also passed native PostgreSQL in GitHub CI. The additional 28 checks have not been run against native PostgreSQL.

## Verification evidence

| Check                                   | Result and limits                                                                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub main identity                    | Verified exact merged commit and source tree                                                                                                                                        |
| Native PostgreSQL and Docker            | Main [CI run 35209167495](https://github.com/Events-Circle/Event-Circle-Main-Core/actions/runs/35209167495) passed migration, tests, contracts, application builds and Docker build |
| Prisma schema validation and generation | Passed locally with a dummy URL; validation does not connect to that URL                                                                                                            |
| Schema versus committed migration       | Generated SQL from the current schema equals the committed initial migration after trimming surrounding whitespace                                                                  |
| Lint and architecture checks            | Passed; checker inspected 57 TypeScript source files                                                                                                                                |
| Formatting                              | Passed on audited source                                                                                                                                                            |
| Workspace TypeScript                    | All 15 tasks passed with cache bypass                                                                                                                                               |
| Existing backend suite                  | 13 tests across three suites passed against disposable PGlite                                                                                                                       |
| API generation                          | OpenAPI and generated client regenerate without tracked differences                                                                                                                 |
| Application builds                      | Local Turbo build passed (10 cached tasks, backend rebuilt); main CI independently passed builds and Docker                                                                         |
| Additional verification                 | 28 checks: 20 pass, 8 fail; see runner and captured results                                                                                                                         |
| Dependency audits                       | Both production-only and full audits report 3 high, 1 moderate and 1 low advisory; not five independently exposed attacks                                                           |
| Limited secret scan                     | No private-key, GitHub-token or AWS-access-key pattern matches in 178 tracked files; not a full history/entropy/provider-secret scan                                                |
| Live deployment and customer data       | Not verified; no live database or deployed environment was used                                                                                                                     |

The initial local Prisma validation command failed because DATABASE_URL was unset. It passed after supplying a nonconnecting dummy URL. This was an audit environment setup issue, not a schema defect.

## Architecture compliance

The top-level apps, backend, shared packages, database documentation, infrastructure, scripts and coordination documents exist. There is one NestJS composition root and one Prisma migration history. Supplier identity is owned by Core. Presence and Leads each separate API, application, domain and infrastructure code. Their current imports respect Core/module ownership. Domain code does not import NestJS or Prisma. Frontends do not access PostgreSQL.

Core-only, Presence-only and Leads-only operation is exercised by the existing integration suite. Disabled module routes are absent. Edition configuration is shared rather than copied source. Only Growth OS, Circle Presence and Circle Leads compositions are implemented; the other target editions remain future work.

Some PDF folders are represented by smaller consolidated services: memberships, subscription reads and notification inbox behavior live in `core/users`; entitlement checks live in `core/permissions`. This organization is acceptable for the current foundation, but it does not supply the rest of those capabilities. The eight module folders are present; only two contain executable implementations.

The boundary checker passes current code but is not an exhaustive ownership proof: it focuses on static imports and named model accesses, and its table-access patterns cover only known models. Extend it when adding modules, aliases, dynamic imports or additional Prisma operations. Namespaced routes and the three implemented versioned events are internally consistent. Event names differ from illustrative PDF examples; there are no implemented consumers of the PDF's larger event set.

## Core capabilities

| Area                            | Verified implementation                                                                                                                                | Missing or limited                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication                  | Registration/login, salted scrypt hashes, EdDSA access tokens, hashed refresh tokens, refresh rotation/reuse detection, server-side session revocation | Email verification, password recovery, MFA and broader account lifecycle                                                                                                                |
| User profiles                   | Locale/timezone and preferences; safe user response without password hash; malformed preferences rejected                                              | Whitespace validation still weak on display names; translation delivery absent                                                                                                          |
| Organizations/suppliers         | Atomic supplier, organization, OWNER membership and audit creation; role checks; organization-scoped access                                            | Team invitations/role administration, supplier verification, brand/contact/media fields described in PDFs                                                                               |
| Permissions/entitlements        | OWNER/EDITOR/VIEWER role checks; module activation; subscription time/status filtering                                                                 | No usage limits or billing writes. Baseline Presence/Leads permissions are deliberately free, per DECISIONS.md. Paid grants are user-scoped rather than a complete supplier-plan system |
| Sessions                        | Private token-free session list; another user cannot revoke the owner's session; logout/replay behavior covered                                        | Session cleanup and account deletion workflows                                                                                                                                          |
| Consents                        | Append-only granted/revoked records scoped to user                                                                                                     | Retention/deletion policy and richer consent management                                                                                                                                 |
| Subscriptions                   | Private read model; inactive/future/expired grants excluded; provider references withheld                                                              | Payments, verified webhooks and plan provisioning                                                                                                                                       |
| Notifications                   | User-scoped inbox and read markers; cross-user writes denied                                                                                           | Email/push providers, dispatchers and delivery retries                                                                                                                                  |
| Audit/events                    | Transactional audit/outbox on key supplier/Presence/Lead actions; rollback tested                                                                      | No outbox consumer/retry worker; no publish callers; incomplete request correlation and audit coverage                                                                                  |
| Module registry/health          | Eight-module catalog accurately identifies two implementations; liveness/readiness checks                                                              | Catalog is global deployment state, not supplier-specific activation. Liveness is rate-limited with other routes                                                                        |
| Media/integrations/AI/analytics | Ownership documents                                                                                                                                    | Uploads, credentials/adapters, Business Brain, AI gateway and measurement services are not implemented                                                                                  |

## Every module: code and data

| Module                 | Backend and data model present?                                                                                                          | Data correctness and completeness                                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presence               | Yes: three endpoints and `presence_profiles`; slug, description, publication state, supplier UUID                                        | Publication/privacy and slug uniqueness pass. Orphan supplier references are possible at database level. No seeded profiles. Listings, gallery, reviews, media, QR features and full portfolio workflow are absent                                                                    |
| Leads                  | Yes: capture/list/stage endpoints and `lead_opportunities`; tenant/supplier UUIDs, contact, message, source, campaign, consent and stage | API tenant isolation, consent requirement, opt-out and stage updates pass. Invalid phone/blank-field intake, nullable response mismatch and database referential gaps fail. No seeded leads. Conversations, follow-ups, scoring, consultation requests and detail endpoint are absent |
| Content                | No executable module, routes or database tables; README boundaries only                                                                  | No content records, publishing data, schedules or provider logic to validate                                                                                                                                                                                                          |
| Promotions             | No executable module, routes or database tables; README boundaries only                                                                  | No campaign/budget/spend data or enforcement to validate                                                                                                                                                                                                                              |
| Hosted Events          | No executable module, routes or database tables; README boundaries only                                                                  | No events, capacity, RSVP or attendee data to validate                                                                                                                                                                                                                                |
| Insights               | No executable module, routes or database tables; README boundaries only                                                                  | No metrics, attribution or aggregates to validate                                                                                                                                                                                                                                     |
| Circle AI              | No executable module, routes or database tables; README boundaries only                                                                  | No threads, approval records, recommendations or AI operations to validate                                                                                                                                                                                                            |
| Connections/Automation | No executable module, routes or database tables; README boundaries only                                                                  | No connected accounts, tokens, automation policies or external calls to validate                                                                                                                                                                                                      |

There are 13 application models/tables: 11 Core, one Presence, one Leads. The repository has no tracked database dump, customer CSV, SQLite database or production business-record dataset. `backend/prisma/seed.ts` is deliberately a no-op and refuses NODE_ENV=production; it inserts no default accounts, credentials, grants, suppliers or module records. Existing fixtures create synthetic accounts, suppliers, leads, memberships and subscriptions during tests. These are test inputs, not proof of live customer data. Fresh migration counts were zero for users, organizations, suppliers, profiles, leads and subscriptions.

**Therefore:** the repository contains schema and test data for two modules, not a populated database for all eight. Actual live record correctness remains unknown until an explicitly identified database or sanitized export can be checked read-only.

## Reproduced failures

### A. Invalid business/contact data is accepted (DATA-01 through DATA-03)

`backend/src/modules/leads/api/leads.dto.ts` permits `phone: "-------"`. `hasContact()` only checks whether the string contains non-whitespace characters. A public inquiry with that phone and no email returns **201**, leaving no usable contact method.

Supplier creation accepts spaces for businessName/category/city. Lead creation accepts spaces for name/message/contactConsentVersion. These also return **201**. MinLength counts whitespace; the system therefore accepts unusable business identity and consent-version metadata. The same non-trimming pattern exists in user displayName and consent version validation.

Priority: fix before accepting real supplier or lead input. Normalize appropriate strings and require meaningful nonblank values; apply a documented phone policy rather than punctuation/length alone. Add permanent regression tests for both accepted international formats and rejected empty/punctuation-only input.

### B. Database references can be orphaned or cross-wired (INTEGRITY-01 through INTEGRITY-03)

`PresenceProfile.supplierId` and `LeadOpportunity.supplierId/organizationId` are UUID fields without corresponding foreign keys. Three disposable-database probes showed:

1. A Presence profile with a nonexistent supplier can be inserted.
2. A lead can reference an existing supplier but a different organization's UUID.
3. Deleting an organization cascades to its Core supplier while leaving the Presence profile behind.

These are database-level integrity findings, **not a demonstrated unauthenticated API tenant bypass**. Current HTTP capture derives tenant ownership from Core, and tested cross-tenant reads/writes are denied. The gaps matter for imports, maintenance, future workers and deletion workflows.

Priority: establish referential integrity and reviewed deletion/retention behavior before adding imports or lifecycle operations. Audit existing data before adding constraints. Database constraints can enforce ownership references without making Core code import module implementations. Do not introduce cascading deletion of lead contact data without a retention decision. Outbox organization references also need an intentional lifecycle policy.

### C. API contact contract disagrees with actual data (CONTRACT-01)

An email-only lead returns `phone: null`; `LeadResponseDto` inherits the optional request property and documents `phone` as a nonnullable string. Email and campaign have the same nullable-storage pattern. The generated client therefore cannot accurately type the returned values. Returned creation/update timestamps also lack explicit Lead response DTO properties.

Priority: separate request and response DTOs or accurately declare nullability and timestamps, regenerate OpenAPI/client types and add runtime response-contract assertions. A clean regeneration diff only proves reproducibility, not truthfulness of the schema.

### D. API-to-event tracing is disconnected (TRACE-01)

The response's `X-Request-Id` differs from the persisted lead-created event's `correlationId`. `EventsService.record()` generates a new random ID; controllers do not pass the request context. This violates the PDF's requirement to connect API requests, jobs and AI/webhook operations. Pass request context through the application layer; retain a separate event identifier.

## Dependencies and operational gaps

Both `pnpm audit --prod --json` and `pnpm audit --json` reported the same five advisories on the locked dependency graph:

| Dependency   | Path and advisory                                                              | Assessment                                                                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| multer 2.2.0 | backend -> @nestjs/platform-express -> multer; three high and one low advisory | Patch before enabling uploads. Registry reports fix at >=2.3.0. No FileInterceptor, FilesInterceptor, multer middleware or multipart upload route is used in current application source, so remote exploitability of current endpoints was not established |
| uuid 7.0.3   | Expo -> @expo/config-plugins -> xcode -> uuid; one moderate advisory           | Mobile tooling dependency; not Core's UUID generator (Core uses node:crypto/Prisma). Update through a compatible Expo dependency path; do not force a breaking major without testing                                                                       |

Advisories: [multer field names](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm), [aborted uploads](https://github.com/advisories/GHSA-qfvm-cv95-jqjf), [oversized array indices](https://github.com/advisories/GHSA-535w-7cp7-47q4), [async file filter](https://github.com/advisories/GHSA-qvfw-j98x-7q72), [uuid bounds](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Severity labels come from the audit registry; installed presence alone is not proof of exploitation.

Additional gaps found by source inspection:

- CI has no dependency-audit or secret-scanning step despite the PDF's minimum gates. The limited scan performed here does not replace those gates.
- Lead listing returns at most 100 rows with no cursor or next-page contract. Older records become inaccessible through this endpoint as data grows; notification/session/consent lists have similar fixed caps.
- Outbox writes are durable but there is no delivery/retry worker or event publisher caller. Downstream automation does not occur merely because a row exists.
- One initial migration supports a clean database only. No upgrade/import implementation from the older two-database system has been validated. `database/README.md` correctly documents this limitation.
- README-only module tests are not executable tests. Existing backend coverage is foundation-level, not full feature, concurrency, load, fuzz or migration-upgrade coverage.
- Cloudflare files are templates, not evidence that WAF, origin restrictions, backups, monitoring or production secrets have been provisioned.
- Mobile/web/admin remain shells. No supplier UI journey, browser accessibility test, device QA or Android APK verification is established by this backend audit.
- CODEOWNERS exists, but repository branch protection and independent owner review were not verified. Documentation currently has historical recovery statements that should be updated after remediation.

## Reproduction and next work

The audit runner and results are intentionally separate from the passing regression suite: they expose unresolved desired behaviors and return exit code 1 when findings remain. They do not silently redefine a defect as passing.

```sh
pnpm generate
pnpm --filter @events-circle/backend build
node backend/audits/core-verification.mjs /tmp/events-circle-core-audit.json
```

Run the runner from the repository root. It never accepts an external database URL and destroys its disposable database at exit. Expected results for this audited commit: 20 pass, 8 fail. A simulated outbox failure intentionally logs one request error; that check passes when the transaction rolls back.

Recommended repair order:

1. Fix invalid data acceptance and response contracts, with regression coverage.
2. Define referential integrity and deletion policy, then add a reviewed migration and orphan/mismatch checks.
3. Resolve dependency advisories and add security CI gates.
4. Carry request correlation into outbox/audit and add pagination.
5. Implement the remaining Core capabilities and module features in the PDF's staged order. Keep planned modules explicitly disabled until they have usable behavior and tests.

This audit changes no production implementation or migration. Its findings are not automatically fixed by publishing the report. Do not treat green baseline CI or the recovery merge as certification that the entire ecosystem is complete.
