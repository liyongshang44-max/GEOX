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
const PREDECESSOR_REF = 'scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V3.cjs';
const PREDECESSOR_BLOB = 'd29bc487a4c88d347745f3ee503425c631c4b177';
const SELF_REF = 'scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V4.cjs';
const HISTORICAL_HELPER_REF = 'scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py';
const HISTORICAL_HELPER_COMMIT = 'f1c43c5c7379748c5609184cd8acc86ff9b1608e';
const HISTORICAL_HELPER_BLOB = 'c9bab62c980273ba3669b2bff002d66244916d1b';
const HISTORICAL_EA4_REF = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py';
const HISTORICAL_EA4_BLOB = 'ff2ad210387402a74731968e14746210fd2440dd';
const PRODUCER_SUBJECT = '8f63c498bd48978e2dd525ad57b6b8fdb7ada560';

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
if (actualBaseBlob !== BASE_BLOB) throw new Error(`CONTROLLED_CAPTURE_V4_BASE_ADAPTER_BLOB_DRIFT:${actualBaseBlob}:${BASE_BLOB}`);
const predecessorBlob = git(repoRoot, ['rev-parse', `HEAD:${PREDECESSOR_REF}`]);
if (predecessorBlob !== PREDECESSOR_BLOB) throw new Error(`CONTROLLED_CAPTURE_V4_PREDECESSOR_ADAPTER_BLOB_DRIFT:${predecessorBlob}:${PREDECESSOR_BLOB}`);
const helperBlob = git(repoRoot, ['rev-parse', `${HISTORICAL_HELPER_COMMIT}:${HISTORICAL_HELPER_REF}`]);
if (helperBlob !== HISTORICAL_HELPER_BLOB) throw new Error(`CONTROLLED_CAPTURE_V4_HISTORICAL_HELPER_BLOB_DRIFT:${helperBlob}:${HISTORICAL_HELPER_BLOB}`);
const historicalEa4Blob = git(repoRoot, ['rev-parse', `${HISTORICAL_HELPER_COMMIT}:${HISTORICAL_EA4_REF}`]);
if (historicalEa4Blob !== HISTORICAL_EA4_BLOB) throw new Error(`CONTROLLED_CAPTURE_V4_HISTORICAL_EA4_BLOB_DRIFT:${historicalEa4Blob}:${HISTORICAL_EA4_BLOB}`);
const producerEa4Blob = git(repoRoot, ['rev-parse', `${PRODUCER_SUBJECT}:${HISTORICAL_EA4_REF}`]);
if (producerEa4Blob !== HISTORICAL_EA4_BLOB) throw new Error(`CONTROLLED_CAPTURE_V4_PRODUCER_EA4_BLOB_DRIFT:${producerEa4Blob}:${HISTORICAL_EA4_BLOB}`);

