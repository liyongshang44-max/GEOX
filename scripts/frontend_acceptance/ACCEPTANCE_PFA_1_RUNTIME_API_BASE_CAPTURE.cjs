// scripts/frontend_acceptance/ACCEPTANCE_PFA_1_RUNTIME_API_BASE_CAPTURE.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const clientPath = 'apps/web/src/api/client.ts';
const evidencePath = 'docs/frontend-acceptance/PFA-1-RUNTIME-API-BASE-CAPTURE.md';
const gatePath = 'scripts/frontend_acceptance/ACCEPTANCE_PFA_1_RUNTIME_API_BASE_CAPTURE.cjs';
const capturePath = 'scripts/frontend_acceptance/CAPTURE_PFA_0_PAGE_REVIEW.cjs';
const allowedChangedFiles = new Set([clientPath, evidencePath, gatePath]);
const forbiddenExactFiles = new Set([
  'apps/web/src/views/LoginPage.tsx',
  'apps/web/vite.config.ts',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'apps/web/package.json',
  capturePath,
]);
const forbiddenPrefixes = [
  'apps/server/',
  'migrations/',
  'packages/contracts/',
  'fixtures/',
  '.github/',
  'apps/web/src/auth/',
  'apps/web/src/app/',
  'apps/web/src/features/',
  'apps/web/src/layouts/',
  'apps/web/src/styles/',
  'apps/web/src/design-system/',
  'apps/web/dist/',
  'docs/audit/',
];
const assertions = [];

function absolute(file) {
  return path.join(root, file);
}

function read(file) {
  return fs.readFileSync(absolute(file), 'utf8');
}

function git(args) {
  try {
    return cp.execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function workingTreeFiles() {
  const output = git(['status', '--short', '--untracked-files=all']);
  if (!output) return [];
  return output
    .split(/\r?\n/)
    .map((line) => line.includes(' -> ') ? line.split(' -> ').pop().trim() : line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim())
    .filter(Boolean);
}

function changedFiles() {
  const files = new Set();
  const output = git(['diff', '--name-only', 'origin/main...HEAD']) || git(['diff', '--name-only', 'main...HEAD']);
  if (output) output.split(/\r?\n/).filter(Boolean).forEach((file) => files.add(file.trim()));
  workingTreeFiles().forEach((file) => files.add(file));
  return [...files].sort();
}

function assert(name, passed, details = {}) {
  const result = { name, passed: passed === true, details };
  assertions.push(result);
  if (!result.passed) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
  console.log(`[pfa-1-runtime-api-base] ok: ${name}`);
}

function includesAll(text, values) {
  return values.every((value) => text.includes(value));
}

function forbiddenChangedFile(file) {
  return forbiddenExactFiles.has(file) || forbiddenPrefixes.some((prefix) => file.startsWith(prefix));
}

try {
  [clientPath, evidencePath, gatePath, capturePath].forEach((file) => {
    assert(`exists:${file}`, fs.existsSync(absolute(file)), { file });
  });

  const changed = changedFiles();
  assert('changed_files_are_pfa1_only', changed.length > 0 && changed.every((file) => allowedChangedFiles.has(file)), {
    changed,
    allowed: [...allowedChangedFiles],
  });
  assert('required_pfa1_files_changed', [clientPath, evidencePath, gatePath].every((file) => changed.includes(file)), { changed });
  assert('forbidden_files_unchanged', changed.every((file) => !forbiddenChangedFile(file)), { changed });
  assert('no_generated_artifacts_changed', changed.every((file) => !/\.(png|jpe?g|webp|zip|tar|gz)$/i.test(file)), { changed });

  const client = read(clientPath);
  const evidence = read(evidencePath);
  const capture = read(capturePath);

  const primaryIndex = client.indexOf('import.meta.env.VITE_API_BASE_URL');
  const secondaryIndex = client.indexOf('import.meta.env.VITE_API_BASE ??');
  const fallbackIndex = client.indexOf('DEFAULT_API_BASE;', secondaryIndex);

  assert('default_api_base_preserved', client.includes('const DEFAULT_API_BASE = "http://127.0.0.1:3001";'));
  assert('api_contract_version_preserved', client.includes('const API_CONTRACT_VERSION = "2026-04-06";'));
  assert('direct_vite_api_base_url_access', primaryIndex >= 0, { primaryIndex });
  assert('direct_vite_api_base_alias_access', secondaryIndex >= 0, { secondaryIndex });
  assert('api_base_precedence', primaryIndex >= 0 && secondaryIndex > primaryIndex && fallbackIndex > secondaryIndex, {
    primaryIndex,
    secondaryIndex,
    fallbackIndex,
  });
  assert('trailing_slash_normalization_preserved', client.includes('export const API_BASE_URL = String(configuredApiBase).replace(/\\/+$/, "");'));
  assert('legacy_optional_chain_env_removed', !client.includes('(import.meta as any)?.env') && !/import\.meta\s+as\s+any/.test(client));

  assert('authorization_rule_preserved', includesAll(client, [
    'readSessionToken()',
    'headers.has("Authorization")',
    'headers.set("Authorization", `Bearer ${token}`)',
  ]));
  assert('tenant_context_rule_preserved', includesAll(client, [
    'readTenantContext()',
    'tenant_id:',
    'project_id:',
    'group_id:',
    'headers.set("x-tenant-id", tenant.tenant_id)',
    'headers.set("x-project-id", tenant.project_id)',
    'headers.set("x-group-id", tenant.group_id)',
  ]));
  assert('request_contract_header_preserved', includesAll(client, [
    'headers.has("x-api-contract-version")',
    'headers.set("x-api-contract-version", API_CONTRACT_VERSION)',
  ]));

  assert('capture_runtime_origin_probe_preserved', includesAll(capture, [
    'runtime api base locale=',
    'runtime api base mismatch',
    'browser auth/login request locale=',
    'originMatch=',
    'browser auth/me verify locale=',
    "authorization=${authorizationPresent ? 'present' : 'missing'}",
  ]));
  assert('capture_full_matrix_contract_preserved', includesAll(capture, [
    "process.env.PFA0_CAPTURE_MODE || 'full'",
    'capture plan: mode=',
    'jobs=${jobs.length}',
    'screenshots: results.length',
  ]));
  assert('capture_auth_state_guards_preserved', includesAll(capture, [
    'browser login storage state is incomplete',
    'unexpected login redirect',
    'auth validation placeholder still visible',
    'page body is empty',
  ]));

  assert('evidence_phase_declared', includesAll(evidence, [
    'PFA-1 Runtime API-Base and Capture Enablement',
    'PFA-0 baseline commit',
    'Runtime source commit',
    '30 routes',
    '2 locales',
    '3 viewports',
    '180 screenshots',
  ]));
  assert('evidence_nonclaims_declared', includesAll(evidence, [
    'Page-quality acceptance remains FAIL',
    'PFA-2 through PFA-7',
    'does not claim',
  ]));
  assert('evidence_contains_no_credentials', !/(admin_token|bearer\s+[a-z0-9._-]{8,}|access[_ -]?token\s*[:=]\s*\S+)/i.test(evidence));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFA_1_RUNTIME_API_BASE_CAPTURE',
    changedFiles: changed,
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_PFA_1_RUNTIME_API_BASE_CAPTURE',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
