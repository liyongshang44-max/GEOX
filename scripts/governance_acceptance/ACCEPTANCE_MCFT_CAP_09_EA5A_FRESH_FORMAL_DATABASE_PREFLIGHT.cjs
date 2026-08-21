'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = '6fd839dfafb8f62da637dea2b46b0003da680596';
const F = {
  authority: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V3.json',
  probe: 'scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5A_FRESH_FORMAL_DATABASE.ts',
  gate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5A_FRESH_FORMAL_DATABASE_PREFLIGHT.cjs',
  workflow: '.github/workflows/mcft-cap-09-ea5a-fresh-formal-database-preflight.yml',
};
const AUTHORITY_BLOB = 'fae82fdac5befddbed94ce47fedda517d75741eb';
const EXPECT = [F.probe, F.gate, F.workflow].sort();
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA5A_FRESH_FORMAL_DATABASE_PREFLIGHT_GOVERNANCE_RESULT.json');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git('rev-parse', `${ref}:${file}`);
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const req = (ok, code) => { if (!ok) throw new Error(code); };

const result = {
  schema_version: 'geox_mcft_cap09_ea5a_fresh_formal_database_preflight_governance_v3',
  status: 'FAIL',
  base_sha: BASE,
  exact_file_count: 0,
  database_write_count: 0,
  formal_evidence_write_count: 0,
  schema_write_count: 0,
  formal_window_started: false,
  fresh_bootstrap_authorized: false,
  ea5e2_operational_activation_authorized: false,
  mcft_cap09_completed: false,
};

