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
const SELF_REF = 'scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V3.cjs';

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
if (actualBaseBlob !== BASE_BLOB) throw new Error(`CONTROLLED_CAPTURE_V3_BASE_ADAPTER_BLOB_DRIFT:${actualBaseBlob}:${BASE_BLOB}`);

function buildSource() {
  let source = fs.readFileSync(basePath, 'utf8');

  source = source.replaceAll('CONTROLLED_CAPTURE_V2', 'CONTROLLED_CAPTURE_V3');
  source = source.replaceAll('mcft_cap09_t4r1_controlled_capture_v2', 'mcft_cap09_t4r1_controlled_capture_v3');
  source = source.replaceAll('geox_controlled_rolling_capture_result_v2', 'geox_controlled_rolling_capture_result_v3');
  source = source.replaceAll('geox_mcft_cap09_controlled_capture_provenance_v2', 'geox_mcft_cap09_controlled_capture_provenance_v3');
  source = source.replaceAll('geox_controlled_rolling_capture_environment_v2', 'geox_controlled_rolling_capture_environment_v3');
  source = source.replaceAll('geox-controlled-capture-v2://', 'geox-controlled-capture-v3://');
  source = source.replaceAll('CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V2.cjs', 'CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V3.cjs');

  source = exactReplace(
    source,
    "const PYTHON_PACKAGES = ['eccodes==2.47.0', 'eccodeslib==2.47.3.23', 'numpy==1.26.4', 'refet==0.4.2'];",
    `const PYTHON_PROFILE = process.platform === 'win32'\n  ? {\n      id: 'WINDOWS_ECCODES_BUNDLED_BINARY_V1',\n      packages: ['eccodes==2.47.0', 'numpy==1.26.4', 'refet==0.4.2'],\n      binary_policy: 'ECCODES_2_47_0_WINDOWS_WHEEL_BUNDLES_NATIVE_BINARY_NO_ECCODESLIB_PACKAGE',\n    }\n  : {\n      id: 'LINUX_MAC_ECCODESLIB_V1',\n      packages: ['eccodes==2.47.0', 'eccodeslib==2.47.3.23', 'numpy==1.26.4', 'refet==0.4.2'],\n      binary_policy: 'ECCODESLIB_2_47_3_23_EXTERNAL_BINARY_PACKAGE',\n    };\nconst PYTHON_PACKAGES = PYTHON_PROFILE.packages;`,
    'CONTROLLED_CAPTURE_V3_PYTHON_PROFILE_TRANSFORM_CARDINALITY'
  );

  source = exactReplace(
    source,
    "    exec(py, [path.join(workspaceDir, 'scripts', 'runtime_acceptance', 'MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'), 'selftest-et0-decimal-normalization'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V3_ET0_SELFTEST_FAILED' });",
    `    exec(py, [path.join(workspaceDir, 'scripts', 'runtime_acceptance', 'MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py'), 'selftest-et0-decimal-normalization'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V3_ET0_SELFTEST_FAILED' });\n    exec(py, [path.join(workspaceDir, 'apps', 'server', 'src', 'external_evidence', 'provider', 'python', 'mcft_cap09_gfs_scientific_core_v1.py'), 'selftest'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V3_GFS_SCIENTIFIC_CORE_SELFTEST_FAILED' });\n    exec(py, [path.join(workspaceDir, 'apps', 'server', 'src', 'external_evidence', 'provider', 'python', 'mcft_cap09_gfs_raw_bundle_decoder_v1.py'), 'selftest'], { cwd: workspaceDir, logFile, errorCode: 'CONTROLLED_CAPTURE_V3_GFS_RAW_BUNDLE_DECODER_SELFTEST_FAILED' });\n    const pipFreeze = output(py, ['-m', 'pip', 'freeze'], { logFile });`,
    'CONTROLLED_CAPTURE_V3_PYTHON_SELFTEST_TRANSFORM_CARDINALITY'
  );

  source = exactReplace(
    source,
    "      python_version: versions.python,\n      container_image: postgresImage,",
    "      python_version: versions.python,\n      python_package_profile: PYTHON_PROFILE.id,\n      python_binary_policy: PYTHON_PROFILE.binary_policy,\n      python_packages_required: PYTHON_PACKAGES,\n      python_package_set_digest: sha256Buffer(pipFreeze),\n      container_image: postgresImage,",
    'CONTROLLED_CAPTURE_V3_ENVIRONMENT_PROFILE_TRANSFORM_CARDINALITY'
  );

  const adapterBlobLine = "      capture_adapter_git_blob_sha: output('git', ['rev-parse', `${launcherSubject}:scripts/qualification/adapters/CAPTURE_MCFT_CAP_09_T4R1_ROLLING_PREBOUNDARY_CONTROLLED_V3.cjs`], { cwd: repoRoot, logFile }),";
  source = exactReplace(
    source,
    adapterBlobLine,
    `${adapterBlobLine}\n      capture_base_adapter_ref: '${BASE_REF}',\n      capture_base_adapter_git_blob_sha: output('git', ['rev-parse', \`${'${launcherSubject}'}:${BASE_REF}\`], { cwd: repoRoot, logFile }),\n      python_package_profile: PYTHON_PROFILE.id,\n      python_binary_policy: PYTHON_PROFILE.binary_policy,`,
    'CONTROLLED_CAPTURE_V3_PROVENANCE_PROFILE_TRANSFORM_CARDINALITY'
  );

  if (!source.includes('WINDOWS_ECCODES_BUNDLED_BINARY_V1')) throw new Error('CONTROLLED_CAPTURE_V3_WINDOWS_PROFILE_MISSING');
  if (!source.includes('CONTROLLED_CAPTURE_V3_GFS_RAW_BUNDLE_DECODER_SELFTEST_FAILED')) throw new Error('CONTROLLED_CAPTURE_V3_GFS_SELFTEST_MISSING');
  if (!source.includes(SELF_REF)) throw new Error('CONTROLLED_CAPTURE_V3_SELF_REF_MISSING');
  if (!source.includes(BASE_REF)) throw new Error('CONTROLLED_CAPTURE_V3_BASE_REF_MISSING');

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
    schema_version: 'geox_mcft_cap09_controlled_capture_v3_transform_selftest_v1',
    status: 'PASS',
    base_adapter_ref: BASE_REF,
    base_adapter_blob: BASE_BLOB,
    platform: process.platform,
    python_package_profile: profile.id,
    python_packages_required: profile.packages,
    eccodeslib_package_required: profile.eccodeslib_package_required,
    eccodes_selfcheck_required: true,
    gfs_scientific_core_selftest_required: true,
    gfs_raw_bundle_decoder_selftest_required: true,
    transformed_source_sha256: sha256(source),
    provider_semantics_changed: false,
    runtime_semantic_mutation: false,
    production_mutation: false,
  }, null, 2) + '\n');
  process.exit(0);
}

const compiled = new Module(basePath, module);
compiled.filename = basePath;
compiled.paths = Module._nodeModulePaths(path.dirname(basePath));
compiled._compile(source, basePath);
