# One database, explicit ownership

## September 17 integrity update

New transactional migrations preserve existing data and add Presence supplier references, composite Lead supplier/organization references, audit correlation and outbox delivery metadata. Run `integrity-preflight.sql` on a verified staging copy before an existing-database upgrade. Orphan/mismatched records cause the migration to fail; no automatic cleanup is performed. Supplier/organization deletion is restricted while module records reference the supplier. See `docs/audits/2026-09-17-remediation.md` for the policy and test evidence.

The only schema is `backend/prisma/schema.prisma`; the only migration history is `backend/prisma/migrations`. This directory documents ownership and transitions; do not add a second schema here.

Core: `core_*`. Presence: `presence_profiles`. Leads: `lead_opportunities`. Module repositories may access their own tables only and call Core public services for shared records.

## Transition from the earlier two-database scaffold

The new initial migration is for an **empty target database**. It does not upgrade the old `core_db`/`growth_db`, rename their existing tables, or import real data. The repository's prior baseline remains in Git at commit `4d0f36d`.

If an earlier version has been deployed, do not switch DATABASE_URL or run this as an in-place upgrade. Take verified backups, restore copies into staging, and write/review a one-time importer against those copies:

1. Preserve user IDs and password hashes when mapping identity/profile/consent/subscription/notification records to `core_*`. Translate feature names (`growth:*` to the correct new module entitlement) explicitly.
2. Create an organization and OWNER membership for each existing supplier owner. Preserve supplier IDs; split canonical business identity into `core_suppliers` and presentation/slug/publication into `presence_profiles`.
3. Map each old lead to its supplier's new organization and preserve lead IDs, contact consent, source, stage and timestamps. Use actual recorded consent version; flag missing legacy evidence for review instead of inventing it.
4. Check counts, uniqueness, orphan UUIDs and tenant ownership. Rehearse API flows. Revoke old sessions and require login on cutover because API audiences/routes and session storage have changed.
5. Freeze old writes, repeat verified import, switch staging first and then the planned production cutover. Preserve old databases read-only during the rollback window. Never delete them as part of this refactor.

No production migration has been performed by this PR. An automatic importer is deliberately not provided without real legacy deployment/schema evidence.