try {
  req(BASE === EXPECTED_BASE, `EA5A_V3_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  Object.assign(result, { changed_files: changed, exact_file_count: changed.length });
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA5A_V3_EXACT_THREE_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);
  req(blob('HEAD', F.authority) === AUTHORITY_BLOB, 'EA5A_V3_AUTHORITY_BLOB_DRIFT');

  const authority = json(F.authority);
  const probe = read(F.probe);
  const workflow = read(F.workflow);

  req(authority.schema_version === 'geox_mcft_cap09_ea5a_fresh_formal_database_preflight_v3', 'EA5A_V3_SCHEMA_VERSION_REQUIRED');
  req(authority.record_status === 'T4R1_FRESH_FORMAL_DATABASE_REQUIRED_NOT_YET_QUALIFIED', 'EA5A_V3_AUTHORITY_STATUS_DRIFT');
  const db = authority.formal_database_identity || {};
  req(db.provider === 'NEON_POSTGRES', 'EA5A_V3_NEON_PROVIDER_REQUIRED');
  req(db.project_id === 'delicate-glade-62464340', 'EA5A_V3_NEON_PROJECT_ID_DRIFT');
  req(db.branch_id === 'br-cold-dust-a6j6aymz', 'EA5A_V3_NEON_BRANCH_ID_DRIFT');
  req(db.database_name === 'geox_mcft_cap09_s6_formal_t4r1_24h', 'EA5A_V3_T4R1_DATABASE_REQUIRED');
  req(db.connection_secret_name === 'GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL', 'EA5A_V3_T4R1_SECRET_REQUIRED');
  req(db.simulation_branch_id_forbidden === 'br-falling-cake-a6lfsdak', 'EA5A_V3_SIMULATION_BRANCH_GUARD_DRIFT');
  req(db.existing_t1r1_database_name_forbidden_as_t4r1_storage === 'geox_mcft_cap09_s6_formal_24h', 'EA5A_V3_T1R1_DATABASE_REUSE_GUARD_REQUIRED');
  req(db.existing_t3r1_database_name_forbidden_as_t4r1_storage === 'geox_mcft_cap09_s6_formal_t3r1_24h', 'EA5A_V3_T3R1_DATABASE_REUSE_GUARD_REQUIRED');

  const scope = authority.formal_scope || {};
  req(scope.tenant_id === 'tenant_mcft_external'
    && scope.project_id === 'project_mcft_cap09'
    && scope.group_id === 'group_public_research'
    && scope.field_id === 'field_kbs_mcse_t4r1'
    && scope.season_id === 'season_2026_corn'
    && scope.zone_id === 'zone_kbs_mcse_t4r1_crop_formal_v1', 'EA5A_V3_T4R1_SCOPE_DRIFT');

  const fresh = authority.fresh_database_requirements || {};
  req(fresh.schema_must_match_formal_runtime_requirements === true, 'EA5A_V3_SCHEMA_MATCH_REQUIRED');
  for (const key of [
    'facts_total',
    'twin_lineage_v1_total',
    'twin_state_estimate_v1_total',
    'twin_forecast_v1_total',
    'twin_runtime_checkpoint_latest_index_v1_total',
    'twin_shadow_online_scheduler_slot_v1_total',
    't1r1_scope_row_count',
    't3r1_scope_row_count_before_bootstrap',
    't4r1_scope_row_count_before_bootstrap',
  ]) req(fresh[key] === 0, `EA5A_V3_ZERO_REQUIREMENT_DRIFT:${key}`);
  req(fresh.cross_scope_canonical_stitching_authorized === false, 'EA5A_V3_CROSS_SCOPE_STITCHING_MUST_REMAIN_FORBIDDEN');
  req(JSON.stringify(authority.qualification_sequence) === JSON.stringify([
    'CREATE_DISTINCT_EMPTY_DATABASE_WITHOUT_COPYING_T1R1_CANONICAL_ROWS',
    'APPLY_REQUIRED_SCHEMA_ONLY',
    'RUN_READ_ONLY_ZERO_STATE_PREFLIGHT',
    'BIND_SECRET_TO_EXACT_DATABASE_IDENTITY',
    'ONLY_THEN_AUTHORIZE_T4R1_FRESH_BOOTSTRAP',
  ]), 'EA5A_V3_QUALIFICATION_SEQUENCE_DRIFT');

  for (const token of [
    'GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V3.json',
    'BEGIN TRANSACTION READ ONLY',
    "current_setting('neon.project_id', true)",
    "current_setting('neon.branch_id', true)",
    'EA5A_T1R1_DATABASE_REUSE_FORBIDDEN',
    'EA5A_T3R1_DATABASE_REUSE_FORBIDDEN',
    'EA5A_SIMULATION_BRANCH_REUSE_FORBIDDEN',
    't1r1_scope_row_count',
    't3r1_scope_row_count_before_bootstrap',
    't4r1_scope_row_count_before_bootstrap',
    'secret_binding_required_next: true',
    'fresh_bootstrap_authorized: false',
    'ea5e2_operational_activation_authorized: false',
    'formal_o00_start_authorized: false',
  ]) req(probe.includes(token), `EA5A_V3_PROBE_TOKEN_MISSING:${token}`);
  req(!/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|MERGE)\s+(?:INTO\s+|TABLE\s+|FROM\s+)?[A-Za-z_]/i.test(probe), 'EA5A_V3_MUTATING_SQL_SURFACE_FORBIDDEN');
  req(!/\bfetch\s*\(|https?:\/\//.test(probe), 'EA5A_V3_PUBLIC_NETWORK_SURFACE_FORBIDDEN');

  req(workflow.includes('persist-credentials: false'), 'EA5A_V3_WORKFLOW_PERSIST_CREDENTIALS_FORBIDDEN');
  req(workflow.includes(F.authority), 'EA5A_V3_WORKFLOW_AUTHORITY_TRIGGER_REQUIRED');
  req(workflow.includes('GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL'), 'EA5A_V3_WORKFLOW_T4R1_DATABASE_SECRET_REQUIRED');
  req(!workflow.includes('secrets.GEOX_MCFT_CAP09_S6_DATABASE_URL'), 'EA5A_V3_WORKFLOW_T1R1_DATABASE_SECRET_FORBIDDEN');
  req(!workflow.includes('secrets.GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL'), 'EA5A_V3_WORKFLOW_T3R1_DATABASE_SECRET_FORBIDDEN');
  req(workflow.includes('geox_mcft_cap09_s6_formal_t4r1_24h'), 'EA5A_V3_WORKFLOW_T4R1_DATABASE_IDENTITY_REQUIRED');
  req(workflow.includes('MCFT_BASE_SHA') && workflow.includes('MCFT_SUBJECT_SHA'), 'EA5A_V3_WORKFLOW_EXACT_SHA_ENV_MISSING');
  req(!/workflow_dispatch|schedule:/.test(workflow), 'EA5A_V3_PR_ONLY_PREFLIGHT_REQUIRED');

  Object.assign(result, {
    status: 'PASS',
    authority_blob: blob('HEAD', F.authority),
    probe_blob: blob('HEAD', F.probe),
    fresh_formal_database_identity_qualification_required: true,
    fresh_external_scope_preflight_required: true,
    secret_binding_required_next: true,
    t1r1_database_reuse_authorized: false,
    t3r1_database_reuse_authorized: false,
    simulation_branch_reuse_authorized: false,
    fresh_bootstrap_authorized: false,
    ea5e2_operational_activation_authorized: false,
    formal_o00_start_authorized: false,
  });
} catch (error) {
  result.error = `${error.name || 'Error'}:${error.message || String(error)}`;
  process.exitCode = 1;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
if (result.status === 'PASS') console.log(JSON.stringify(result)); else console.error(result.error);
