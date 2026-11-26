-- P6-A2: exact P2/P3/P3P/P4 table shapes, explicit product namespace.
-- Only the dedicated migration owner may execute this file, inside the runner transaction.
CREATE TABLE geox_manager_v1.field_soil_document_revision_p2_v1 (
 tenant_id text NOT NULL, project_id text NOT NULL, group_id text NOT NULL, field_id text NOT NULL,
 document_id text NOT NULL, revision integer NOT NULL CHECK(revision > 0),
 original_name text NOT NULL, source_label text NOT NULL, original_bytes bytea NOT NULL,
 original_sha256 text NOT NULL, candidate_sha256 text NOT NULL, boundary_sha256 text NOT NULL,
 candidates jsonb NOT NULL, previous_original_sha256 text, upload_fact_id text NOT NULL UNIQUE REFERENCES public.facts(fact_id),
 uploaded_by text NOT NULL, uploaded_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,project_id,group_id,field_id,document_id,revision),
 FOREIGN KEY(tenant_id,field_id) REFERENCES public.field_index_v1(tenant_id,field_id)
);
CREATE TABLE geox_manager_v1.field_soil_document_confirmation_p2_v1 (
 tenant_id text NOT NULL, project_id text NOT NULL, group_id text NOT NULL, field_id text NOT NULL,
 document_id text NOT NULL, revision integer NOT NULL, candidate_sha256 text NOT NULL,
 confirmation_fact_id text NOT NULL UNIQUE REFERENCES public.facts(fact_id), confirmed_by text NOT NULL, confirmed_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,project_id,group_id,field_id,document_id,revision),
 FOREIGN KEY(tenant_id,project_id,group_id,field_id,document_id,revision) REFERENCES geox_manager_v1.field_soil_document_revision_p2_v1(tenant_id,project_id,group_id,field_id,document_id,revision)
);
CREATE TABLE geox_manager_v1.field_crop_review_p3_v1 (
 tenant_id text NOT NULL,project_id text NOT NULL,group_id text NOT NULL,field_id text NOT NULL,
 review_id text NOT NULL,actor_id text NOT NULL, intent_sha256 text NOT NULL,
 basis jsonb NOT NULL,result jsonb NOT NULL,result_sha256 text NOT NULL,created_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,project_id,group_id,field_id,review_id),
 FOREIGN KEY(tenant_id,field_id) REFERENCES public.field_index_v1(tenant_id,field_id)
);
CREATE TABLE geox_manager_v1.field_native_assessment_p3p_v1 (
 tenant_id text NOT NULL,project_id text NOT NULL,group_id text NOT NULL,field_id text NOT NULL,
 analysis_id text NOT NULL,review_id text NOT NULL,actor_id text NOT NULL,
 result jsonb NOT NULL,result_sha256 text NOT NULL,created_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,project_id,group_id,field_id,analysis_id),
 FOREIGN KEY(tenant_id,project_id,group_id,field_id,review_id) REFERENCES geox_manager_v1.field_crop_review_p3_v1(tenant_id,project_id,group_id,field_id,review_id)
);
CREATE TABLE geox_manager_v1.field_context_followup_p4_v1 (
 tenant_id text NOT NULL,project_id text NOT NULL,group_id text NOT NULL,field_id text NOT NULL,
 followup_id text NOT NULL,baseline_id text NOT NULL,actor_id text NOT NULL,
 result jsonb NOT NULL,result_sha256 text NOT NULL,created_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,project_id,group_id,field_id,followup_id),
 FOREIGN KEY(tenant_id,project_id,group_id,field_id,baseline_id) REFERENCES geox_manager_v1.field_native_assessment_p3p_v1(tenant_id,project_id,group_id,field_id,analysis_id)
);
CREATE TABLE geox_manager_v1.migration_ledger_v1 (
 migration_id text PRIMARY KEY,
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[0-9a-f]{64}$'),
 physical_sha256 text NOT NULL CHECK(physical_sha256 ~ '^[0-9a-f]{64}$'),
 subject_commit text NOT NULL CHECK(subject_commit ~ '^[0-9a-f]{40}$'),
 applied_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);
REVOKE ALL ON ALL TABLES IN SCHEMA geox_manager_v1 FROM PUBLIC, geox_runtime_v1;
GRANT SELECT, INSERT ON
 geox_manager_v1.field_soil_document_revision_p2_v1,
 geox_manager_v1.field_soil_document_confirmation_p2_v1,
 geox_manager_v1.field_crop_review_p3_v1,
 geox_manager_v1.field_native_assessment_p3p_v1,
 geox_manager_v1.field_context_followup_p4_v1
 TO geox_runtime_v1;
GRANT SELECT ON geox_manager_v1.migration_ledger_v1 TO geox_runtime_v1;
