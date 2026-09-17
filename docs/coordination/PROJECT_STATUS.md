# Project status

Updated: 2026-09-16. Architecture refactor for revised ecosystem/code-structure PDFs.

Recovery in progress (2026-09-17): restored the original source patch from commit `26d91dc319abe5b0c2ccf41748ff8f6eb5e83c55`, verified SHA-256 `bd3e8b4de85ba51fd25d5d6c731483bfdfab39d44079aa933264ec88308ec90e`, and retained the read-only monorepo CI with recovery-branch coverage. The interrupted branch remains preserved; main has not been merged or deployed. Prior test/build claims must be independently rerun on the recovery branch. Docker is unavailable in the recovery environment, so native PostgreSQL and Docker verification require CI.

Recovery verification: Prisma schema validation/generation, lint, architecture boundaries, formatting, TypeScript checks, contract generation, and all application builds passed locally. The backend suite now has 12 passing tests (8 recovered plus password/JWT, readiness and forwarded-header regressions), using disposable PGlite. Backend, Next.js web, React admin and Expo Android bundle builds pass; the Android export is not an APK. The online Expo compatibility lookup timed out through the environment proxy; the installed SDK's offline compatibility check identified React Native 0.83.10 as the required patch version, so the mobile manifest and lockfile were aligned. Native PostgreSQL and Docker remain CI gates, not locally verified results.

Implemented: pnpm/Turbo monorepo; NestJS Core; single Prisma database; canonical supplier/organization membership; account/session/preferences/consent/subscription-read/notification APIs; Presence draft/public APIs; consented Leads intake/list/stages; strict authorization; transactional outbox recording; OpenAPI/client generation; edition isolation tests; Docker/Cloudflare templates.

Starter apps: Expo mobile, Next.js supplier/public web and React admin. These are runnable shells, not completed product screens. Only web health connectivity is wired. No phase beyond foundation is claimed complete: Presence and Leads still need frontend journeys, listings/messages/consultations and broader product scope.

Planned: Content, Promotions, Hosted Events, Insights, Circle AI, Connections/Automation; media storage; verified integration credentials; Business Brain; role/invitation administration; billing/webhooks; notification delivery; outbox workers; password recovery/email verification; cursor pagination; deletion/retention; localization UI and production observability.

Validation: architecture/static types, backend account/tenant/module integration suite, contract generation and application builds are required gates. Native PostgreSQL and container verification run in CI. Staging/production and Cloudflare provisioning are not part of this refactor.
