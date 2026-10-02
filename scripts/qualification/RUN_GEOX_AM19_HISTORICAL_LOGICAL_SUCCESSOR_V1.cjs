#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const SOURCE_PATH = 'scripts/qualification/RUN_GEOX_AM19_PERSISTENT_24T_QUALIFICATION_V1.cjs';
const SOURCE = path.resolve(SOURCE_PATH);
const SOURCE_BLOB = '46c67bbbabac1ee08182cbea60f3cbd0419c4045';
const EXPECTED_CONTRACT_ID = 'MCFT_CAP09_AM19_PERSISTENT_24T_HISTORICAL_LOGICAL_V1';
const EXPECTED_DATABASE_PROVISIONER_REF = 'scripts/qualification/PROVISION_MCFT_CAP09_AM19_RUN_SCOPED_DATABASES_V1.cjs';
const EXPECTED_DATABASE_EXECUTION_PLANE = 'LOCAL_EPHEMERAL_PINNED_POSTGRES_CONTAINER';
const EXPECTED_SCHEMA_CLIENT_POLICY = 'CONTRACT_FIXED_EXACT_POSTGRESQL_18_IMAGE_AT_SHA256_DIGEST_REMOTE_READ_ONLY_SCHEMA_CLIENT';
const EXPECTED_SCHEMA_CLIENT_USAGE = 'REMOTE_PARENT_READ_ONLY_PSQL_AND_PG_DUMP_ONLY';
const EXPECTED_SCHEMA_CLIENT_MAJOR = 18;
const SOURCE_CORE_REQUIRE = "require('./qualification_core_v1.cjs')";
const SOURCE_CONTRACT_GATE = "if (contract.schema_version !== 'geox_qualification_contract_v1' || contract.contract_id !== 'MCFT_CAP09_AM19_PERSISTENT_24T_V1') throw new Error('AM19_QMIG_CONTRACT_SCHEMA_OR_ID_UNSUPPORTED');";
const SUCCESSOR_CONTRACT_GATE = `if (contract.schema_version !== 'geox_qualification_contract_v1' || contract.contract_id !== '${EXPECTED_CONTRACT_ID}') throw new Error('AM19_HISTORICAL_SUCCESSOR_CONTRACT_SCHEMA_OR_ID_UNSUPPORTED');`;
const SOURCE_EXPIRY_GATE = "if (Date.now() >= Date.parse(expires)) throw new Error('AM19_QMIG_CANDIDATE_EXPIRED');";
const HISTORICAL_EXPIRY_GATE = "if (process.env.GEOX_AM19_HISTORICAL_LOGICAL_EPOCH_ACK !== 'true' || expires !== String(process.env.MCFT_CAP09_HISTORICAL_CANDIDATE_EXPIRES_AT ?? '')) throw new Error('AM19_HISTORICAL_SUCCESSOR_CANDIDATE_EXPIRY_PROVENANCE_REQUIRED');";
const SOURCE_ADAPTER_SELFTEST_CALL = "    exec('pnpm', ['exec', 'tsx', contract.controlled_adapter_ref, 'selftest'], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'AM19_QMIG_CONTROLLED_ADAPTER_SELFTEST_FAILED' });";
const SUCCESSOR_ADAPTER_SELFTEST_CALL = `    exec('node', [contract.database_provisioner_ref, 'run', '--postgres-image', postgresImage, '--schema-client-image', contract.schema_client_image], { cwd: workspaceDir, env: qenv, logFile, errorCode: 'AM19_QMIG_RUN_SCOPED_DATABASE_PROVISION_FAILED' });\n${SOURCE_ADAPTER_SELFTEST_CALL}`;
const SOURCE_REPOSITORY_INPUTS = "    const repositoryInputs = [...new Set([...contract.governed_dependency_refs, contract.historical_runner_ref, contract.controlled_adapter_ref])].sort().map((ref) => ({";
const SUCCESSOR_REPOSITORY_INPUTS = "    const repositoryInputs = [...new Set([...contract.governed_dependency_refs, contract.historical_runner_ref, contract.controlled_adapter_ref, contract.database_provisioner_ref])].sort().map((ref) => ({";
const SOURCE_QENV_LOCAL_DB_BINDING = "      DATABASE_URL: localDatabaseUrl,\n      PYTHON: py,";
const SUCCESSOR_QENV_LOCAL_DB_BINDING = "      DATABASE_URL: localDatabaseUrl,\n      GEOX_AM19_QUALIFICATION_DATABASE_BASE_URL: localDatabaseUrl,\n      GEOX_AM19_QMIG_LOCAL_POSTGRES_CONTAINER: container,\n      PYTHON: py,";
const SOURCE_CONTROLLED_ENV_DATABASE_SUMMARY = "      qualification_blocked_database: blockedDb,\n      credential_names_present:";
const SUCCESSOR_CONTROLLED_ENV_DATABASE_SUMMARY = "      qualification_blocked_database: blockedDb,\n      qualification_database_execution_plane: 'LOCAL_EPHEMERAL_PINNED_POSTGRES_CONTAINER',\n      remote_parent_database_access: 'READ_ONLY',\n      schema_client_image: contract.schema_client_image,\n      schema_client_required_major: contract.schema_client_required_major,\n      schema_client_usage_policy: contract.schema_client_usage_policy,\n      credential_names_present:";
const SOURCE_DATABASE_PROOF_MUTATION = "      remote_qualification_database_mutation: true,\n      production_database_mutation: false,";
const SUCCESSOR_DATABASE_PROOF_MUTATION = "      remote_qualification_database_mutation: false,\n      local_ephemeral_qualification_database_mutation: true,\n      qualification_database_execution_plane: 'LOCAL_EPHEMERAL_PINNED_POSTGRES_CONTAINER',\n      remote_parent_database_access: 'READ_ONLY',\n      production_database_mutation: false,";

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function sha256Buffer(value) { return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`; }
function sha256File(file) { return sha256Buffer(fs.readFileSync(file)); }
function canonicalIso(value, code) { const t = Date.parse(value); if (!Number.isFinite(t) || new Date(t).toISOString() !== value) throw new Error(code); return value; }
function git(...args) { return execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim(); }
function exactReplace(source, oldValue, newValue, code) { const count = source.split(oldValue).length - 1; assert.equal(count, 1, `${code}:${count}`); return source.replace(oldValue, newValue); }

function parseArgs(argv) {
  const mode = argv[0];
  if (!['selftest', 'run'].includes(mode)) throw new Error('AM19_HISTORICAL_SUCCESSOR_MODE_REQUIRED');
  const args = { mode };
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`AM19_HISTORICAL_SUCCESSOR_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`AM19_HISTORICAL_SUCCESSOR_ARGUMENT_VALUE_REQUIRED:${key}`);
    args[key] = value;
  }
  for (const key of ['contract', 'subject', 'runtime', 'postgres-image']) if (!args[key]) throw new Error(`AM19_HISTORICAL_SUCCESSOR_ARGUMENT_REQUIRED:${key}`);
  return args;
}

