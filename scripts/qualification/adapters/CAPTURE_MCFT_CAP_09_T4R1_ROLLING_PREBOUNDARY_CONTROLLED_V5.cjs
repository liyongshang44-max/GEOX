#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const BASE_REF = 'scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V2.cjs';
const BASE_BLOB = 'ba97882c48b1b2dfa841f20f7f11a6bce94681da';
const PREDECESSOR_REF = 'scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V4.cjs';
const PREDECESSOR_BLOB = '0f48edfaab068bcee966d76eeb783e75aa14268f';
const SELF_REF = 'scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V5.cjs';
const BRIDGE_REF = 'scripts/qualification/materializers/MATERIALIZE_MCFT_CAP09_WINDOWS_ECCODES_FILE_HANDLE_BRIDGE_V1.cjs';
const HISTORICAL_HELPER_REF = 'scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py';
const HISTORICAL_HELPER_COMMIT = 'f1c43c5c7379748c5609184cd8acc86ff9b1608e';
const HISTORICAL_HELPER_BLOB = 'c9bab62c980273ba3669b2bff002d66244916d1b';
const HISTORICAL_EA4_REF = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py';
const HISTORICAL_EA4_BLOB = 'ff2ad210387402a74731968e14746210fd2440dd';
const PRODUCER_SUBJECT = '8f63c498bd48978e2dd525ad57b6b8fdb7ada560';
const GENERATED_HELPER_REL = 'scripts/runtime_acceptance/.generated_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE_HISTORICAL_V5_WINDOWS_BRIDGE.py';

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}
function exactReplace(source, oldValue, newValue, code) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`${code}:${count}`);
  return source.replace(oldValue, newValue);
}
function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

const repoRoot = git(process.cwd(), ['rev-parse', '--show-toplevel']);
const basePath = path.join(repoRoot, BASE_REF);
const actualBaseBlob = git(repoRoot, ['rev-parse', `HEAD:${BASE_REF}`]);
if (actualBaseBlob !== BASE_BLOB) throw new Error(`CONTROLLED_CAPTURE_V5_BASE_ADAPTER_BLOB_DRIFT:${actualBaseBlob}:${BASE_BLOB}`);
const predecessorBlob = git(repoRoot, ['rev-parse', `HEAD:${PREDECESSOR_REF}`]);
if (predecessorBlob !== PREDECESSOR_BLOB) throw new Error(`CONTROLLED_CAPTURE_V5_PREDECESSOR_ADAPTER_BLOB_DRIFT:${predecessorBlob}:${PREDECESSOR_BLOB}`);
const helperBlob = git(repoRoot, ['rev-parse', `${HISTORICAL_HELPER_COMMIT}:${HISTORICAL_HELPER_REF}`]);
if (helperBlob !== HISTORICAL_HELPER_BLOB) throw new Error(`CONTROLLED_CAPTURE_V5_HISTORICAL_HELPER_BLOB_DRIFT:${helperBlob}:${HISTORICAL_HELPER_BLOB}`);
const historicalEa4Blob = git(repoRoot, ['rev-parse', `${HISTORICAL_HELPER_COMMIT}:${HISTORICAL_EA4_REF}`]);
if (historicalEa4Blob !== HISTORICAL_EA4_BLOB) throw new Error(`CONTROLLED_CAPTURE_V5_HISTORICAL_EA4_BLOB_DRIFT:${historicalEa4Blob}:${HISTORICAL_EA4_BLOB}`);
const producerEa4Blob = git(repoRoot, ['rev-parse', `${PRODUCER_SUBJECT}:${HISTORICAL_EA4_REF}`]);
if (producerEa4Blob !== HISTORICAL_EA4_BLOB) throw new Error(`CONTROLLED_CAPTURE_V5_PRODUCER_EA4_BLOB_DRIFT:${producerEa4Blob}:${HISTORICAL_EA4_BLOB}`);

