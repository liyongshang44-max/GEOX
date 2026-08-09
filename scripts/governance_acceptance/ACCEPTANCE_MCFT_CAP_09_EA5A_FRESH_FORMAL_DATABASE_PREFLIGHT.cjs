'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const BASE = process.env.MCFT_BASE_SHA || '';
const EXPECTED_BASE = 'e8f9b2cca62e04871124581408ca4f3951b3a4cb';
const F = {
  task: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md',
  amendment: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-01-EXTERNAL-PUBLIC-EVIDENCE-AUTHORITY.md',
  recovery: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json',
  authority: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V1.json',
  probe: 'scripts/runtime_acceptance/PREFLIGHT_MCFT_CAP_09_EA5A_FRESH_FORMAL_DATABASE.ts',
  gate: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5A_FRESH_FORMAL_DATABASE_PREFLIGHT.cjs',
  workflow: '.github/workflows/mcft-cap-09-ea5a-fresh-formal-database-preflight.yml',
};
const PINS = {
  task: '39f6a09273c30088a7ea264cfa94ff930ea5518e',
  amendment: '41270b888e15e4d9a6c9a34e1fa3f70e957a275e',
  recovery: '1174940a6908e545e70d87cb65be5b3a41db33cf',
  authority: 'f3a57413d78633685cbc5be7d94f39d9fdc5c62b',
  probe: 'f511235e09de4d303ad45e7a7f3ac9ace9d1a609',
};
const EXPECT = [F.authority, F.probe, F.gate, F.workflow].sort();
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA5A_FRESH_FORMAL_DATABASE_PREFLIGHT_GOVERNANCE_RESULT.json');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const blob = (ref, file) => git('rev-parse', `${ref}:${file}`);
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const req = (ok, code) => { if (!ok) throw new Error(code); };
const result = {
  schema_version: 'geox_mcft_cap09_ea5a_fresh_formal_database_preflight_governance_v1',
  status: 'FAIL', base_sha: BASE, exact_file_count: 0,
  database_write_count: 0, formal_evidence_write_count: 0, schema_write_count: 0,
  formal_window_started: false, mcft_cap09_completed: false,
};

