# Deployment and Cloudflare

These are deployment instructions and example configuration. No domain, Cloudflare account, server or paid service has been provisioned by this repository.

## Service isolation

Build independent images:

```sh
docker build --target core -t events-circle-core:0.1.0 .
docker build --target growth -t events-circle-growth:0.1.0 .
```

The Core image contains the shared API and Core generated client. The Growth image contains the Growth API and Growth generated client. Each gets only its own database URL. Growth gets the signing public key and `CORE_API_URL`, never the signing private key or Core database credential. Containers run as an unprivileged user.

Use managed PostgreSQL with encrypted connections, distinct non-superuser application roles and databases. Keep migration credentials separate from runtime credentials; migrations need schema DDL permissions while runtime needs only data access. The local Compose services use development superusers and are **not** the production database setup. Prohibit public database ingress.

Run `npm ci`, `npm run generate` and the appropriate `migrate:*` command from a trusted release runner before starting the matching application version. Supply migration-specific database URLs there. Do not automatically run migrations on every API replica startup. The Docker `build` stage may be used as the migration runner; final runtime targets deliberately omit the Prisma CLI.

## Secrets and configuration

- Store DB URLs and the Core signing key in your deployment secret manager; never commit them.
- Provision a production Ed25519 keypair. Mount the private PEM only into Core and the public PEM into both services. Files must be readable by the container's `node` user.
- Set stable HTTPS `JWT_ISSUER`, `JWT_AUDIENCE=events-circle`, and matching `JWT_KEY_ID` across services.
- Set `NODE_ENV=production`, explicit HTTPS `CORS_ORIGINS`, and correct service ports.
- Use a trusted private network URL or HTTPS for `CORE_API_URL`; the Growth service sends the user's access token to it. Never point it at an untrusted host.
- The current verifier supports one configured public key. Key rotation requires coordinated rollout and reauthentication; zero-downtime multi-key rotation is not implemented yet.

## Cloudflare firewall and origin protection

Use proxied API hostnames, Cloudflare WAF managed/custom rules and API-appropriate rate limits. Capabilities depend on the Cloudflare plan. Keep auth and private API responses uncached. CORS settings are not authorization.

`infra/cloudflared.example.yaml` demonstrates a named tunnel with separate Core and Growth hostnames and a final 404 fallback. Replace example hostnames and the tunnel UUID with your approved values and mount the tunnel credential from secrets. If cloudflared runs on the host, bind native APIs to loopback or map containers with `127.0.0.1:4000:4000` and `127.0.0.1:4001:4001`. Do not expose the origins on public interfaces.

When cloudflared runs in containers, place it and APIs on a private Docker network, use service names in ingress, and publish no API ports. Network segmentation must prevent unrelated workloads from reaching APIs directly.

`TRUST_PROXY_CIDRS` is empty by default. Set it only to the actual trusted connector/proxy peer addresses after protecting the origin. Never set `true`, `*`, or broad untrusted ranges. The API does not blindly trust `CF-Connecting-IP`. Application limits use Fastify's validated client IP and are per-process; apply distributed edge limits at Cloudflare when scaling. Never rely on per-process limits alone for production account-abuse prevention.

Recommended starting rules: tighten `/v1/auth/*` and public inquiry rates; allow only intended methods; block obvious exploit patterns; ensure health endpoints expose no sensitive details. Test rules with mobile API calls before enforcing browser challenges on API routes.

References: [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/), [Cloudflare WAF](https://developers.cloudflare.com/waf/), [Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/).

## Launch gates and operations

This foundation has no verified email/recovery, billing provider, outbound notifications, coordinated deletion, background worker or external integration. Complete the appropriate milestones before public production launch. In particular, guest inquiry intake currently has rate limits but no bot challenge/provider verification; add abuse monitoring and suitable edge protection before exposing it at scale.

Use encrypted backups and restore drills per database. Alert on readiness failures, auth failures/replay events, 5xx rates, DB latency and disk usage. Do not log passwords, tokens, inquiry text or private contact details. Decide retention policies before enabling collection from real users.

Rollback deploys a previously tested image compatible with the current schema. For destructive migrations, back up first and follow a separately reviewed plan. Shared and module services can be deployed independently; changes to shared contracts require compatibility checks in both test suites.

CI runs tests against native Postgres and builds both images. Production promotion, secret provisioning, domain/Tunnel setup and provider activation remain explicit deployment steps.