function buildSource() {
  let source = fs.readFileSync(basePath, 'utf8');

  source = source.replaceAll('CONTROLLED_CAPTURE_V2', 'CONTROLLED_CAPTURE_V5');
  source = source.replaceAll('mcft_cap09_t4r1_controlled_capture_v2', 'mcft_cap09_t4r1_controlled_capture_v5');
  source = source.replaceAll('geox_controlled_rolling_capture_result_v2', 'geox_controlled_rolling_capture_result_v5');
  source = source.replaceAll('geox_mcft_cap09_controlled_capture_provenance_v2', 'geox_mcft_cap09_controlled_capture_provenance_v5');
  source = source.replaceAll('geox_controlled_rolling_capture_environment_v2', 'geox_controlled_rolling_capture_environment_v5');
  source = source.replaceAll('geox-controlled-capture-v2://', 'geox-controlled-capture-v5://');
  source = source.replaceAll('CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V2.cjs', 'CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V5.cjs');

  source = exactReplace(
    source,
    "const PYTHON_PACKAGES = ['eccodes==2.47.0', 'eccodeslib==2.47.3.23', 'numpy==1.26.4', 'refet==0.4.2'];",
    `const PYTHON_PROFILE = process.platform === 'win32'\n  ? {\n      id: 'WINDOWS_ECCODES_BUNDLED_BINARY_V1',\n      packages: ['eccodes==2.47.0', 'numpy==1.26.4', 'refet==0.4.2'],\n      binary_policy: 'ECCODES_2_47_0_WINDOWS_WHEEL_BUNDLES_NATIVE_BINARY_NO_ECCODESLIB_PACKAGE',\n    }\n  : {\n      id: 'LINUX_MAC_ECCODESLIB_V1',\n      packages: ['eccodes==2.47.0', 'eccodeslib==2.47.3.23', 'numpy==1.26.4', 'refet==0.4.2'],\n      binary_policy: 'ECCODESLIB_2_47_3_23_EXTERNAL_BINARY_PACKAGE',\n    };\nconst PYTHON_PACKAGES = PYTHON_PROFILE.packages;`,
    'CONTROLLED_CAPTURE_V5_PYTHON_PROFILE_TRANSFORM_CARDINALITY'
  );

  source = exactReplace(
    source,
    "    exec('node', [MATERIALIZER_REF, 'selftest'], { cwd: repoRoot, logFile, errorCode: 'CONTROLLED_CAPTURE_V5_SOURCE_MATERIALIZER_SELFTEST_FAILED' });",
    `    exec('node', [MATERIALIZER_REF, 'selftest'], { cwd: repoRoot, logFile, errorCode: 'CONTROLLED_CAPTURE_V5_SOURCE_MATERIALIZER_SELFTEST_FAILED' });\n    exec('node', ['${BRIDGE_REF}', 'selftest'], { cwd: repoRoot, logFile, errorCode: 'CONTROLLED_CAPTURE_V5_WINDOWS_ECCODES_BRIDGE_SELFTEST_FAILED' });`,
    'CONTROLLED_CAPTURE_V5_BRIDGE_SELFTEST_INSERT_CARDINALITY'
  );

  source = exactReplace(
    source,
    "    exec(py, [path.join(workspaceDir, 'scripts', 'runtime_acceptance', 'MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'), 'selftest-et0-decimal-normalization'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V5_ET0_SELFTEST_FAILED' });",
    `    exec(py, [path.join(workspaceDir, 'scripts', 'runtime_acceptance', 'MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'), 'selftest-et0-decimal-normalization'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V5_ET0_SELFTEST_FAILED' });\n    exec(py, [path.join(workspaceDir, 'apps', 'server', 'src', 'external_evidence', 'provider', 'python', 'mcft_cap09_gfs_scientific_core_v1.py'), 'selftest'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V5_GFS_SCIENTIFIC_CORE_SELFTEST_FAILED' });\n    exec(py, [path.join(workspaceDir, 'apps', 'server', 'src', 'external_evidence', 'provider', 'python', 'mcft_cap09_gfs_raw_bundle_decoder_v1.py'), 'selftest'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V5_GFS_RAW_BUNDLE_DECODER_SELFTEST_FAILED' });\n    const pipFreeze = output(py, ['-m', 'pip', 'freeze'], { logFile });`,
    'CONTROLLED_CAPTURE_V5_PYTHON_SELFTEST_TRANSFORM_CARDINALITY'
  );

  source = exactReplace(
    source,
    "      python_version: versions.python,\n      container_image: postgresImage,",
    "      python_version: versions.python,\n      python_package_profile: PYTHON_PROFILE.id,\n      python_binary_policy: PYTHON_PROFILE.binary_policy,\n      python_packages_required: PYTHON_PACKAGES,\n      python_package_set_digest: sha256Buffer(pipFreeze),\n      historical_provider_helper_source_commit_sha: historicalProviderHelperCommit,\n      historical_provider_helper_blob_sha: historicalProviderHelperBlob,\n      historical_provider_helper_materialized_blob_sha: bridgeMaterialization.materialized_historical_provider_helper_blob_sha,\n      historical_ea4_dependency_blob_sha: historicalEa4DependencyBlob,\n      historical_ea4_dependency_materialized_blob_sha: bridgeMaterialization.materialized_historical_ea4_dependency_blob_sha,\n      transitive_provider_helper_binding: 'EXACT_HISTORICAL_HELPER_PLUS_ZERO_DIFF_EA4_DEPENDENCY_V1',\n      windows_eccodes_file_handle_bridge: bridgeMaterialization.transform_id,\n      windows_eccodes_file_handle_bridge_applied: bridgeMaterialization.windows_file_handle_bridge_applied,\n      provider_helper_compat_sha256: bridgeMaterialization.provider_helper_compat_sha256,\n      ea4_compat_sha256: bridgeMaterialization.ea4_compat_sha256,\n      file_handle_smoke_status: bridgeSmoke.status,\n      file_handle_smoke_provider_request_count: bridgeSmoke.provider_request_count,\n      container_image: postgresImage,",
    'CONTROLLED_CAPTURE_V5_ENVIRONMENT_PROFILE_TRANSFORM_CARDINALITY'
  );

  const adapterBlobLine = "      capture_adapter_git_blob_sha: output('git', ['rev-parse', `${launcherSubject}:scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V5.cjs`], { cwd: repoRoot, logFile }),";
  source = exactReplace(
    source,
    adapterBlobLine,
    `${adapterBlobLine}\n      capture_base_adapter_ref: '${BASE_REF}',\n      capture_base_adapter_git_blob_sha: output('git', ['rev-parse', \`${'${launcherSubject}'}:${BASE_REF}\`], { cwd: repoRoot, logFile }),\n      capture_predecessor_adapter_ref: '${PREDECESSOR_REF}',\n      capture_predecessor_adapter_git_blob_sha: output('git', ['rev-parse', \`${'${launcherSubject}'}:${PREDECESSOR_REF}\`], { cwd: repoRoot, logFile }),\n      bridge_materializer_ref: '${BRIDGE_REF}',\n      bridge_materializer_git_blob_sha: output('git', ['rev-parse', \`${'${launcherSubject}'}:${BRIDGE_REF}\`], { cwd: repoRoot, logFile }),\n      python_package_profile: PYTHON_PROFILE.id,\n      python_binary_policy: PYTHON_PROFILE.binary_policy,`,
    'CONTROLLED_CAPTURE_V5_PROVENANCE_PROFILE_TRANSFORM_CARDINALITY'
  );

  const materializationNeedle = "    materialization = JSON.parse(materialized.stdout);\n    if (materialization.status !== 'PASS' || materialization.provider_runner_blob !== SOURCE_BLOB || materialization.provider_runner_source_commit !== SOURCE_COMMIT) throw new Error('CONTROLLED_CAPTURE_V5_SOURCE_MATERIALIZATION_INVALID');\n\n    const qenv = {};";
  const materializationReplacement = `    materialization = JSON.parse(materialized.stdout);\n    if (materialization.status !== 'PASS' || materialization.provider_runner_blob !== SOURCE_BLOB || materialization.provider_runner_source_commit !== SOURCE_COMMIT) throw new Error('CONTROLLED_CAPTURE_V5_SOURCE_MATERIALIZATION_INVALID');\n\n    const historicalProviderHelperRef = '${HISTORICAL_HELPER_REF}';\n    const historicalProviderHelperCommit = '${HISTORICAL_HELPER_COMMIT}';\n    const historicalProviderHelperBlob = '${HISTORICAL_HELPER_BLOB}';\n    const historicalEa4DependencyRef = '${HISTORICAL_EA4_REF}';\n    const historicalEa4DependencyBlob = '${HISTORICAL_EA4_BLOB}';\n    const helperBlobAtAuthority = output('git', ['rev-parse', \`${'${historicalProviderHelperCommit}'}:${'${historicalProviderHelperRef}'}\`], { cwd: repoRoot, logFile });\n    if (helperBlobAtAuthority !== historicalProviderHelperBlob) throw new Error(\`CONTROLLED_CAPTURE_V5_HISTORICAL_HELPER_BLOB_DRIFT:${'${helperBlobAtAuthority}'}:${'${historicalProviderHelperBlob}'}\`);\n    const historicalEa4BlobAtAuthority = output('git', ['rev-parse', \`${'${historicalProviderHelperCommit}'}:${'${historicalEa4DependencyRef}'}\`], { cwd: repoRoot, logFile });\n    if (historicalEa4BlobAtAuthority !== historicalEa4DependencyBlob) throw new Error(\`CONTROLLED_CAPTURE_V5_HISTORICAL_EA4_BLOB_DRIFT:${'${historicalEa4BlobAtAuthority}'}:${'${historicalEa4DependencyBlob}'}\`);\n    const producerEa4Blob = output('git', ['rev-parse', \`${'${producerSubject}'}:${'${historicalEa4DependencyRef}'}\`], { cwd: repoRoot, logFile });\n    if (producerEa4Blob !== historicalEa4DependencyBlob) throw new Error(\`CONTROLLED_CAPTURE_V5_PRODUCER_EA4_BLOB_DRIFT:${'${producerEa4Blob}'}:${'${historicalEa4DependencyBlob}'}\`);\n\n    const bridgeRaw = exec('node', ['${BRIDGE_REF}', 'materialize', '--workspace', workspaceDir], { cwd: repoRoot, logFile, errorCode: 'CONTROLLED_CAPTURE_V5_WINDOWS_ECCODES_BRIDGE_MATERIALIZATION_FAILED' });\n    const bridgeMaterialization = JSON.parse(bridgeRaw.stdout);\n    if (bridgeMaterialization.status !== 'PASS' || bridgeMaterialization.historical_provider_helper_blob_sha !== historicalProviderHelperBlob || bridgeMaterialization.historical_ea4_dependency_blob_sha !== historicalEa4DependencyBlob) throw new Error('CONTROLLED_CAPTURE_V5_WINDOWS_ECCODES_BRIDGE_MATERIALIZATION_INVALID');\n    if (bridgeMaterialization.materialized_historical_provider_helper_blob_sha !== historicalProviderHelperBlob || bridgeMaterialization.materialized_historical_ea4_dependency_blob_sha !== historicalEa4DependencyBlob) throw new Error('CONTROLLED_CAPTURE_V5_WINDOWS_ECCODES_BRIDGE_AUTHORITY_MATERIALIZATION_INVALID');\n    if (bridgeMaterialization.provider_fetch_logic_changed !== false || bridgeMaterialization.provider_decode_semantic_guards_changed !== false || bridgeMaterialization.target_mismatch_guard_relaxed !== false) throw new Error('CONTROLLED_CAPTURE_V5_WINDOWS_ECCODES_BRIDGE_SCOPE_VIOLATION');\n    const bridgeSmokeRaw = exec('node', ['${BRIDGE_REF}', 'smoke', '--python', py, '--ea4', bridgeMaterialization.generated_ea4_path], { cwd: repoRoot, logFile, errorCode: 'CONTROLLED_CAPTURE_V5_WINDOWS_ECCODES_FILE_HANDLE_SMOKE_FAILED' });\n    const bridgeSmoke = JSON.parse(bridgeSmokeRaw.stdout);\n    if (bridgeSmoke.status !== 'PASS' || bridgeSmoke.provider_request_count !== 0 || bridgeSmoke.runtime_mutation !== false || bridgeSmoke.production_mutation !== false) throw new Error('CONTROLLED_CAPTURE_V5_WINDOWS_ECCODES_FILE_HANDLE_SMOKE_NONPASS');\n\n    const providerScriptNeedle = 'const PROVIDER_SCRIPT = path.resolve("scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py");';\n    const providerScriptReplacement = 'const PROVIDER_SCRIPT = path.resolve("${GENERATED_HELPER_REL}");';\n    const generatedRunnerSource = fs.readFileSync(generatedPath, 'utf8');\n    const providerScriptBindingCount = generatedRunnerSource.split(providerScriptNeedle).length - 1;\n    if (providerScriptBindingCount !== 1) throw new Error(\`CONTROLLED_CAPTURE_V5_PROVIDER_HELPER_BINDING_CARDINALITY:${'${providerScriptBindingCount}'}\`);\n    const reboundRunnerSource = generatedRunnerSource.replace(providerScriptNeedle, providerScriptReplacement);\n    fs.writeFileSync(generatedPath, reboundRunnerSource, 'utf8');\n    const generatedSourcePreRebindSha256 = materialization.generated_sha256;\n    const generatedSourceReboundSha256 = sha256File(generatedPath);\n\n    const qenv = {};`;
  source = exactReplace(source, materializationNeedle, materializationReplacement, 'CONTROLLED_CAPTURE_V5_TRANSITIVE_HELPER_AND_BRIDGE_BINDING_TRANSFORM_CARDINALITY');

  source = exactReplace(
    source,
    "      generated_source_sha256: materialization.generated_sha256,\n      historical_deadline_compat_ref: HISTORICAL_COMPAT_REF,",
    "      generated_source_sha256: generatedSourcePreRebindSha256,\n      generated_source_rebound_sha256: generatedSourceReboundSha256,\n      historical_provider_helper_ref: historicalProviderHelperRef,\n      historical_provider_helper_source_commit_sha: historicalProviderHelperCommit,\n      historical_provider_helper_git_blob_sha: historicalProviderHelperBlob,\n      historical_provider_helper_materialized_git_blob_sha: bridgeMaterialization.materialized_historical_provider_helper_blob_sha,\n      historical_ea4_dependency_ref: historicalEa4DependencyRef,\n      historical_ea4_dependency_git_blob_sha: historicalEa4DependencyBlob,\n      historical_ea4_dependency_materialized_git_blob_sha: bridgeMaterialization.materialized_historical_ea4_dependency_blob_sha,\n      producer_ea4_dependency_git_blob_sha: producerEa4Blob,\n      windows_eccodes_file_handle_bridge_transform_id: bridgeMaterialization.transform_id,\n      windows_eccodes_file_handle_bridge_applied: bridgeMaterialization.windows_file_handle_bridge_applied,\n      provider_helper_compat_sha256: bridgeMaterialization.provider_helper_compat_sha256,\n      ea4_compat_sha256: bridgeMaterialization.ea4_compat_sha256,\n      file_handle_smoke_status: bridgeSmoke.status,\n      file_handle_smoke_provider_request_count: bridgeSmoke.provider_request_count,\n      transitive_provider_helper_binding_verified: true,\n      target_mismatch_guard_relaxed: false,\n      provider_semantics_changed: false,\n      historical_deadline_compat_ref: HISTORICAL_COMPAT_REF,",
    'CONTROLLED_CAPTURE_V5_PROVENANCE_BRIDGE_TRANSFORM_CARDINALITY'
  );

  for (const marker of [
    'WINDOWS_ECCODES_BUNDLED_BINARY_V1',
    'CONTROLLED_CAPTURE_V5_GFS_RAW_BUNDLE_DECODER_SELFTEST_FAILED',
    'CONTROLLED_CAPTURE_V5_WINDOWS_ECCODES_FILE_HANDLE_SMOKE_FAILED',
    'transitive_provider_helper_binding_verified: true',
    'target_mismatch_guard_relaxed: false',
    'provider_semantics_changed: false',
    'windows_eccodes_file_handle_bridge_transform_id',
  ]) if (!source.includes(marker)) throw new Error(`CONTROLLED_CAPTURE_V5_GUARD_MISSING:${marker}`);
  if (!source.includes(HISTORICAL_HELPER_BLOB) || !source.includes(HISTORICAL_EA4_BLOB)) throw new Error('CONTROLLED_CAPTURE_V5_TRANSITIVE_BLOBS_MISSING');
  if (!source.includes(SELF_REF) || !source.includes(BASE_REF) || !source.includes(PREDECESSOR_REF) || !source.includes(BRIDGE_REF)) throw new Error('CONTROLLED_CAPTURE_V5_LINEAGE_OR_BRIDGE_REF_MISSING');

  return source;
}

