# Decisions

- 2026-09-17: repair audited foundation before new modules. Preserve array list contracts through cursor query parameters and X-Next-Cursor. Normalize meaningful text; represent nullable responses truthfully.
- 2026-09-17: enforce module-to-supplier ownership with database foreign keys, including Lead supplier/organization consistency. Restrict deletion while module records remain. Invalid historical references block migration; no automatic customer-data deletion or guessed ownership.
- 2026-09-17: outbox dispatcher is opt-in and at least once. Consumers deduplicate on event ID, use bounded timeouts, and are explicitly registered. No-consumer events remain pending; ten attempts require operator review. External automation remains unimplemented.
- 2026-09-17: dependency overrides are scoped security repairs (multer 2.3.0; xcode's uuid 11.1.1). Full dependency audit and current-tree secret patterns now gate CI; scan coverage limitations remain documented.

- 2026-09-16: revised PDFs supersede the prior backend-only repository and independent service/databases interpretation. One monorepo, one NestJS process, one owned-table PostgreSQL schema.
- Core owns suppliers and organization membership. Presence owns presentation, not business identity. Leads can accept opted-in inquiries without Presence.
- Role checks and module entitlements run server-side. Baseline Presence/Leads are free foundation capabilities; paid features require later verified billing integration.
- In-process contracts plus atomic outbox storage prepare async work; no unsupported delivery guarantees are claimed before implementing consumers and retries.
- Editions compose modules without source duplication. Initial composition tests do not imply standalone commercial products are released.
- Keep Cloudflare at the edge; private origin access and explicit proxy trust. No hosting/provider provisioning is bundled with code changes.
- Protect main with reviewed PRs and CI. CODEOWNERS lists the current verified repository account; add the second engineer/team and require independent review in GitHub settings before team work. Adding CODEOWNERS does not itself enable branch protection.

## Presence image V1 and separate frontend repositories

Keep all backend modules and one PostgreSQL schema in Main Core. Create separate module frontend repositories later with reusable features/shared contract packages, allowing a combined Growth OS app. Preserve both Android/iOS targets and defer iPhone device testing until Apple membership. Prepare free staging without provisioning accounts. Use immutable backend-processed images initially; direct storage uploads/video/cleanup are later scope. Presence-owned content uses one typed table with kind-specific validation and SQL constraints. See the Presence handoff for compatibility and deployment gates.
