# presence

Implemented backend foundation. Depends only on Core. Private application/infrastructure code must not be imported by other modules. See backend/tests for API/tenant/isolation coverage.

Layout: api → application → domain; infrastructure implements persistence/providers; contracts publishes stable events. Module tables require namespaced ownership in the single backend Prisma schema. Update coordination documents when implementing changes.
