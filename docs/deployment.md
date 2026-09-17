# Deployment and Cloudflare

Deploy one backend container plus independently built web/admin/mobile apps from this repository. PostgreSQL remains private. The included Docker Compose is **local database development only**, with loopback binding and development credentials.

Build API from repo root: `docker build -f infrastructure/docker/backend.Dockerfile -t events-circle-api .`. Supply DATABASE_URL, token issuer/audience/key ID, signing-key paths and explicit CORS origins. Mount signing keys read-only under `/run/secrets`; use `HOST=0.0.0.0` inside the container. Run `pnpm --filter @events-circle/backend db:migrate` as a controlled release step before starting the new app, never concurrently from every replica.

Cloudflare proxies public app/API hostnames and applies WAF and request-rate rules. `infrastructure/cloudflare/tunnel.example.yaml` targets the single API. Keep the origin without public ingress; allow the connector to reach it over the private network. Apply authentication and role checks behind Cloudflare too. Never trust arbitrary forwarded IP headers: configure `TRUST_PROXY_CIDRS` for only the connector's actual network addresses. Empty means trust no proxy. Application rate limits use local memory, so multiple replicas need a shared rate-limit store or corresponding edge limits.

The Cloudflare file is a template, not an installed firewall. Replace the tunnel UUID, credentials mount and hostname in the deployment environment; do not commit credentials. Review managed/custom WAF rules and plan-specific availability in Cloudflare. Protect authentication and public lead capture from automated abuse; consider Turnstile before public launch. Do not cache authenticated responses.

Readiness: `/api/v1/core/health/ready`; liveness: `/api/v1/core/health`. Keep deployment logs free of authorization headers and lead contact bodies. Back up PostgreSQL, test restore, protect signing keys, configure alerts and verify staging before production. Email verification/recovery, retention/deletion, billing webhooks and external outbox delivery remain release blockers for their corresponding product features.