try {
  req(BASE === EXPECTED_BASE, `EA5A_BASE_MAIN_DRIFT:${BASE}`);
  const changed = git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  Object.assign(result, { changed_files: changed, exact_file_count: changed.length });
  req(JSON.stringify(changed) === JSON.stringify(EXPECT), `EA5A_EXACT_FOUR_FILE_BOUNDARY_FAIL:${JSON.stringify(changed)}`);

  req(blob(BASE, F.task) === PINS.task, 'EA5A_TASKBOOK_BLOB_DRIFT');
  req(blob(BASE, F.amendment) === PINS.amendment, 'EA5A_AMENDMENT01_BLOB_DRIFT');
  req(blob(BASE, F.recovery) === PINS.recovery, 'EA5A_EA4_RECOVERY_BLOB_DRIFT');
  req(blob('HEAD', F.authority) === PINS.authority, 'EA5A_AUTHORITY_BLOB_DRIFT');
  req(blob('HEAD', F.probe) === PINS.probe, 'EA5A_PROBE_BLOB_DRIFT');

  const task = read(F.task);
  const amendment = read(F.amendment);
  const recovery = json(F.recovery);
  const authority = json(F.authority);
  const probe = read(F.probe);
  const workflow = read(F.workflow);

  req(task.includes('S6-EA5   Formal Authority V3 + Database Preflight'), 'EA5A_TASKBOOK_LIFECYCLE_MISSING');
  req(task.includes('S6-EA5 fresh-scope Formal bootstrap and preflight'), 'EA5A_TASKBOOK_SEQUENCE_MISSING');
  req(amendment.includes('EXTERNAL_SCOPE_FRESH_BOOTSTRAP_REQUIRED = YES'), 'EA5A_FRESH_BOOTSTRAP_AUTHORITY_MISSING');
  req(amendment.includes('CROSS_SCOPE_CANONICAL_STITCHING_FORBIDDEN = YES'), 'EA5A_CROSS_SCOPE_STITCHING_GUARD_MISSING');
  req(amendment.includes('No canonical State, Forecast, Scenario, Checkpoint, Health or lineage member may'), 'EA5A_REPLAY_CANONICAL_STITCHING_PROHIBITION_MISSING');

  const recoveryEffect = recovery.current_authority_effect_if_merged;
  for (const key of ['original_kbs_source_recovered','live_source_qualified','gfs_72h_full_value_pipeline_qualified','future_et0_72h_value_execution_qualified','ea5_candidate_development_authorized']) req(recoveryEffect?.[key] === true, `EA5A_EA4_RECOVERY_EFFECT_MISSING:${key}`);
  req(recoveryEffect?.external_package_formal_eligible === false, 'EA5A_EA4_PACKAGE_MUST_REMAIN_NOT_FORMAL_ELIGIBLE');
  req(recovery.next_legal_successor_if_effective === 'S6-EA5_FORMAL_AUTHORITY_V3_AND_DATABASE_PREFLIGHT', 'EA5A_EA4_SUCCESSOR_DRIFT');

  req(authority.record_status === 'EA5A_FRESH_FORMAL_DATABASE_PREFLIGHT_CANDIDATE_NOT_EFFECTIVE', 'EA5A_AUTHORITY_STATUS_DRIFT');
  req(authority.base_main_sha === BASE, 'EA5A_AUTHORITY_BASE_DRIFT');
  req(authority.taskbook_blob_sha === PINS.task && authority.amendment_01_blob_sha === PINS.amendment && authority.ea4_recovery_blob_sha === PINS.recovery, 'EA5A_AUTHORITY_PREDECESSOR_PIN_DRIFT');
  const db = authority.formal_database_identity;
  req(db.provider === 'NEON_POSTGRES', 'EA5A_NEON_PROVIDER_REQUIRED');
  req(db.project_id === 'delicate-glade-62464340', 'EA5A_NEON_PROJECT_ID_DRIFT');
  req(db.branch_id === 'br-cold-dust-a6j6aymz', 'EA5A_NEON_FORMAL_MAIN_BRANCH_DRIFT');
  req(db.database_name === 'geox_mcft_cap09_s6_formal_24h', 'EA5A_NEON_DATABASE_NAME_DRIFT');
  req(db.simulation_branch_id_forbidden === 'br-falling-cake-a6lfsdak', 'EA5A_SIMULATION_BRANCH_GUARD_DRIFT');
  req(db.connection_secret_name === 'GEOX_MCFT_CAP09_S6_DATABASE_URL', 'EA5A_DATABASE_SECRET_NAME_DRIFT');

  const scope = authority.formal_scope;
  req(scope.tenant_id === 'tenant_mcft_external' && scope.project_id === 'project_mcft_cap09' && scope.group_id === 'group_public_research' && scope.field_id === 'field_kbs_mcse_t1r1' && scope.season_id === 'season_2026_corn' && scope.zone_id === 'zone_kbs_mcse_t1r1_formal_v1', 'EA5A_FORMAL_SCOPE_DRIFT');
  req(Array.isArray(authority.required_schema_tables) && authority.required_schema_tables.includes('facts') && authority.required_schema_tables.includes('twin_shadow_online_scheduler_slot_v1') && authority.required_schema_tables.includes('twin_runtime_checkpoint_latest_index_v1'), 'EA5A_REQUIRED_SCHEMA_CONTRACT_INCOMPLETE');
  for (const [key, expected] of Object.entries(authority.fresh_database_requirements || {})) req(expected === 0, `EA5A_NONZERO_FRESH_DATABASE_REQUIREMENT:${key}`);
  req(authority.fresh_database_requirements.facts_total === 0 && authority.fresh_database_requirements.field_c8_demo_reference_count === 0 && authority.fresh_database_requirements.forbidden_action_fact_count_global === 0, 'EA5A_FRESH_DATABASE_CORE_ZERO_REQUIREMENTS_MISSING');

  const ro = authority.read_only_preflight;
  req(ro.transaction_mode === 'READ_ONLY' && ro.database_write_count === 0 && ro.formal_evidence_write_count === 0 && ro.schema_write_count === 0 && ro.public_provider_request_count === 0 && ro.formal_window_started === false, 'EA5A_READ_ONLY_BOUNDARY_DRIFT');
  const effect = authority.success_effect_if_merged;
  req(effect.fresh_formal_database_identity_qualified === true && effect.fresh_external_scope_preflight_qualified === true, 'EA5A_SUCCESS_EFFECT_MISSING');
  req(effect.simulation_branch_reuse_authorized === false && effect.ea5b_restricted_formal_ingress_candidate_authorized === true, 'EA5A_SUCCESSOR_OR_SIMULATION_BOUNDARY_DRIFT');
  req(effect.external_package_formal_eligible === false && effect.formal_o00_start_authorized === false && effect.mcft_cap09_completed === false, 'EA5A_PREMATURE_FORMAL_EFFECT');

  for (const token of [
    'BEGIN TRANSACTION READ ONLY',
    "current_setting('neon.project_id', true)",
    "current_setting('neon.branch_id', true)",
    'EA5A_SIMULATION_BRANCH_REUSE_FORBIDDEN',
    'EA5A_FRESH_DATABASE_REQUIREMENT_FAIL',
    'field_c8_demo',
    'FORBIDDEN_ACTION_TYPES',
    'ea5b_restricted_formal_ingress_candidate_authorized: true',
    'external_package_formal_eligible: false',
    'formal_o00_start_authorized: false',
  ]) req(probe.includes(token), `EA5A_PROBE_TOKEN_MISSING:${token}`);
  req(!/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|MERGE)\s+(?:INTO\s+|TABLE\s+|FROM\s+)?[A-Za-z_]/i.test(probe), 'EA5A_MUTATING_SQL_SURFACE_FORBIDDEN');
  req(!/\bfetch\s*\(|https?:\/\//.test(probe), 'EA5A_PUBLIC_NETWORK_SURFACE_FORBIDDEN');

  req(workflow.includes('persist-credentials: false'), 'EA5A_WORKFLOW_PERSIST_CREDENTIALS_FORBIDDEN');
  req(workflow.includes('GEOX_MCFT_CAP09_S6_DATABASE_URL'), 'EA5A_WORKFLOW_FORMAL_DATABASE_SECRET_MISSING');
  req(workflow.includes('MCFT_BASE_SHA') && workflow.includes('MCFT_SUBJECT_SHA'), 'EA5A_WORKFLOW_EXACT_SHA_ENV_MISSING');
  req(!/GEOX_MCFT_CAP09_S6_CANONICAL_INPUT_JSON/.test(workflow), 'EA5A_CANONICAL_INPUT_SECRET_FORBIDDEN');
  req(!/workflow_dispatch|schedule:/.test(workflow), 'EA5A_PR_ONLY_PREFLIGHT_REQUIRED');

  Object.assign(result, {
    status: 'PASS', authority_blob: blob('HEAD', F.authority), probe_blob: blob('HEAD', F.probe),
    fresh_formal_database_identity_qualification_required: true,
    fresh_external_scope_preflight_required: true,
    simulation_branch_reuse_authorized: false,
    ea5b_restricted_formal_ingress_candidate_authorized_after_effective_merge: true,
    external_package_formal_eligible: false,
    formal_o00_start_authorized: false,
  });
} catch (error) {
  result.error = `${error.name || 'Error'}:${error.message || String(error)}`;
  process.exitCode = 1;
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
if (result.status === 'PASS') console.log(JSON.stringify(result)); else console.error(result.error);
