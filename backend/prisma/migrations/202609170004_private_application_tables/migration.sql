BEGIN;
-- Supabase's Data API must never bypass the NestJS authorization boundary.
-- Core connects as the table owner (or a dedicated server BYPASSRLS role).
-- Private Storage API access uses a server-only key and separate storage tables.
DO $$
DECLARE
  app_table TEXT;
  browser_role TEXT;
BEGIN
  FOREACH app_table IN ARRAY ARRAY[
    'core_users', 'core_sessions', 'core_refresh_tokens', 'core_consents',
    'core_subscriptions', 'core_notifications', 'core_audit_logs',
    'core_organizations', 'core_memberships', 'core_suppliers',
    'core_outbox_events', 'core_catalogs', 'core_media',
    'presence_profiles', 'presence_content', 'presence_content_media',
    'lead_opportunities'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', app_table);
    EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC', app_table);
    FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', app_table, browser_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
COMMIT;
