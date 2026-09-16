# Events Circle Main Core

Backend-only foundation for the Events Circle ecosystem. Shared identity and every module backend live here; mobile/web frontends live in their own repositories.

**Status: initial foundation, not a production launch or the complete Growth OS.**

## Structure

| Path | Ownership |
| --- | --- |
| `shared/` | Core identity, sessions, profiles, preferences, consents, subscription access, notification inbox and audit records |
| `modules/growth/` | Supplier presence and lead intake/management, with its own database |
| `packages/contracts/` | API validation and common identity types |
| `packages/runtime/` | HTTP security, configuration, token verification helpers; no database ownership |
| `infra/` | Cloudflare Tunnel example |
| `docs/` | API reference, deployment, architectural decisions and remaining scope |
| `scripts/export-context.mjs` | Share the common backend and one selected module as development reference |

TypeScript / Fastify, Prisma 6, PostgreSQL, Node.js 22. Two independent processes, two clients, two migration histories. No frontends in this repository.

## Local development

Prerequisites: Node.js 22+, npm and Docker Compose.

```sh
cp .env.example .env
npm ci
npm run keys
docker compose up -d --wait
npm run generate
npm run migrate:core
npm run migrate:growth
npm run build
npm run dev:core
# In another terminal:
npm run dev:growth
```

Core runs at `http://127.0.0.1:4000`; Growth runs at `http://127.0.0.1:4001`. Both expose `/health/live` and `/health/ready`. The default database passwords are **local development values**; production setup is in [deployment](docs/deployment.md).

## Verify

```sh
npm run check
npm run test:integration
```

Without database URL environment variables, integration tests launch two disposable PGlite Postgres/WASM databases, apply the real SQL migrations and connect through Prisma. With both `CORE_DATABASE_URL` and `GROWTH_DATABASE_URL` set, they use those databases instead: use disposable test databases only. Native PostgreSQL tests and Docker builds also run in GitHub Actions.

The tests exercise passwords, token validation, forwarded-header rate-limit protection, account/session flows, public inquiry capture, cross-supplier isolation, subscription expiry and refresh-token replay revocation. Tests create synthetic records; native test databases are not wiped by the script.

## Share backend context with a new frontend repository

```sh
npm run context -- growth
```

This creates `context-export/growth/` with the shared backend, selected module, common packages and reference documentation. It excludes environment files, keys, generated clients and other modules. `CONTEXT.json` identifies the source commit. The export is **development reference**; Core remains the authoritative implementation, and the frontend calls deployed APIs. See [architecture](docs/architecture.md) before adding a new module.

## Included now

- Register/login with salted scrypt password hashes.
- Ten-minute signed access tokens; 30-day, rotating refresh-token sessions. Reusing an old refresh token revokes its session family.
- Current user/profile/preferences, session listing/revocation, consent history.
- Read-only subscription status and server-side entitlement calculation.
- Notification inbox/read state and audit storage; delivery is not connected yet.
- Supplier draft/published profiles, public profile lookup, guest inquiry capture and six-stage lead management.
- Strict request validation, bounded pagination/body sizes, rate limits, explicit CORS, security headers and private-field response filtering.
- Independent database schemas/migrations, service Docker targets, CI and Cloudflare configuration guidance.

## Next milestones

Email verification/password recovery and account deletion coordination; verified billing webhooks and plan catalogue; notification delivery/outbox; supplier listings, Event Posts and Hosted Events; media storage; Circle Business Brain and approval-controlled AI; social/email/calendar integrations; promotions with spend controls; analytics and attribution. These are tracked in [architecture](docs/architecture.md). No payment, publishing, AI, email or advertising provider is activated by this commit.