function validateContract(repoRoot, args) {
  const contractPath = path.resolve(repoRoot, args.contract);
  const contract = readJson(contractPath);
  assert.equal(contract.schema_version, 'geox_qualification_contract_v1', 'AM19_HISTORICAL_SUCCESSOR_CONTRACT_SCHEMA_REQUIRED');
  assert.equal(contract.contract_id, EXPECTED_CONTRACT_ID, 'AM19_HISTORICAL_SUCCESSOR_CONTRACT_ID_REQUIRED');
  assert.equal(contract.contract_version, 1, 'AM19_HISTORICAL_SUCCESSOR_CONTRACT_VERSION_REQUIRED');
  assert.equal(contract.github_actions_execution, 'FORBIDDEN', 'AM19_HISTORICAL_SUCCESSOR_GITHUB_EXECUTION_FORBIDDEN');
  assert.equal(contract.current_2026_crop_window_status, 'CLOSED_NO_RETRY_NO_RECAPTURE_NO_BYPASS', 'AM19_HISTORICAL_SUCCESSOR_CURRENT_CROP_WINDOW_MUST_REMAIN_CLOSED');
  assert.equal(contract.formal_current_season_admission_policy, 'DECOUPLED_UNCHANGED_REAL_CLOCK_CROP_PREFLIGHT', 'AM19_HISTORICAL_SUCCESSOR_FORMAL_ADMISSION_DECOUPLING_REQUIRED');
  assert.equal(contract.qualification_runner_ref, 'scripts/qualification/RUN_GEOX_AM19_HISTORICAL_LOGICAL_SUCCESSOR_V1.cjs', 'AM19_HISTORICAL_SUCCESSOR_RUNNER_REF_REQUIRED');
  assert.equal(contract.database_provisioner_ref, EXPECTED_DATABASE_PROVISIONER_REF, 'AM19_HISTORICAL_SUCCESSOR_DATABASE_PROVISIONER_REF_REQUIRED');
  assert.equal(contract.database_execution_plane, EXPECTED_DATABASE_EXECUTION_PLANE, 'AM19_HISTORICAL_SUCCESSOR_DATABASE_EXECUTION_PLANE_REQUIRED');
  assert.match(contract.schema_client_image, /^postgres@sha256:[0-9a-f]{64}$/, 'AM19_HISTORICAL_SUCCESSOR_SCHEMA_CLIENT_EXACT_IMAGE_REQUIRED');
  assert.equal(contract.schema_client_image_policy, EXPECTED_SCHEMA_CLIENT_POLICY, 'AM19_HISTORICAL_SUCCESSOR_SCHEMA_CLIENT_POLICY_REQUIRED');
  assert.equal(contract.schema_client_required_major, EXPECTED_SCHEMA_CLIENT_MAJOR, 'AM19_HISTORICAL_SUCCESSOR_SCHEMA_CLIENT_MAJOR_REQUIRED');
  assert.equal(contract.schema_client_usage_policy, EXPECTED_SCHEMA_CLIENT_USAGE, 'AM19_HISTORICAL_SUCCESSOR_SCHEMA_CLIENT_USAGE_REQUIRED');
  assert.notEqual(contract.schema_client_image_policy, contract.postgres_image_policy, 'AM19_HISTORICAL_SUCCESSOR_SCHEMA_CLIENT_AND_LOCAL_POSTGRES_POLICY_MUST_REMAIN_DISTINCT');
  return { contract, contractPath };
}