function buildSource() {
  let source = fs.readFileSync(basePath, 'utf8');

  source = source.replaceAll('CONTROLLED_CAPTURE_V2', 'CONTROLLED_CAPTURE_V4');
  source = source.replaceAll('mcft_cap09_t4r1_controlled_capture_v2', 'mcft_cap09_t4r1_controlled_capture_v4');
  source = source.replaceAll('geox_controlled_rolling_capture_result_v2', 'geox_controlled_rolling_capture_result_v4');
  source = source.replaceAll('geox_mcft_cap09_controlled_capture_provenance_v2', 'geox_mcft_cap09_controlled_capture_provenance_v4');
  source = source.replaceAll('geox_controlled_rolling_capture_environment_v2', 'geox_controlled_rolling_capture_environment_v4');
  source = source.replaceAll('geox-controlled-capture-v2://', 'geox-controlled-capture-v4://');
  source = source.replaceAll('CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V2.cjs', 'CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V4.cjs');

  source = exactReplace(
    source,
    "const PYTHON_PACKAGES = ['eccodes==2.47.0', 'eccodeslib==2.47.3.23', 'numpy==1.26.4', 'refet==0.4.2'];",
    `const PYTHON_PROFILE = process.platform === 'win32'\n  ? {\n      id: 'WINDOWS_ECCODES_BUNDLED_BINARY_V1',\n      packages: ['eccodes==2.47.0', 'numpy==1.26.4', 'refet==0.4.2'],\n      binary_policy: 'ECCODES_2_47_0_WINDOWS_WHEEL_BUNDLES_NATIVE_BINARY_NO_ECCODESLIB_PACKAGE',\n    }\n  : {\n      id: 'LINUX_MAC_ECCODESLIB_V1',\n      packages: ['eccodes==2.47.0', 'eccodeslib==2.47.3.23', 'numpy==1.26.4', 'refet==0.4.2'],\n      binary_policy: 'ECCODESLIB_2_47_3_23_EXTERNAL_BINARY_PACKAGE',\n    };\nconst PYTHON_PACKAGES = PYTHON_PROFILE.packages;`,
    'CONTROLLED_CAPTURE_V4_PYTHON_PROFILE_TRANSFORM_CARDINALITY'
  );

  source = exactReplace(
    source,
    "    exec(py, [path.join(workspaceDir, 'scripts', 'runtime_acceptance', 'MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'), 'selftest-et0-decimal-normalization'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V4_ET0_SELFTEST_FAILED' });",
    `    exec(py, [path.join(workspaceDir, 'scripts', 'runtime_acceptance', 'MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'), 'selftest-et0-decimal-normalization'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V4_ET0_SELFTEST_FAILED' });\n    exec(py, [path.join(workspaceDir, 'apps', 'server', 'src', 'external_evidence', 'provider', 'python', 'mcft_cap09_gfs_scientific_core_v1.py'), 'selftest'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V4_GFS_SCIENTIFIC_CORE_SELFTEST_FAILED' });\n    exec(py, [path.join(workspaceDir, 'apps', 'server', 'src', 'external_evidence', 'provider', 'python', 'mcft_cap09_gfs_raw_bundle_decoder_v1.py'), 'selftest'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V4_GFS_RAW_BUNDLE_DECODER_SELFTEST_FAILED' });\n    const pipFreeze = output(py, ['-m', 'pip', 'freeze'], { logFile });`,
    'CONTROLLED_CAPTURE_V4_PYTHON_SELFTEST_TRANSFORM_CARDINALITY'
  );

  source = exactReplace(
    source,
    "      python_version: versions.python,\n      container_image: postgresImage,",
    "      python_version: versions.python,\n      python_package_profile: PYTHON_PROFILE.id,\n      python_binary_policy: PYTHON_PROFILE.binary_policy,\n      python_packages_required: PYTHON_PACKAGES,\n      python_package_set_digest: sha256Buffer(pipFreeze),\n      historical_provider_helper_source_commit_sha: historicalProviderHelperCommit,\n      historical_provider_helper_blob_sha: historicalProviderHelperBlob,\n      historical_ea4_dependency_blob_sha: historicalEa4DependencyBlob,\n      transitive_provider_helper_binding: 'EXACT_HISTORICAL_HELPER_PLUS_ZERO_DIFF_EA4_DEPENDENCY_V1',\n      container_image: postgresImage,",
    'CONTROLLED_CAPTURE_V4_ENVIRONMENT_PROFILE_TRANSFORM_CARDINALITY'
  );

  const adapterBlobLine = "      capture_adapter_git_blob_sha: output('git', ['rev-parse', `${launcherSubject}:scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V4.cjs`], { cwd: repoRoot, logFile }),";
  source = exactReplace(
    source,
    adapterBlobLine,
    `${adapterBlobLine}\n      capture_base_adapter_ref: '${BASE_REF}',\n      capture_base_adapter_git_blob_sha: output('git', ['rev-parse', \`${'${launcherSubject}'}:${BASE_REF}\`], { cwd: repoRoot, logFile }),\n      capture_predecessor_adapter_ref: '${PREDECESSOR_REF}',\n      capture_predecessor_adapter_git_blob_sha: output('git', ['rev-parse', \`${'${launcherSubject}'}:${PREDECESSOR_REF}\`], { cwd: repoRoot, logFile }),\n      python_package_profile: PYTHON_PROFILE.id,\n      python_binary_policy: PYTHON_PROFILE.binary_policy,`,
    'CONTROLLED_CAPTURE_V4_PROVENANCE_PROFILE_TRANSFORM_CARDINALITY'
  );

  const materializationNeedle = "    materialization = JSON.parse(materialized.stdout);\n    if (materialization.status !== 'PASS' || materialization.provider_runner_blob !== SOURCE_BLOB || materialization.provider_runner_source_commit !== SOURCE_COMMIT) throw new Error('CONTROLLED_CAPTURE_V4_SOURCE_MATERIALIZATION_INVALID');\n\n    const qenv = {};";
  const materializationReplacement = `    materialization = JSON.parse(materialized.stdout);\n    if (materialization.status !== 'PASS' || materialization.provider_runner_blob !== SOURCE_BLOB || materialization.provider_runner_source_commit !== SOURCE_COMMIT) throw new Error('CONTROLLED_CAPTURE_V4_SOURCE_MATERIALIZATION_INVALID');\n\n    const historicalProviderHelperRef = '${HISTORICAL_HELPER_REF}';\n    const historicalProviderHelperCommit = '${HISTORICAL_HELPER_COMMIT}';\n    const historicalProviderHelperBlob = '${HISTORICAL_HELPER_BLOB}';\n    const historicalEa4DependencyRef = '${HISTORICAL_EA4_REF}';\n    const historicalEa4DependencyBlob = '${HISTORICAL_EA4_BLOB}';\n    const helperBlobAtAuthority = output('git', ['rev-parse', \`${'${historicalProviderHelperCommit}'}:${'${historicalProviderHelperRef}'}\`], { cwd: repoRoot, logFile });\n    if (helperBlobAtAuthority !== historicalProviderHelperBlob) throw new Error(\`CONTROLLED_CAPTURE_V4_HISTORICAL_HELPER_BLOB_DRIFT:${'${helperBlobAtAuthority}'}:${'${historicalProviderHelperBlob}'}\`);\n    const historicalEa4BlobAtAuthority = output('git', ['rev-parse', \`${'${historicalProviderHelperCommit}'}:${'${historicalEa4DependencyRef}'}\`], { cwd: repoRoot, logFile });\n    if (historicalEa4BlobAtAuthority !== historicalEa4DependencyBlob) throw new Error(\`CONTROLLED_CAPTURE_V4_HISTORICAL_EA4_BLOB_DRIFT:${'${historicalEa4BlobAtAuthority}'}:${'${historicalEa4DependencyBlob}'}\`);\n    const producerEa4Blob = output('git', ['rev-parse', \`${'${producerSubject}'}:${'${historicalEa4DependencyRef}'}\`], { cwd: repoRoot, logFile });\n    if (producerEa4Blob !== historicalEa4DependencyBlob) throw new Error(\`CONTROLLED_CAPTURE_V4_PRODUCER_EA4_BLOB_DRIFT:${'${producerEa4Blob}'}:${'${historicalEa4DependencyBlob}'}\`);\n\n    const historicalHelperPath = path.join(workspaceDir, 'scripts', 'runtime_acceptance', '.generated_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE_HISTORICAL_V4.py');\n    const helperFetch = exec('git', ['show', \`${'${historicalProviderHelperCommit}'}:${'${historicalProviderHelperRef}'}\`], { cwd: repoRoot, logFile, errorCode: 'CONTROLLED_CAPTURE_V4_HISTORICAL_HELPER_MATERIALIZATION_FAILED' });\n    fs.writeFileSync(historicalHelperPath, helperFetch.stdout, 'utf8');\n    const materializedHelperBlob = output('git', ['hash-object', historicalHelperPath], { cwd: repoRoot, logFile });\n    if (materializedHelperBlob !== historicalProviderHelperBlob) throw new Error(\`CONTROLLED_CAPTURE_V4_MATERIALIZED_HELPER_BLOB_MISMATCH:${'${materializedHelperBlob}'}:${'${historicalProviderHelperBlob}'}\`);\n\n    const providerScriptNeedle = 'const PROVIDER_SCRIPT = path.resolve("scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py");';\n    const providerScriptReplacement = 'const PROVIDER_SCRIPT = path.resolve("scripts/runtime_acceptance/.generated_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE_HISTORICAL_V4.py");';\n    const generatedRunnerSource = fs.readFileSync(generatedPath, 'utf8');\n    const providerScriptBindingCount = generatedRunnerSource.split(providerScriptNeedle).length - 1;\n    if (providerScriptBindingCount !== 1) throw new Error(\`CONTROLLED_CAPTURE_V4_PROVIDER_HELPER_BINDING_CARDINALITY:${'${providerScriptBindingCount}'}\`);\n    const reboundRunnerSource = generatedRunnerSource.replace(providerScriptNeedle, providerScriptReplacement);\n    fs.writeFileSync(generatedPath, reboundRunnerSource, 'utf8');\n    const generatedSourcePreRebindSha256 = materialization.generated_sha256;\n    const generatedSourceReboundSha256 = sha256File(generatedPath);\n\n    const qenv = {};`;
  source = exactReplace(source, materializationNeedle, materializationReplacement, 'CONTROLLED_CAPTURE_V4_TRANSITIVE_HELPER_BINDING_TRANSFORM_CARDINALITY');

  source = exactReplace(
    source,
    "      generated_source_sha256: materialization.generated_sha256,\n      historical_deadline_compat_ref: HISTORICAL_COMPAT_REF,",
    "      generated_source_sha256: generatedSourcePreRebindSha256,\n      generated_source_rebound_sha256: generatedSourceReboundSha256,\n      historical_provider_helper_ref: historicalProviderHelperRef,\n      historical_provider_helper_source_commit_sha: historicalProviderHelperCommit,\n      historical_provider_helper_git_blob_sha: historicalProviderHelperBlob,\n      historical_provider_helper_materialized_git_blob_sha: materializedHelperBlob,\n      historical_ea4_dependency_ref: historicalEa4DependencyRef,\n      historical_ea4_dependency_git_blob_sha: historicalEa4DependencyBlob,\n      producer_ea4_dependency_git_blob_sha: producerEa4Blob,\n      transitive_provider_helper_binding_verified: true,\n      target_mismatch_guard_relaxed: false,\n      historical_deadline_compat_ref: HISTORICAL_COMPAT_REF,",
    'CONTROLLED_CAPTURE_V4_PROVENANCE_TRANSITIVE_BINDING_TRANSFORM_CARDINALITY'
  );

  if (!source.includes('WINDOWS_ECCODES_BUNDLED_BINARY_V1')) throw new Error('CONTROLLED_CAPTURE_V4_WINDOWS_PROFILE_MISSING');
  if (!source.includes('CONTROLLED_CAPTURE_V4_GFS_RAW_BUNDLE_DECODER_SELFTEST_FAILED')) throw new Error('CONTROLLED_CAPTURE_V4_GFS_SELFTEST_MISSING');
  if (!source.includes('transitive_provider_helper_binding_verified: true')) throw new Error('CONTROLLED_CAPTURE_V4_TRANSITIVE_HELPER_BINDING_MISSING');
  if (!source.includes('target_mismatch_guard_relaxed: false')) throw new Error('CONTROLLED_CAPTURE_V4_TARGET_GUARD_NONRELAXATION_MISSING');
  if (!source.includes(HISTORICAL_HELPER_BLOB) || !source.includes(HISTORICAL_EA4_BLOB)) throw new Error('CONTROLLED_CAPTURE_V4_TRANSITIVE_BLOBS_MISSING');
  if (!source.includes(SELF_REF)) throw new Error('CONTROLLED_CAPTURE_V4_SELF_REF_MISSING');
  if (!source.includes(BASE_REF) || !source.includes(PREDECESSOR_REF)) throw new Error('CONTROLLED_CAPTURE_V4_LINEAGE_REF_MISSING');

  return source;
}

const source = buildSource();
const mode = process.argv[2];

if (mode === 'selftest') {
  const syntaxSource = source.replace(/^#!.*(?:\r?\n)/, '');
  new vm.Script(syntaxSource, { filename: `${SELF_REF}:transformed-v2` });
  const profile = process.platform === 'win32'
    ? {
        id: 'WINDOWS_ECCODES_BUNDLED_BINARY_V1',
        packages: ['eccodes==2.47.0', 'numpy==1.26.4', 'refet==0.4.2'],
        eccodeslib_package_required: false,
      }
    : {
        id: 'LINUX_MAC_ECCODESLIB_V1',
        packages: ['eccodes==2.47.0', 'eccodeslib==2.47.3.23', 'numpy==1.26.4', 'refet==0.4.2'],
        eccodeslib_package_required: true,
      };
  process.stdout.write(JSON.stringify({
    schema_version: 'geox_mcft_cap09_controlled_capture_v4_transform_selftest_v1',
    status: 'PASS',
    base_adapter_ref: BASE_REF,
    base_adapter_blob: BASE_BLOB,
    predecessor_adapter_ref: PREDECESSOR_REF,
    predecessor_adapter_blob: PREDECESSOR_BLOB,
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
