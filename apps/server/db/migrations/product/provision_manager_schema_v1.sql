-- Explicit platform-admin one-shot; never run with runtime or MCFT migration credentials.
-- The product migrator LOGIN must already be provisioned by the credential owner.
-- No password material, no database creation, no changes to public tables or their rows.
BEGIN;
SET LOCAL search_path = pg_catalog;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolsuper)
 OR session_user <> current_user THEN RAISE EXCEPTION 'P6_PLATFORM_ADMIN_REQUIRED'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='geox_product_migrator_v1' AND rolcanlogin AND NOT (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls))
 OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='geox_runtime_v1' AND rolcanlogin AND NOT (rolsuper OR rolcreaterole OR rolcreatedb OR rolreplication OR rolbypassrls))
 THEN RAISE EXCEPTION 'P6_DEDICATED_ROLE_REQUIRED'; END IF;
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='geox_manager_v1')
 OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname='geox_product_migration_owner_v1')
 THEN RAISE EXCEPTION 'P6_PROVISION_ALREADY_EXISTS_REVIEW_NO_ADOPTION'; END IF;
END $$;
CREATE ROLE geox_product_migration_owner_v1 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT geox_product_migration_owner_v1 TO geox_product_migrator_v1 WITH INHERIT FALSE, SET TRUE;
CREATE SCHEMA geox_manager_v1 AUTHORIZATION geox_product_migration_owner_v1;
REVOKE ALL ON SCHEMA geox_manager_v1 FROM PUBLIC, geox_runtime_v1;
GRANT USAGE ON SCHEMA geox_manager_v1 TO geox_runtime_v1;
GRANT USAGE ON SCHEMA public TO geox_product_migration_owner_v1;
GRANT REFERENCES (fact_id) ON public.facts TO geox_product_migration_owner_v1;
GRANT REFERENCES (tenant_id,field_id) ON public.field_index_v1 TO geox_product_migration_owner_v1;
COMMIT;
