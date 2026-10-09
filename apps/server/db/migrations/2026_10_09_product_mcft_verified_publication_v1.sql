-- GEOX Product MCFT verified public read publication V1.
-- Separately authorized deployment to the EXISTING operational Product database only.
-- NEVER run against Formal-v5, NEVER attach a trigger to canonical facts,
-- NEVER modify or grant privileges in the Formal-v5 29-table store.
BEGIN;
DO $$
BEGIN
 IF current_database() <> 'geox_mcft_cap09_production_runtime_v1' THEN
   RAISE EXCEPTION 'PRODUCT_MCFT_PUBLICATION_WRONG_DATABASE';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='geox_mcft_publication_writer_v1') THEN
   RAISE EXCEPTION 'PRODUCT_MCFT_PUBLICATION_WRITER_ROLE_NOT_PROVISIONED';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='geox_product_readonly_v1') THEN
   RAISE EXCEPTION 'PRODUCT_MCFT_PUBLICATION_READ_ROLE_NOT_PROVISIONED';
 END IF;
END
$$;
CREATE SCHEMA product_mcft_publication_v1;
REVOKE ALL ON SCHEMA product_mcft_publication_v1 FROM PUBLIC;

CREATE TABLE product_mcft_publication_v1.field_state_receipt_v1 (
 publication_id text PRIMARY KEY CHECK (publication_id ~ '^sha256:[0-9a-f]{64}$'),
 tenant_id text NOT NULL CHECK (tenant_id = 'tenant_mcft_external'),
 project_id text NOT NULL CHECK (project_id = 'project_mcft_cap09'),
 group_id text NOT NULL CHECK (group_id = 'group_public_research'),
 field_id text NOT NULL CHECK (field_id = 'field_kbs_mcse_t4r1'),
 season_id text NOT NULL CHECK (season_id = 'season_2026_corn'),
 zone_id text NOT NULL CHECK (zone_id = 'zone_kbs_mcse_t4r1_crop_formal_v1'),
 source_logical_time timestamptz NOT NULL,
 source_evidence_visible_at timestamptz NOT NULL,
 source_readback_as_of timestamptz NOT NULL,
 certified_at timestamptz NOT NULL,
 source_state_ref text NOT NULL CHECK (length(source_state_ref)>0),
 source_state_hash text NOT NULL CHECK (source_state_hash ~ '^sha256:[0-9a-f]{64}$'),
 source_graph_readback_sha256 text NOT NULL CHECK (source_graph_readback_sha256 ~ '^sha256:[0-9a-f]{64}$'),
 issuer_key_id text NOT NULL CHECK (length(issuer_key_id) BETWEEN 4 AND 96),
 statement_json jsonb NOT NULL CHECK (jsonb_typeof(statement_json)='object'),
 signature_base64 text NOT NULL,
 verification_verdict text NOT NULL CHECK (verification_verdict='SIGNED_SOURCE_GRAPH_VERIFIED'),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT publication_causal_order CHECK(
   source_logical_time <= source_readback_as_of
   AND source_evidence_visible_at <= source_readback_as_of
   AND source_readback_as_of <= certified_at
   AND certified_at <= received_at
 )
);
CREATE INDEX field_state_receipt_v1_scope_time_idx
 ON product_mcft_publication_v1.field_state_receipt_v1
 (tenant_id,project_id,group_id,field_id,season_id,zone_id,
  source_logical_time DESC,source_evidence_visible_at DESC,received_at DESC);

CREATE FUNCTION product_mcft_publication_v1.deny_receipt_mutation_v1()
 RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'PRODUCT_MCFT_PUBLICATION_APPEND_ONLY';
END
$$;
CREATE TRIGGER deny_field_state_mutation_v1
 BEFORE UPDATE OR DELETE ON product_mcft_publication_v1.field_state_receipt_v1
 FOR EACH ROW EXECUTE FUNCTION product_mcft_publication_v1.deny_receipt_mutation_v1();

REVOKE ALL ON product_mcft_publication_v1.field_state_receipt_v1 FROM PUBLIC;
GRANT USAGE ON SCHEMA product_mcft_publication_v1 TO geox_mcft_publication_writer_v1, geox_product_readonly_v1;
GRANT SELECT,INSERT ON product_mcft_publication_v1.field_state_receipt_v1
 TO geox_mcft_publication_writer_v1;
GRANT SELECT ON product_mcft_publication_v1.field_state_receipt_v1
 TO geox_product_readonly_v1;
COMMIT;
