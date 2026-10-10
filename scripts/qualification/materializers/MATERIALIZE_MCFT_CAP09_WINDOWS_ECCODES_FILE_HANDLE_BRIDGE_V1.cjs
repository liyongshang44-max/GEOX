#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');

const HISTORICAL_COMMIT = 'f1c43c5c7379748c5609184cd8acc86ff9b1608e';
const HELPER_REF = 'scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py';
const HELPER_BLOB = 'c9bab62c980273ba3669b2bff002d66244916d1b';
const EA4_REF = 'scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py';
const EA4_BLOB = 'ff2ad210387402a74731968e14746210fd2440dd';
const GENERATED_HELPER_AUTHORITY_REL = 'scripts/runtime_acceptance/.generated_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE_HISTORICAL_V5_AUTHORITY_EXACT.py';
const GENERATED_EA4_AUTHORITY_REL = 'scripts/runtime_acceptance/.generated_PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION_V5_AUTHORITY_EXACT.py';
const GENERATED_HELPER_REL = 'scripts/runtime_acceptance/.generated_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE_HISTORICAL_V5_WINDOWS_BRIDGE.py';
const GENERATED_EA4_REL = 'scripts/runtime_acceptance/.generated_PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION_V5_WINDOWS_BRIDGE.py';
const TRANSFORM_ID = 'WINDOWS_ECCODES_NAMED_TEMPFILE_REOPEN_FILE_POINTER_BRIDGE_V1';
const ALLOWED_PLATFORMS = new Set(['win32', 'linux', 'darwin']);

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}
function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}
function exactReplace(source, oldValue, newValue, code) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`${code}:${count}`);
  return source.replace(oldValue, newValue);
}
function parseArgs(argv) {
  const mode = argv[0] ?? 'selftest';
  const args = {};
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`QMIG_V5_BRIDGE_UNKNOWN_ARGUMENT:${token}`);
    const key = token.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`QMIG_V5_BRIDGE_ARGUMENT_VALUE_REQUIRED:${key}`);
    args[key] = value;
  }
  return { mode, args };
}
function authority(repoRoot) {
  const helperBlob = git(repoRoot, ['rev-parse', `${HISTORICAL_COMMIT}:${HELPER_REF}`]);
  const ea4Blob = git(repoRoot, ['rev-parse', `${HISTORICAL_COMMIT}:${EA4_REF}`]);
  if (helperBlob !== HELPER_BLOB) throw new Error(`QMIG_V5_BRIDGE_HELPER_BLOB_DRIFT:${helperBlob}:${HELPER_BLOB}`);
  if (ea4Blob !== EA4_BLOB) throw new Error(`QMIG_V5_BRIDGE_EA4_BLOB_DRIFT:${ea4Blob}:${EA4_BLOB}`);
  return {
    helperSource: execFileSync('git', ['show', `${HISTORICAL_COMMIT}:${HELPER_REF}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
    ea4Source: execFileSync('git', ['show', `${HISTORICAL_COMMIT}:${EA4_REF}`], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
  };
}
function buildEa4Compat(source, platform) {
  if (platform !== 'win32') return source;
  let out = source;
  out = exactReplace(out, 'import tempfile\n', 'import tempfile\nimport contextlib\n', 'QMIG_V5_BRIDGE_CONTEXTLIB_IMPORT_CARDINALITY');
  const functionNeedle = '\n\ndef decode_sflux(message: bytes, cycle: datetime, lead: int):\n';
  const bridge = `\n\n@contextlib.contextmanager\ndef _geox_qmig_named_grib_file_v1(message: bytes):\n    with tempfile.NamedTemporaryFile(suffix=".grib2", delete=False) as tmp:\n        tmp.write(message)\n        tmp_path = tmp.name\n    try:\n        with open(tmp_path, "rb") as handle:\n            yield handle\n    finally:\n        try:\n            os.remove(tmp_path)\n        except OSError:\n            pass\n\n\ndef decode_sflux(message: bytes, cycle: datetime, lead: int):\n`;
  out = exactReplace(out, functionNeedle, bridge, 'QMIG_V5_BRIDGE_FUNCTION_INSERT_CARDINALITY');
  out = exactReplace(
    out,
    'def decode_sflux(message: bytes, cycle: datetime, lead: int):\n    with tempfile.TemporaryFile() as handle:\n        handle.write(message); handle.seek(0)\n',
    'def decode_sflux(message: bytes, cycle: datetime, lead: int):\n    with _geox_qmig_named_grib_file_v1(message) as handle:\n',
    'QMIG_V5_BRIDGE_SFLUX_HANDLE_TRANSFORM_CARDINALITY'
  );
  for (const marker of [
    'EA4_SFLUX_GRIB_REQUIRED',
    'EA4_SFLUX_PARAMETER_DRIFT',
    'EA4_SFLUX_STEP_DRIFT',
    'EA4_SFLUX_LEAD_DRIFT',
    'EA4_SFLUX_TIME_DRIFT',
    'EA4_SFLUX_NATIVE_INDEX_DRIFT',
    'EA4_SFLUX_NATIVE_LAT_DRIFT',
    'EA4_SFLUX_NATIVE_LON_DRIFT',
    'EA4_SFLUX_GRID_DEFINITION_DRIFT',
  ]) if (!out.includes(marker)) throw new Error(`QMIG_V5_BRIDGE_SEMANTIC_GUARD_MISSING:${marker}`);
  return out;
}
function buildHelperCompat(source) {
  return exactReplace(
    source,
    'EA4_PATH = ROOT / "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py"',
    `EA4_PATH = ROOT / "${GENERATED_EA4_REL}"`,
    'QMIG_V5_BRIDGE_HELPER_EA4_REBIND_CARDINALITY'
  );
}
function outputRecord(platform, helperSource, ea4Source, helperCompat, ea4Compat) {
  return {
    schema_version: 'geox_mcft_cap09_windows_eccodes_file_handle_bridge_materialization_v1',
    status: 'PASS',
    platform,
    transform_id: TRANSFORM_ID,
    historical_source_commit_sha: HISTORICAL_COMMIT,
    historical_provider_helper_ref: HELPER_REF,
    historical_provider_helper_blob_sha: HELPER_BLOB,
    historical_provider_helper_source_sha256: sha256(helperSource),
    historical_ea4_dependency_ref: EA4_REF,
    historical_ea4_dependency_blob_sha: EA4_BLOB,
    historical_ea4_source_sha256: sha256(ea4Source),
    provider_helper_compat_sha256: sha256(helperCompat),
    ea4_compat_sha256: sha256(ea4Compat),
    generated_provider_helper_authority_rel: GENERATED_HELPER_AUTHORITY_REL,
    generated_ea4_authority_rel: GENERATED_EA4_AUTHORITY_REL,
    generated_provider_helper_rel: GENERATED_HELPER_REL,
    generated_ea4_rel: GENERATED_EA4_REL,
    windows_file_handle_bridge_required: platform === 'win32',
    windows_file_handle_bridge_applied: platform === 'win32',
    bridge_scope: 'QUALIFICATION_LOCAL_FILE_HANDLE_IO_ONLY',
    provider_fetch_logic_changed: false,
    provider_decode_semantic_guards_changed: false,
    target_mismatch_guard_relaxed: false,
    runtime_semantic_mutation: false,
    production_mutation: false,
  };
}
function smoke(python, ea4Path) {
  if (!python) throw new Error('QMIG_V5_BRIDGE_SMOKE_PYTHON_REQUIRED');
  if (!ea4Path || !fs.existsSync(ea4Path)) throw new Error('QMIG_V5_BRIDGE_SMOKE_EA4_REQUIRED');
  const ea4 = fs.readFileSync(ea4Path, 'utf8');
  if (process.platform === 'win32') {
    if (!ea4.includes('_geox_qmig_named_grib_file_v1')) throw new Error('QMIG_V5_BRIDGE_SMOKE_GENERATED_BRIDGE_MISSING');
    const fnStart = ea4.indexOf('def decode_sflux(message: bytes, cycle: datetime, lead: int):');
    const fnEnd = ea4.indexOf('\n\ndef ', fnStart + 1);
    const fn = ea4.slice(fnStart, fnEnd > fnStart ? fnEnd : undefined);
    if (!fn.includes('with _geox_qmig_named_grib_file_v1(message) as handle:')) throw new Error('QMIG_V5_BRIDGE_SMOKE_SFLUX_NOT_REBOUND');
    if (fn.includes('with tempfile.TemporaryFile() as handle:')) throw new Error('QMIG_V5_BRIDGE_SMOKE_TEMPORARYFILE_SURVIVED');
  }
  const script = String.raw`
import json, os, tempfile
from eccodes import codes_get_message, codes_grib_new_from_file, codes_grib_new_from_samples, codes_release
source = codes_grib_new_from_samples("GRIB2")
if source is None:
    raise RuntimeError("QMIG_V5_ECCODES_SAMPLE_REQUIRED")
body = bytes(codes_get_message(source))
codes_release(source)
with tempfile.NamedTemporaryFile(suffix=".grib2", delete=False) as tmp:
    tmp.write(body)
    tmp_path = tmp.name
try:
    with open(tmp_path, "rb") as handle:
        decoded = codes_grib_new_from_file(handle)
    if decoded is None:
        raise RuntimeError("QMIG_V5_ECCODES_FILE_POINTER_DECODE_REQUIRED")
    codes_release(decoded)
finally:
    try:
        os.remove(tmp_path)
    except OSError:
        pass
print(json.dumps({"schema_version":"geox_mcft_cap09_windows_eccodes_file_handle_smoke_v1","status":"PASS","bridge":"NAMED_TEMPFILE_CLOSE_REOPEN_FILE_OBJECT","provider_request_count":0,"runtime_mutation":False,"production_mutation":False}, sort_keys=True))
`;
  const p = spawnSync(python, ['-c', script], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (p.error) throw p.error;
  if (p.status !== 0) throw new Error(`QMIG_V5_BRIDGE_SMOKE_FAILED:${String(p.stderr || p.stdout || '').trim()}`);
  const result = JSON.parse(String(p.stdout).trim());
  if (result.status !== 'PASS') throw new Error('QMIG_V5_BRIDGE_SMOKE_NONPASS');
  return result;
}

function main() {
  const { mode, args } = parseArgs(process.argv.slice(2));
  const repoRoot = git(process.cwd(), ['rev-parse', '--show-toplevel']);
  const { helperSource, ea4Source } = authority(repoRoot);
  const requestedPlatform = args.platform ?? process.platform;
  if (!ALLOWED_PLATFORMS.has(requestedPlatform)) throw new Error(`QMIG_V5_BRIDGE_PLATFORM_INVALID:${requestedPlatform}`);
  const platform = mode === 'selftest' ? requestedPlatform : process.platform;
  const ea4Compat = buildEa4Compat(ea4Source, platform);
  const helperCompat = buildHelperCompat(helperSource);
  const record = outputRecord(platform, helperSource, ea4Source, helperCompat, ea4Compat);

  if (mode === 'selftest') {
    process.stdout.write(JSON.stringify(record, null, 2) + '\n');
    return;
  }
  if (mode === 'materialize') {
    const workspace = path.resolve(args.workspace ?? '');
    if (!workspace || !fs.existsSync(workspace)) throw new Error('QMIG_V5_BRIDGE_WORKSPACE_REQUIRED');
    const helperAuthorityPath = path.join(workspace, GENERATED_HELPER_AUTHORITY_REL);
    const ea4AuthorityPath = path.join(workspace, GENERATED_EA4_AUTHORITY_REL);
    const helperPath = path.join(workspace, GENERATED_HELPER_REL);
    const ea4Path = path.join(workspace, GENERATED_EA4_REL);
    fs.mkdirSync(path.dirname(helperPath), { recursive: true });
    fs.writeFileSync(helperAuthorityPath, helperSource, { encoding: 'utf8', flag: 'wx' });
    fs.writeFileSync(ea4AuthorityPath, ea4Source, { encoding: 'utf8', flag: 'wx' });
    fs.writeFileSync(ea4Path, ea4Compat, { encoding: 'utf8', flag: 'wx' });
    fs.writeFileSync(helperPath, helperCompat, { encoding: 'utf8', flag: 'wx' });
    const materializedHelperBlob = git(repoRoot, ['hash-object', helperAuthorityPath]);
    const materializedEa4Blob = git(repoRoot, ['hash-object', ea4AuthorityPath]);
    if (materializedHelperBlob !== HELPER_BLOB) throw new Error(`QMIG_V5_BRIDGE_MATERIALIZED_HELPER_BLOB_MISMATCH:${materializedHelperBlob}:${HELPER_BLOB}`);
    if (materializedEa4Blob !== EA4_BLOB) throw new Error(`QMIG_V5_BRIDGE_MATERIALIZED_EA4_BLOB_MISMATCH:${materializedEa4Blob}:${EA4_BLOB}`);
    process.stdout.write(JSON.stringify({
      ...record,
      materialized_historical_provider_helper_blob_sha: materializedHelperBlob,
      materialized_historical_ea4_dependency_blob_sha: materializedEa4Blob,
      generated_provider_helper_authority_path: helperAuthorityPath,
      generated_ea4_authority_path: ea4AuthorityPath,
      generated_provider_helper_path: helperPath,
      generated_ea4_path: ea4Path,
    }, null, 2) + '\n');
    return;
  }
  if (mode === 'smoke') {
    const result = smoke(args.python, args.ea4);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  throw new Error(`QMIG_V5_BRIDGE_UNKNOWN_MODE:${mode}`);
}

main();
