# Railway staging deployment — 2026-09-17

Project: Events Circle — Staging. Railway environment label: production (the default name within this dedicated staging project). Application APP_STAGE is staging.

- API: https://events-circle-api-production.up.railway.app
- Readiness: https://events-circle-api-production.up.railway.app/api/v1/core/health/ready
- Source: Events-Circle/Event-Circle-Main-Core, main; application commit 4d25ef1bb82e12b7f5f335d04e55c4cafc3dc5e9.
- Services: events-circle-api, existing Postgres, private presence-media bucket; all in iad, one API replica.
- PostgreSQL uses the private Railway reference. Bucket credentials use references. Persistent Ed25519 keys are server variables, materialized in private temporary files at startup. No secrets committed.
- Explicit Docker builder, infrastructure/docker/backend.Dockerfile, repository root /, startup node /app/scripts/staging-start.mjs, readiness timeout 120 seconds, port 4000. RAILWAY_DOCKERFILE_PATH is also set. New services no longer accept legacy railway.json configuration; service settings were applied directly after the first launch exposed that mismatch.

## Live checks

Passed against the actual Railway API/database/bucket: database readiness, registration, refresh rotation, supplier creation, PNG upload and processed WebP download, Presence profile publication, listing publication, public profile/image reads, public inquiry captured in authenticated Leads, and withdrawal of both public profile and image after unpublishing.

The live test created one clearly labelled synthetic staging supplier/account, one tiny processed image, one listing and one inquiry. The profile is unpublished; the records are retained as private test fixtures, not customer data. No test passwords or tokens are documented.

Redeployment dafc957d-1241-4113-9c23-00b04a539049 succeeded. The original access-token session, private profile, stored WebP and captured inquiry survived redeployment; the session was then logged out. An initial verification-client request timed out; retry passed, and an independent HTTPS readiness request returned 200 with status ready.

## Remaining product work

The module frontend is not built or hosted. PUBLIC_WEB_URL stays unset until it exists; share-link generation remains unavailable. Expo account/project linking and native Android build/device testing are next; iOS native signing/testing follows Apple Developer access. The API health endpoint is JSON, not an application screen.

This is a staging deployment on the existing Railway trial, not a production operations certification. Production backup/restore drills, budget controls, proxy-aware rate-limit configuration and the deferred V1 features remain separate work. No other Railway project was modified.
