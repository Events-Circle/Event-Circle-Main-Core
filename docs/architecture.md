# Architecture and ownership

The current source of truth is the two revised Events Circle PDFs: GitHub and Code Structure, and Modular Ecosystem Explained. One NestJS process assembles Core and enabled modules. Apps call versioned HTTP APIs; they never import Prisma or backend implementation.

## Dependency direction

Modules → Core → Common. Core never imports modules. Modules may exchange published contracts/events but never import another module's private files or query its tables. `scripts/check-boundaries.mjs` checks source imports and common ownership violations in CI; reviews must also enforce semantic ownership.

Core owns canonical supplier identity, users, sessions, organization membership, role permissions, subscriptions, preferences, consent, notifications, audit and event outbox. A supplier belongs to one organization; membership grants roles within that organization. OWNER can modify supplier/module data, EDITOR can modify module data, VIEWER can read. Creating a supplier also creates its organization and owner membership. Membership invitations and staff/admin rights are not implemented.

Presence owns presentation (`presence_profiles`). Leads owns inquiries (`lead_opportunities`). They reference Core UUIDs through public services. Private requests authenticate live sessions and verify `X-Organization-Id` membership and namespaced permissions server-side. No client-supplied user ID is trusted. Public lead intake targets an explicitly opted-in Core supplier, so Leads works without Presence.

One Prisma schema includes namespaced table mappings. Only module repositories use module tables. Core audit/outbox methods join the same Prisma transaction as business changes. UUID references between owners intentionally avoid cross-module Prisma relation traversal; deleting shared suppliers requires a future coordinated retention workflow.

## Module anatomy

`api` validates DTOs and maps HTTP; `application` handles use cases and authorization; `domain` contains framework-free business rules; `infrastructure` owns persistence/adapters; `contracts` publishes events; `tests` documents/tests behavior. Each module has a README. New modules must work alongside Core without other business modules.

## Events and providers

Business writes insert a Core outbox row atomically. The in-process event port is available, but no external consumers or dispatcher are activated yet. Delivery requires an idempotent consumer, leasing/locking, retries, dead-letter handling and monitoring before production integration. No record is currently claimed as delivered. Events carry organization, correlation and entity identifiers; contact data stays in module tables. AI, Meta, email/calendar and media providers remain planned behind Core or module ports. Approval, spend limits and webhook replay protection must precede enabling those integrations.

## Editions

`backend/src/config/editions` composes the same source. Full Growth OS currently loads its implemented foundation only; other modules remain planned. Presence-only, Leads-only and Core-only are regression compositions, not released standalone products. Disabled modules have no registered controllers and receive no entitlements. Shared user sessions and supplier identity still work.

## Compatibility

This is a breaking pre-release restructure. It replaces two Fastify services/two databases with one NestJS app/one database and replaces old `/v1` paths with `/api/v1/core`, `/api/v1/presence` and `/api/v1/leads`. No legacy compatibility server or production data import runs automatically. See the database transition runbook before deploying against existing data.
