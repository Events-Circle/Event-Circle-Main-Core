# Dependency register

| Consumer                         | Dependency                                                  | Status                      |
| -------------------------------- | ----------------------------------------------------------- | --------------------------- |
| All modules                      | Core identity, permissions, supplier identity, audit/outbox | Implemented foundation      |
| Presence                         | Core only                                                   | Tested composition          |
| Leads                            | Core only; public capture does not need Presence            | Tested composition          |
| All apps                         | Generated OpenAPI client and design tokens                  | Shells; web health wired    |
| Content/Promotions/Hosted Events | Core media/integration ports and published contracts        | Planned                     |
| Circle AI                        | Core Business Brain/gateway, approved module contracts      | Planned                     |
| Connections/Automation           | Core encrypted provider accounts and job delivery           | Planned                     |
| Async integrations               | Idempotent outbox dispatcher and delivery tracking          | Planned; no consumer active |

Do not satisfy missing dependencies with imports into another module's private repository. Update this register when enabling any provider or cross-module event consumer.
