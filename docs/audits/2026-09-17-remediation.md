# Core and module audit remediation

This supersedes the implementation findings in `2026-09-17-core-and-modules.md`. That report and its JSON remain unchanged as the historical baseline (20 passing, eight failing audit checks). The six planned modules and unfinished product features remain explicitly planned.

## Repairs

| Finding                              | Change                                                                                                                                            | Verification                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Punctuation-only phone accepted      | Phone input must contain 7-15 digits; optional leading + and formatting separators are supported; input is trimmed                                | Invalid phone rejected; formatted international phone accepted and stored normalized                        |
| Blank business/lead/consent text     | Trim before length validation; reject blank supplier identity, display name, lead name/message/consent version, campaign and service-area entries | Original blank-field probes pass; valid input remains accepted                                              |
| Orphan or mismatched references      | New migration adds supplier foreign key for Presence and composite supplier/organization key for Leads                                            | Orphan/mismatch insertions fail; organization deletion is restricted while referenced module records remain |
| Nullable API contract                | Dedicated Lead response DTO documents nullable email/phone/campaign and timestamps                                                                | OpenAPI/client regenerated; response-nullability probe passes                                               |
| Disconnected request/event IDs       | AsyncLocalStorage carries server-generated correlation ID into outbox and audit records; event handlers restore it                                | Original request/event assertion and dispatch context assertions pass                                       |
| Lists inaccessible after 100 records | Bounded cursor pagination for Leads, sessions, consents, subscriptions and notifications                                                          | More than 100 records per endpoint traversed without overlap; malformed/foreign cursors rejected            |
| Outbox has no dispatcher             | Opt-in registered-consumer worker with leases, bounded batches, retry/backoff and ten-attempt cap                                                 | Delivery, concurrent claims, retry, expired-lease recovery, no-consumer behavior and exhaustion checked     |
| Dependency advisories                | Lock multer to 2.3.0 and xcode's uuid to CommonJS-compatible 11.1.1                                                                               | Full dependency audit reports zero advisories; Xcode UUID smoke check and all application builds pass       |
| Missing security/audit CI gates      | Dependency audit at all severities, high-confidence current-tree secret patterns, and repaired audit on separate native PostgreSQL database       | PR/main CI must pass before claiming GitHub verification                                                    |

## Test evidence before publication

- 16 Jest tests pass, including three migration-upgrade tests.
- 34 audit checks pass; the original eight failing assertions now pass.
- Prisma schema generation/validation, lint, architecture boundaries, formatting and all workspace type checks pass.
- All 11 build tasks pass with Turbo cache bypass (backend, Next.js, React admin and Expo Android bundle). Android bundle export is not an APK or device QA.
- Full locked dependency audit: zero reported advisories at verification time. This is not a guarantee against undisclosed vulnerabilities.
- Generated OpenAPI and client include pagination headers/query parameters and accurate nullable lead response fields.
- Native PostgreSQL audit and Docker verification run in the PR and again on merged main. Their exact run links and final status are recorded in the PR's verification section after completion.

## Database migration and existing data

The original initial migration is preserved. Two new transactional migrations add integrity constraints/audit correlation and outbox delivery metadata. Valid existing records are preserved; invalid ownership stops the migration instead of guessing ownership or deleting records. Tests cover a valid upgrade, an existing orphan and an existing tenant mismatch. Failed transactions roll back their schema changes.

Before migrating an existing environment, run `database/integrity-preflight.sql` on a verified staging/backup copy. Investigate any nonzero count. Existing blank input is reported, not retroactively rewritten. The integrity migration prevents orphan/mismatch writes but does not clean historical phone/text values. If Prisma records a failed migration, reconcile the verified underlying data and follow Prisma's reviewed failed-migration recovery procedure before retrying. Never mark a partially understood migration applied.

Deletion policy is restrictive: Presence/Lead references prevent supplier removal, including an organization delete that would cascade to the supplier. This preserves business/contact data pending an explicit retention/deletion workflow. Outbox/audit rows remain historical evidence; this release does not purge them. No deployed database was migrated during repository work.

## Pagination contract

Existing response arrays are preserved. Send `limit` (1-100, default 100); if the response contains `X-Next-Cursor`, send its UUID as `cursor` for the next page. The header is absent at the end. CORS exposes it to web clients. Sorting uses creation/recording time descending and UUID descending as a deterministic tie-breaker. Cursors must belong to the authenticated scope; invalid, deleted or expired-session cursors return 400. Clients can restart pagination if their cursor becomes stale. Membership reads were not previously capped and remain unchanged.

## Outbox operation

`OUTBOX_WORKER_ENABLED=false` is the default. Enable it in an API instance only after registering idempotent in-process consumers through `EventsService.subscribe`. It polls once a second, selects at most 25 registered event types' pending rows per pass and claims each with a 60-second lease. Pending rows without consumers are retained and not marked delivered. Failure stores only a generic error code, releases the lease and schedules exponential backoff; ten attempted claims stop automatic retries. Inspect exhausted rows and reconcile the consumer's side effects before any explicit replay.

Delivery is at least once, not exactly once. Every handler must deduplicate using the stable event ID and set its own bounded provider timeout. A handler running past its lease, a crash after a side effect, or another failing handler can cause repeat invocation. Leases prevent ordinary concurrent claims; they do not replace consumer idempotency. Shutdown stops polling and waits for the active batch before disconnecting Prisma. There are no email, AI, billing or social consumers activated by this change.

## Remaining scope

Presence and Leads are backend foundations, not full products. Content, Promotions, Hosted Events, Insights, Circle AI and Connections/Automation are still disabled planning boundaries. Core media, billing writes, invitations, recovery/email verification, provider integrations and complete privacy lifecycle remain future features. Live customer data, infrastructure provisioning, performance/load behavior, browser/device journeys and legacy two-database import are not certified by these tests. The secret gate scans known patterns in the current tracked tree; it is not an entropy scan or history audit.

## Repeat checks

```sh
pnpm install --frozen-lockfile
pnpm generate
pnpm lint
pnpm format:check
pnpm typecheck --force
pnpm test
node backend/audits/core-verification.mjs /tmp/events-circle-verification.json
pnpm contracts
pnpm audit --audit-level low
node scripts/check-secrets.mjs
pnpm build --force
```

Local audit ignores DATABASE_URL and uses disposable PGlite. CI may explicitly supply AUDIT_DATABASE_URL only when CI=true, hostname is loopback and database name is exactly events_circle_audit_test; CI creates and migrates that separate empty database. Do not point the ordinary integration test environment at live data.
