# API foundation

Authoritative machine-readable contract: `backend/openapi.json`. Generated client: `@events-circle/api-client`. In development, Swagger is available at `/api/docs`. Default HTTP prefix: `/api/v1`.

| Namespace                             | Included operations                                                  |
| ------------------------------------- | -------------------------------------------------------------------- |
| `/core/auth`                          | register, login, refresh, logout, JWKS                               |
| `/core/me`                            | safe profile read/update                                             |
| `/core/sessions`                      | list/revoke own sessions                                             |
| `/core/consents`                      | record and read own consent history                                  |
| `/core/subscriptions`, `/core/access` | read subscription status and effective entitlements                  |
| `/core/memberships`                   | list own organization memberships                                    |
| `/core/suppliers`                     | create canonical supplier/organization; read/update current supplier |
| `/core/notifications`                 | own inbox and read state                                             |
| `/core/modules`, `/core/health`       | module catalog, liveness/readiness                                   |
| `/presence/profile`                   | read/upsert organization presentation                                |
| `/presence/public/:slug`              | published public profile                                             |
| `/leads/public/:supplierId`           | consented guest inquiry for opted-in supplier                        |
| `/leads`, `/leads/:id/stage`          | organization lead list and stage update                              |

Protected requests use `Authorization: Bearer <accessToken>`. Organization-scoped operations also require `X-Organization-Id`; the server verifies membership, role and enabled-module access. Presence and Leads basic permissions are free foundation features. Subscription entitlements are read-only; users cannot grant paid access themselves.

Access tokens expire in ten minutes. Refresh tokens rotate within a 30-day absolute session; replay revokes that session immediately. Logout checks the current session. Frontend persistent credential storage and login screens are not implemented in the starter apps.

All DTOs reject unknown fields. List results are bounded to 100 for the foundation; cursor pagination is pending. Guest inquiry requires email or phone, contact consent and consent version. Source attribution is visitor-supplied metadata, not proof of an ad conversion. Public responses never include internal user/organization IDs or passwords. Errors return status and a request ID without database details.

Basic flow: register → create Core supplier with `acceptInquiries:true` → use returned organization header to save Presence → submit guest inquiry using supplier ID → read/update Leads. Leads does not require a Presence record.
