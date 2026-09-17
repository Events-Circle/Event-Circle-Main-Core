# Core media

Implemented image upload/processing and organization-scoped reads using a private Railway bucket. Core owns media identity; modules attach immutable READY IDs. See `docs/presence-backend-handoff.md` for limits and deferred deletion/retention. No live provider has been configured or smoke-tested yet.