function validateDescriptor(repoRoot, contract) {
  const descriptorPath = path.resolve(repoRoot, contract.historical_logical_epoch_descriptor_ref);
  const d = readJson(descriptorPath);
  assert.equal(d.schema_version, 'geox_mcft_cap09_am19_historical_logical_epoch_v1', 'AM19_HISTORICAL_SUCCESSOR_DESCRIPTOR_SCHEMA_REQUIRED');
  assert.equal(d.epoch_id, contract.historical_logical_epoch_id, 'AM19_HISTORICAL_SUCCESSOR_EPOCH_ID_MISMATCH');
  assert.equal(d.historical_producer.producer_subject_sha, contract.historical_producer_subject_sha, 'AM19_HISTORICAL_SUCCESSOR_PRODUCER_MISMATCH');
  assert.equal(d.logical_epoch.target_t, contract.historical_target_t, 'AM19_HISTORICAL_SUCCESSOR_TARGET_MISMATCH');
  assert.equal(d.logical_epoch.original_candidate_expires_at, contract.historical_candidate_original_expires_at, 'AM19_HISTORICAL_SUCCESSOR_EXPIRY_PROVENANCE_MISMATCH');
  assert.equal(d.authority_v3_historical_viability.required_context_count, 25, 'AM19_HISTORICAL_SUCCESSOR_25_CONTEXTS_REQUIRED');
  assert.equal(d.authority_v3_historical_viability.passing_context_count, 25, 'AM19_HISTORICAL_SUCCESSOR_25_PASSING_REQUIRED');
  assert.equal(d.retained_raw_objects.length, 2, 'AM19_HISTORICAL_SUCCESSOR_TWO_RETAINED_RAW_REQUIRED');
  assert.equal(d.expected_records.length, 3, 'AM19_HISTORICAL_SUCCESSOR_THREE_RECORDS_REQUIRED');
  const semantic = sha256Buffer(JSON.stringify(d.expected_records));
  assert.equal(semantic, d.logical_epoch.semantic_manifest_digest, 'AM19_HISTORICAL_SUCCESSOR_SEMANTIC_MANIFEST_DIGEST_MISMATCH');
  return { d, descriptorPath };
}

