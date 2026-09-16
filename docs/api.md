# API contract v1

JSON over HTTPS in production. Supply `Authorization: Bearer <accessToken>` on authenticated requests. Request bodies reject unknown fields. Error bodies use `{ "error": "CODE", "requestId": "..." }`. Never send database credentials to frontends. Keep refresh tokens in platform secure storage; do not put them in URLs or application logs.

## Shared API

| Method and route | Body/query | Result |
| --- | --- | --- |
| POST `/v1/auth/register` | `email`, `password` (12–128 characters), `displayName` | 201 token pair |
| POST `/v1/auth/login` | `email`, `password` | 200 token pair |
| POST `/v1/auth/refresh` | `refreshToken` | Replacement token pair; old refresh token becomes unusable |
| POST `/v1/auth/logout` | Bearer token | 204; current session revoked |
| GET `/v1/me` | Bearer token | Safe profile and preferences |
| PATCH `/v1/me` | Any of `displayName`, `locale`, IANA `timezone`, `notificationPreferences: {email, push}` | Updated profile |
| GET `/v1/access` | Bearer token | `userId`, `features[]` |
| GET `/v1/subscriptions` | Bearer token | `items[]` of user's subscriptions, up to 100 |
| GET `/v1/sessions` | Bearer token | `items[]` of active sessions, up to 100 |
| DELETE `/v1/sessions/:id` | Session UUID, Bearer token | 204, only own sessions |
| POST `/v1/consents` | `purpose`: marketing/analytics, `version`, `granted` | 201 append-only consent record |
| GET `/v1/consents` | `limit`, `offset` | Most recent consent records first |
| GET `/v1/notifications` | `limit`, `offset` | Notification inbox |
| PATCH `/v1/notifications/:id/read` | Notification UUID, Bearer token | 204, only own notifications |
| GET `/.well-known/jwks.json` | Public | Public signing key only |

Token pair: `{ "accessToken": "...", "refreshToken": "...", "tokenType": "Bearer", "expiresIn": 600 }`.

## Growth module API

| Method and route | Access | Behavior |
| --- | --- | --- |
| PUT `/v1/supplier` | `growth:presence` | Create/replace your supplier presence; ownership comes from the token |
| GET `/v1/supplier` | `growth:presence` | Your supplier or 404 |
| GET `/v1/public/suppliers/:slug` | Public | Published profile only |
| POST `/v1/public/suppliers/:slug/inquiries` | Public | Capture a guest inquiry for a published supplier; 201 `{received:true}` |
| GET `/v1/leads` | `growth:leads` | Only own supplier's leads; optional `stage`, `limit`, `offset` |
| PATCH `/v1/leads/:id` | `growth:leads` | Change own lead's stage; 204 or 404 |

Supplier PUT body (full replacement):

```json
{
  "slug": "beirut-photo-studio",
  "businessName": "Beirut Photo Studio",
  "description": "Wedding and event photography.",
  "category": "Photography",
  "city": "Beirut",
  "serviceAreas": ["Beirut", "Mount Lebanon"],
  "published": false
}
```

Guest inquiry body:

```json
{
  "name": "Prospect",
  "email": "prospect@example.com",
  "message": "Please send information about your wedding packages.",
  "contactConsent": true,
  "source": "SHARED_LINK"
}
```

`email` or `phone` is required. Optional `campaign` is a bounded identifier. Sources: `PUBLIC_PROFILE`, `QR`, `SHARED_LINK`, `INSTAGRAM`, `FACEBOOK`, `META_ADS`. Display an inquiry-specific contact-permission notice before collecting `contactConsent`; the backend records notice identifier `inquiry-v1`.

Lead stages: `NEW`, `HOT`, `FOLLOW_UP`, `QUALIFIED`, `WON`, `LOST`. PATCH body is `{ "stage": "QUALIFIED" }`. Initial stage changes are manual; there is no AI scoring/qualification engine yet.

Pagination defaults to 25, maximum 100, offset maximum 10,000. Lists sort newest first with an ID tiebreaker. Page boundaries may change as new records arrive; cursor-based pagination is a future addition.

Both services: GET `/health/live` checks process liveness, GET `/health/ready` checks that service's database. Neither reports provider integration health. Common status codes: 400 validation, 401 credentials/session invalid, 403 entitlement denied, 404 missing/not owned, 409 conflict, 429 rate limited, 503 Core/dependency unavailable.

All responses default to `Cache-Control: no-store`. Future public caching must be deliberately limited to safe public representations.
