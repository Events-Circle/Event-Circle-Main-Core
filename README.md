# Events Circle

One TypeScript monorepo: shared Core, isolated business modules, three applications and configurable product editions. Based on **Events Circle GitHub and Code Structure** and **Events Circle Modular Ecosystem Explained**. These documents supersede the earlier backend-only/two-database scaffold.

**Status: architecture foundation with working account, supplier, Presence and Leads APIs. Applications are starter shells, not completed Growth OS screens.**

| Path                  | Responsibility                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/mobile`         | Expo / React Native supplier app                                                                 |
| `apps/web`            | Next.js supplier and public web                                                                  |
| `apps/admin`          | React operations app                                                                             |
| `backend/src/common`  | Technical HTTP and database helpers                                                              |
| `backend/src/core`    | Identity, suppliers, organizations, permissions and shared platform services                     |
| `backend/src/modules` | Presence, Content, Promotions, Leads, Hosted Events, Insights, Circle AI, Connections/Automation |
| `backend/prisma`      | One PostgreSQL schema, client and migration history; namespaced owned tables                     |
| `packages`            | Typed API client, contracts, types, design tokens, validation, utilities, config and testing     |
| `infrastructure`      | Docker and Cloudflare configuration                                                              |
| `docs/coordination`   | Status, dependencies, API changes and decisions                                                  |

## Local setup

Node.js 22.12+, pnpm 10.30.3 and Docker Compose are required. Run from repository root:

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm keys
docker compose -f infrastructure/docker/compose.yaml up -d --wait
pnpm generate
pnpm --filter @events-circle/backend db:migrate
pnpm build
pnpm --filter @events-circle/backend dev
```

In another terminal, run `pnpm --filter @events-circle/web dev`, `pnpm --filter @events-circle/admin dev`, or `pnpm --filter @events-circle/mobile dev`. API: port 4000; web: 3000; admin: 3001. The backend dev command starts the compiled API and watches source compilation. The mobile simulator needs a reachable API URL before implementing authenticated screens.

## Verify

```sh
pnpm generate
pnpm typecheck
pnpm lint
pnpm test
pnpm contracts
pnpm build
```

Tests use disposable PGlite PostgreSQL when `TEST_DATABASE_URL` is unset. CI applies the migration to native PostgreSQL and sets `TEST_DATABASE_URL`. Never point tests at a production database. Regenerate and commit `backend/openapi.json` and `packages/api-client/src/openapi.d.ts` together after API changes.

Core always loads. `EDITION=growth-os` enables the currently implemented Presence and Leads modules. `circle-presence` and `circle-leads` are foundation test compositions. `ENABLED_MODULES=` runs Core alone. Unimplemented module IDs are rejected; planned module folders do not expose placeholder APIs. Module independence tests cover each composition.

Read [architecture](docs/architecture.md), [API](docs/api.md), [deployment](docs/deployment.md), [migration](database/README.md), and [current scope](docs/coordination/PROJECT_STATUS.md). Work on feature branches and review PRs before merging. No provider credentials, ads, payments or external AI automations are activated.