const source = buildSource();
const mode = process.argv[2];

if (mode === 'selftest') {
  const syntaxSource = source.replace(/^#!.*(?:\r?\n)/, '');
  new vm.Script(syntaxSource, { filename: `${SELF_REF}:transformed-v2` });
  const bridgeSelftest = JSON.parse(execFileSync(process.execPath, [BRIDGE_REF, 'selftest'], { cwd: repoRoot, encoding: 'utf8' }));
  if (bridgeSelftest.status !== 'PASS') throw new Error('CONTROLLED_CAPTURE_V5_BRIDGE_SELFTEST_NONPASS');
  const profile = process.platform === 'win32'
    ? { id: 'WINDOWS_ECCODES_BUNDLED_BINARY_V1', packages: ['eccodes==2.47.0', 'numpy==1.26.4', 'refet==0.4.2'], eccodeslib_package_required: false }
    : { id: 'LINUX_MAC_ECCODESLIB_V1', packages: ['eccodes==2.47.0', 'eccodeslib==2.47.3.23', 'numpy==1.26.4', 'refet==0.4.2'], eccodeslib_package_required: true };
  process.stdout.write(JSON.stringify({
    schema_version: 'geox_mcft_cap09_controlled_capture_v5_transform_selftest_v1',
    status: 'PASS',
    base_adapter_ref: BASE_REF,
    base_adapter_blob: BASE_BLOB,
    predecessor_adapter_ref: PREDECESSOR_REF,
    predecessor_adapter_blob: PREDECESSOR_BLOB,
    bridge_materializer_ref: BRIDGE_REF,
    platform: process.platform,
    python_package_profile: profile.id,
    python_packages_required: profile.packages,
    eccodeslib_package_required: profile.eccodeslib_package_required,
    historical_provider_helper_ref: HISTORICAL_HELPER_REF,
    historical_provider_helper_source_commit_sha: HISTORICAL_HELPER_COMMIT,
    historical_provider_helper_blob_sha: HISTORICAL_HELPER_BLOB,
    historical_ea4_dependency_ref: HISTORICAL_EA4_REF,
    historical_ea4_dependency_blob_sha: HISTORICAL_EA4_BLOB,
    producer_ea4_dependency_blob_sha: producerEa4Blob,
    transitive_provider_helper_binding_required: true,
    windows_eccodes_file_handle_bridge_required: process.platform === 'win32',
    windows_eccodes_file_handle_bridge_transform_id: bridgeSelftest.transform_id,
    windows_eccodes_file_handle_bridge_applied: bridgeSelftest.windows_file_handle_bridge_applied,
    provider_helper_compat_sha256: bridgeSelftest.provider_helper_compat_sha256,
    ea4_compat_sha256: bridgeSelftest.ea4_compat_sha256,
    target_mismatch_guard_relaxed: false,
    provider_semantics_changed: false,
    runtime_semantic_mutation: false,
    production_mutation: false,
    transformed_source_sha256: sha256(source),
  }, null, 2) + '\n');
  process.exit(0);
}

const compiled = new Module(basePath, module);
compiled.filename = basePath;
compiled.paths = Module._nodeModulePaths(path.dirname(basePath));
compiled._compile(source, basePath);
