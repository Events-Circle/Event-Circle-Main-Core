# Decisions

- 2026-09-16: revised PDFs supersede the prior backend-only repository and independent service/databases interpretation. One monorepo, one NestJS process, one owned-table PostgreSQL schema.
- Core owns suppliers and organization membership. Presence owns presentation, not business identity. Leads can accept opted-in inquiries without Presence.
- Role checks and module entitlements run server-side. Baseline Presence/Leads are free foundation capabilities; paid features require later verified billing integration.
- In-process contracts plus atomic outbox storage prepare async work; no unsupported delivery guarantees are claimed before implementing consumers and retries.
- Editions compose modules without source duplication. Initial composition tests do not imply standalone commercial products are released.
- Keep Cloudflare at the edge; private origin access and explicit proxy trust. No hosting/provider provisioning is bundled with code changes.
- Protect main with reviewed PRs and CI. CODEOWNERS lists the current verified repository account; add the second engineer/team and require independent review in GitHub settings before team work. Adding CODEOWNERS does not itself enable branch protection.
