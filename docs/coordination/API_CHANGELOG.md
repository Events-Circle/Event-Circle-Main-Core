# API changelog

## 0.2.0 — 2026-09-16 (breaking, pre-release)

- One API at port 4000 replaces Core 4000 and Growth 4001.
- `/v1/auth/*` and account routes move under `/api/v1/core`.
- Supplier canonical identity moves into Core; creation returns supplier and organization IDs. Ownership uses membership and X-Organization-Id.
- Presentation routes move under `/api/v1/presence`; Leads under `/api/v1/leads`.
- Public inquiry addresses supplier UUID and requires consent version; it works without Presence enabled.
- Lead list returns a bounded array; stage patch returns updated lead. Update clients rather than assuming prior response envelopes.
- Generated OpenAPI types replace the earlier hand-written Fastify contracts. Namespace entitlements as presence.* and leads.*.
- Old routes and the context-copy script are removed. Monorepo shared packages replace copied backend contexts.

Regenerate OpenAPI and api-client declarations with every API change. Coordinate consumer changes in the same PR.