function materializeCandidate(d, subject) {
  const byRole = Object.fromEntries(d.retained_raw_objects.map((x) => [x.record_role, x]));
  assert(byRole.GFS && byRole.SOIL, 'AM19_HISTORICAL_SUCCESSOR_GFS_AND_SOIL_REQUIRED');
  const provenance = (x) => ({
    retention_ref: x.retention_ref,
    raw_sha256: x.raw_sha256,
    raw_bytes: x.raw_bytes,
    retained_at: x.retained_at,
    request_id: x.request_id,
    provider_id: x.provider_id,
    source_family: x.source_family,
    source_locator: x.source_locator,
    final_locator: x.final_locator,
    content_type: x.content_type,
    retrieved_at: x.retrieved_at,
    available_at: x.available_at,
    use_policy_ref: x.use_policy_ref,
  });
  const candidate = {
    schema_version: d.logical_epoch.candidate_schema_version,
    status: 'PASS',
    qualification_mode: 'HISTORICAL_LOGICAL_EPOCH_REPLAY_FROM_IMMUTABLE_PROVENANCE',
    temporal_authority: d.logical_epoch.temporal_authority,
    producer_subject_sha: d.historical_producer.producer_subject_sha,
    subject_sha: d.historical_producer.producer_subject_sha,
    target_t: d.logical_epoch.target_t,
    captured_at: d.logical_epoch.captured_at,
    packaged_at: d.logical_epoch.captured_at,
    candidate_expires_at: d.logical_epoch.original_candidate_expires_at,
    candidate_retention_hours: d.logical_epoch.candidate_retention_hours,
    record_types: d.expected_records.map((x) => x.record_type).sort(),
    source_record_ids: d.expected_records.map((x) => x.source_record_id).sort(),
    semantic_manifest_digest: d.logical_epoch.semantic_manifest_digest,
    rehydration_manifest: {
      expected_records: d.expected_records,
      gfs: { provenance: provenance(byRole.GFS), ingested_at: byRole.GFS.ingested_at },
      soil: { provenance: provenance(byRole.SOIL) }
    },
    raw_retention_refs: d.retained_raw_objects.map((x) => x.retention_ref).sort(),
    raw_ref_ledger: d.retained_raw_objects.map((x) => ({retention_ref:x.retention_ref,retained_sha256:x.raw_sha256,retained_bytes:x.raw_bytes})).sort((a,b)=>a.retention_ref.localeCompare(b.retention_ref)),
    historical_replay_contract: {
      descriptor_epoch_id: d.epoch_id,
      original_artifact_currently_available: false,
      original_expiry_is_provenance_not_current_admission: true,
      current_season_formal_admission_substituted: false,
      provider_refetch_authorized: false,
      qualification_subject_sha: subject
    },
    side_effects: {
      isolated_database_fact_count: 3,
      formal_database_write_count: 0,
      formal_r2_prefix_write_count: 0,
      scheduler_write_count: 0,
      runtime_write_count: 0,
      crop_authority_effect: 'NONE',
      formal_effect: false
    },
    raw_values_emitted: false
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geox-am19-historical-'));
  const file = path.join(root, 'MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json');
  fs.writeFileSync(file, `${JSON.stringify(candidate, null, 2)}\n`);
  return { candidate, file, root };
}

function buildGeneratedRunner(repoRoot, generatedPath) {
  assert.equal(git('rev-parse', `HEAD:${SOURCE_PATH}`), SOURCE_BLOB, 'AM19_HISTORICAL_SUCCESSOR_SOURCE_RUNNER_BLOB_DRIFT');
  let source = fs.readFileSync(SOURCE, 'utf8');
  const corePath = path.resolve(repoRoot, 'scripts/qualification/qualification_core_v1.cjs');
  source = exactReplace(source, SOURCE_CORE_REQUIRE, `require(${JSON.stringify(corePath)})`, 'AM19_HISTORICAL_SUCCESSOR_CORE_REQUIRE_CARDINALITY');
  source = exactReplace(source, SOURCE_CONTRACT_GATE, SUCCESSOR_CONTRACT_GATE, 'AM19_HISTORICAL_SUCCESSOR_CONTRACT_GATE_CARDINALITY');
  source = exactReplace(source, SOURCE_EXPIRY_GATE, HISTORICAL_EXPIRY_GATE, 'AM19_HISTORICAL_SUCCESSOR_EXPIRY_GATE_CARDINALITY');
  source = exactReplace(source, SOURCE_QENV_LOCAL_DB_BINDING, SUCCESSOR_QENV_LOCAL_DB_BINDING, 'AM19_HISTORICAL_SUCCESSOR_LOCAL_DB_QENV_BINDING_CARDINALITY');
  source = exactReplace(source, SOURCE_ADAPTER_SELFTEST_CALL, SUCCESSOR_ADAPTER_SELFTEST_CALL, 'AM19_HISTORICAL_SUCCESSOR_DATABASE_PROVISION_CALL_CARDINALITY');
  source = exactReplace(source, SOURCE_CONTROLLED_ENV_DATABASE_SUMMARY, SUCCESSOR_CONTROLLED_ENV_DATABASE_SUMMARY, 'AM19_HISTORICAL_SUCCESSOR_CONTROLLED_ENV_DATABASE_SUMMARY_CARDINALITY');
  source = exactReplace(source, SOURCE_DATABASE_PROOF_MUTATION, SUCCESSOR_DATABASE_PROOF_MUTATION, 'AM19_HISTORICAL_SUCCESSOR_DATABASE_PROOF_EXECUTION_PLANE_CARDINALITY');
  source = exactReplace(source, SOURCE_REPOSITORY_INPUTS, SUCCESSOR_REPOSITORY_INPUTS, 'AM19_HISTORICAL_SUCCESSOR_REPOSITORY_INPUTS_CARDINALITY');
  assert(!source.includes(SOURCE_CONTRACT_GATE), 'AM19_HISTORICAL_SUCCESSOR_OLD_CONTRACT_GATE_SURVIVED');
  assert(!source.includes(SOURCE_EXPIRY_GATE), 'AM19_HISTORICAL_SUCCESSOR_CURRENT_EXPIRY_GATE_SURVIVED');
  assert(!source.includes(SOURCE_QENV_LOCAL_DB_BINDING), 'AM19_HISTORICAL_SUCCESSOR_LOCAL_DB_QENV_BINDING_NOT_REPLACED');
  assert(source.includes('GEOX_AM19_QUALIFICATION_DATABASE_BASE_URL: localDatabaseUrl'), 'AM19_HISTORICAL_SUCCESSOR_LOCAL_QUALIFICATION_DATABASE_URL_REQUIRED');
  assert(source.includes('GEOX_AM19_QMIG_LOCAL_POSTGRES_CONTAINER: container'), 'AM19_HISTORICAL_SUCCESSOR_LOCAL_POSTGRES_CONTAINER_BINDING_REQUIRED');
  assert(source.includes("'--schema-client-image', contract.schema_client_image"), 'AM19_HISTORICAL_SUCCESSOR_SCHEMA_CLIENT_PROVISIONER_BINDING_REQUIRED');
  assert(source.includes('schema_client_image: contract.schema_client_image'), 'AM19_HISTORICAL_SUCCESSOR_SCHEMA_CLIENT_ENVIRONMENT_EVIDENCE_REQUIRED');
  assert(source.includes('AM19_QMIG_RUN_SCOPED_DATABASE_PROVISION_FAILED'), 'AM19_HISTORICAL_SUCCESSOR_DATABASE_PROVISION_CALL_REQUIRED');
  assert(source.includes('contract.database_provisioner_ref'), 'AM19_HISTORICAL_SUCCESSOR_DATABASE_PROVISIONER_INPUT_REQUIRED');
  assert(source.includes("qualification_database_execution_plane: 'LOCAL_EPHEMERAL_PINNED_POSTGRES_CONTAINER'"), 'AM19_HISTORICAL_SUCCESSOR_DATABASE_EXECUTION_PLANE_EVIDENCE_REQUIRED');
  fs.writeFileSync(generatedPath, source, { flag: 'wx' });
}

function sourceRef(d, descriptorPath) {
  const digest = sha256File(descriptorPath);
  return `geox-historical-logical-epoch-v1://${d.epoch_id}/MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json?descriptor_digest=${encodeURIComponent(digest)}&producer_subject_sha=${d.historical_producer.producer_subject_sha}&target_t=${encodeURIComponent(d.logical_epoch.target_t)}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (String(process.env.GITHUB_ACTIONS || '').toLowerCase() === 'true') throw new Error('AM19_HISTORICAL_SUCCESSOR_GITHUB_ACTIONS_FORBIDDEN');
  const repoRoot = git('rev-parse', '--show-toplevel');
  const subject = String(args.subject);
  assert.match(subject, /^[0-9a-f]{40}$/, 'AM19_HISTORICAL_SUCCESSOR_SUBJECT_SHA_REQUIRED');
  assert.equal(git('rev-parse', 'HEAD'), subject, 'AM19_HISTORICAL_SUCCESSOR_HEAD_MUST_EQUAL_SUBJECT');
  assert.equal(git('status', '--porcelain'), '', 'AM19_HISTORICAL_SUCCESSOR_DIRTY_WORKTREE_FORBIDDEN');
  const { contract, contractPath } = validateContract(repoRoot, args);
  assert.equal(contract.frozen_runtime_sha, args.runtime, 'AM19_HISTORICAL_SUCCESSOR_RUNTIME_CONTRACT_MISMATCH');
  const { d, descriptorPath } = validateDescriptor(repoRoot, contract);
  canonicalIso(d.logical_epoch.target_t, 'AM19_HISTORICAL_SUCCESSOR_TARGET_INVALID');
  canonicalIso(d.logical_epoch.original_candidate_expires_at, 'AM19_HISTORICAL_SUCCESSOR_HISTORICAL_EXPIRY_INVALID');
  const materialized = materializeCandidate(d, subject);
  const generatedPath = path.join(materialized.root, 'RUN_GEOX_AM19_HISTORICAL_LOGICAL_SUCCESSOR_GENERATED.cjs');
  buildGeneratedRunner(repoRoot, generatedPath);
  try {
    const check = spawnSync(process.execPath, ['--check', generatedPath], { encoding: 'utf8', windowsHide: true });
    if (check.error) throw check.error;
    if (check.status !== 0) throw new Error(`AM19_HISTORICAL_SUCCESSOR_GENERATED_SYNTAX_FAILED:${check.stderr || ''}`);
    if (args.mode === 'selftest') {
      process.stdout.write(`${JSON.stringify({status:'PASS',contract_id:contract.contract_id,source_runner_blob:SOURCE_BLOB,historical_logical_epoch_id:d.epoch_id,producer_subject_sha:d.historical_producer.producer_subject_sha,target_t:d.logical_epoch.target_t,semantic_manifest_digest:d.logical_epoch.semantic_manifest_digest,retained_raw_object_count:2,current_2026_crop_window_status:d.current_2026_crop_window_status,current_season_formal_admission_substituted:false,database_provisioner_ref:contract.database_provisioner_ref,database_execution_plane:contract.database_execution_plane,schema_client_image:contract.schema_client_image,schema_client_required_major:contract.schema_client_required_major,schema_client_usage_policy:contract.schema_client_usage_policy,remote_admin_credential_required:false,database_access:false,provider_access:false})}\n`);
      return;
    }
    const childArgs = [
      generatedPath,
      'run',
      '--contract', path.relative(repoRoot, contractPath),
      '--subject', subject,
      '--runtime', args.runtime,
      '--candidate', materialized.file,
      '--candidate-source-ref', sourceRef(d, descriptorPath),
      '--postgres-image', args['postgres-image'],
    ];
    if (args.root) childArgs.push('--root', args.root);
    const env = {
      ...process.env,
      GEOX_AM19_HISTORICAL_LOGICAL_EPOCH_ACK: 'true',
      MCFT_CAP09_HISTORICAL_CANDIDATE_EXPIRES_AT: d.logical_epoch.original_candidate_expires_at,
    };
    const r = spawnSync(process.execPath, childArgs, { stdio: 'inherit', env, windowsHide: true, cwd: repoRoot });
    if (r.error) throw r.error;
    if (r.status !== 0) process.exitCode = r.status || 1;
  } finally {
    fs.rmSync(materialized.root, { recursive: true, force: true });
  }
}

main();
