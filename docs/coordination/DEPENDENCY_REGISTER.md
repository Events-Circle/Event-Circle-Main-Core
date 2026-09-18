# Dependency register

Circle AI planning foundation (2026-09-18): Core auth/permissions/audit/outbox reused. Business Brain, model gateway, Leads summary contracts, Content execution, Promotions and Connections remain blocking dependencies for live AI/side effects. The first slice stores drafts and decisions only.

| Consumer                         | Dependency                                                   | Status                                                                      |
| -------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| All modules                      | Core identity, permissions, supplier identity, audit/outbox  | Implemented foundation                                                      |
| Presence                         | Core only                                                    | Tested composition                                                          |
| Leads                            | Core only; public capture does not need Presence             | Tested composition                                                          |
| All apps                         | Generated OpenAPI client and design tokens                   | Shells; web health wired                                                    |
| Content/Promotions/Hosted Events | Core media/integration ports and published contracts         | Planned                                                                     |
| Circle AI                        | Core Business Brain/gateway, approved module contracts       | Planned                                                                     |
| Connections/Automation           | Core encrypted provider accounts and job delivery            | Planned                                                                     |
| Async integrations               | Leased at-least-once outbox dispatcher and delivery tracking | Implemented opt-in; consumers must deduplicate; no external consumer active |

Do not satisfy missing dependencies with imports into another module's private repository. Update this register when enabling any provider or cross-module event consumer.

Presence image V1 now consumes Core media and catalog services. Railway S3 private-object storage adapter exists, but live credentials, bucket privacy and network/TLS need deployment verification. External consumers remain disabled. Shared contracts/api-client packages can be packed from a reviewed commit for later frontend repositories.
