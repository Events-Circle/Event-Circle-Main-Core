# presence

Implemented backend foundation. Depends only on Core. Private application/infrastructure code must not be imported by other modules. See backend/tests for API/tenant/isolation coverage.

Layout: api → application → domain; infrastructure implements persistence/providers; contracts publishes stable events. Module tables require namespaced ownership in the single backend Prisma schema. Update coordination documents when implementing changes.

Presence & Portfolio expansion has started with pure domain policies and shared event/query types. `domain/rules.ts` is tested but not yet wired to the existing profile endpoints. The expanded database, Core media/catalog adapters, management APIs and public aggregate are subsequent stages. See `docs/presence-backend-plan.md` for the source guide, ownership decisions and acceptance gates. No frontend is implemented in this phase.
