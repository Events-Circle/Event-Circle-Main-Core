# Project status

## Circle AI branch update — 2026-09-18

Planning-only foundation authored; see ../circle-ai-handoff.md. Adds tenant-scoped requests, drafts, owner decisions and history. No generative provider or external execution, no live deployment yet. Presence frontend now exists separately; older statements below that it has not been created are historical.

Presence & Portfolio image V1 backend is implemented on the feature branch: Core image processing/private storage adapter and catalogs, additive schema, profile and content APIs, publication, public aggregates/media/share and Leads inquiry handoff. Android and iOS JavaScript exports are verified. See `docs/presence-backend-handoff.md` and `docs/staging-setup.md` for acceptance evidence and remaining live-provider/device gates. The module frontend repo has not been created.

The following is the earlier foundation audit record:

Updated: 2026-09-17. The recovered monorepo was merged through PR #1 into main at `e3b0c5c`. Its PostgreSQL/Docker CI passed. PR #2 records the deeper audit and its remediation. See `docs/audits/2026-09-17-remediation.md` for current scope, evidence and operational limits; the original audit report is historical.

Implemented foundation: pnpm/Turbo, one NestJS API and Prisma/PostgreSQL schema; Core auth, suppliers, organizations/memberships, permissions, preferences, consent, subscription reads, notification inbox, health and module registry. Presence has draft/public profile APIs. Leads has consented intake, scoped lists and stage changes. Other modules remain planned.

Audit repairs: trimmed/validated business data, nullable response contracts, referential constraints with restricted deletion, request/event/audit correlation, cursor pagination, leased/retryable opt-in outbox dispatch and patched dependencies. CI includes dependency auditing, current-tree secret patterns and the extended audit against isolated PostgreSQL.

Local verification: 16 Jest tests and 34 audit checks pass; schema, lint, formatting, architecture and forced workspace types/builds pass. Full dependency audit reports zero advisories. Expo Android export is a bundle, not an APK. Native PostgreSQL and Docker must pass on the exact PR commit before merging; merged main is checked again. Exact GitHub run links are recorded in PR #2.

Starter apps: Expo mobile, Next.js supplier/public web and React admin are runnable shells, not completed product screens. Only web health connectivity is wired. No product phase beyond foundation is claimed complete.

Planned: Content, Promotions, Hosted Events, Insights, Circle AI, Connections/Automation; media, provider credentials, Business Brain, team/invitation administration, billing/webhooks, notification delivery, idempotent external event consumers, password recovery/email verification, deletion/retention, localization UI and production observability. Presence listings/portfolio features and Leads messages/consultations/frontends remain to build.

No live customer database was inspected or migrated. The integrity preflight must be reviewed before upgrading an existing deployment. The older two-database importer, Cloudflare provisioning, production deployment, load tests and real device/browser journeys remain outside the verified scope.

## Railway / Expo deployment preparation

Railway Docker deployment config and private S3 storage replace Render/Supabase. EAS internal-preview APK and production profiles plus shared-package build hook added. No account-specific project IDs or credentials committed. Live Railway smoke tests and EAS native builds are pending account connection. See docs/staging-setup.md.
