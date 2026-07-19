#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const POLICY_PATH = path.join(ROOT, 'docs/digital_twin/mcft/MCFT-DELIVERY-POLICY-V2.json');
const REGISTRY_PATH = path.join(ROOT, 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json');
const RESULT_PATH = path.join(ROOT, 'acceptance-output/MCFT_CANDIDATE_DECLARATION_INTEGRITY_V2_RESULT.json');
const MODE = process.argv[2] || '--selftest';

function loadJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function writeResult(value) {
  fs.mkdirSync(path.dirname(RESULT_PATH), { recursive: true });
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function isSha(value) { return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function parseScalar(value) { try { return JSON.parse(String(value).trim()); } catch { return String(value).trim(); } }
function same(left, right) { try { assert.deepEqual(left, right); return true; } catch { return false; } }
function getField(value, fieldPath) {
  return String(fieldPath).split('.').filter(Boolean).reduce((current, key) => {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    return current[key];
  }, value);
}
function declarationMatches(body, marker) {
  return [...String(body || '').matchAll(new RegExp(`<!--\\s*${marker}\\s*\\n([\\s\\S]*?)-->`, 'gm'))];
}
function parseDeclaration(body, policy) {
  const marker = policy.candidate_declaration.marker;
  const matches = declarationMatches(body, marker);
  if (matches.length === 0) return null;
  if (matches.length !== 1) throw new Error(`CANDIDATE_DECLARATION_BLOCK_CARDINALITY:${matches.length}`);
  const declaration = {};
  for (const rawLine of matches[0][1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) throw new Error(`CANDIDATE_DECLARATION_LINE_INVALID:${line}`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (Object.hasOwn(declaration, key)) throw new Error(`CANDIDATE_DECLARATION_DUPLICATE_KEY:${key}`);
    declaration[key] = value;
  }
  assert.deepEqual(Object.keys(declaration).sort(), [...policy.candidate_declaration.required_fields].sort(), 'CANDIDATE_DECLARATION_KEY_SET_INVALID');
  if (!/^MCFT-CAP-[0-9]+$/.test(declaration.capability_line)) throw new Error('CANDIDATE_CAPABILITY_LINE_INVALID');
  if (!declaration.slice_id.startsWith(`${declaration.capability_line}.`)) throw new Error('CANDIDATE_SLICE_CAPABILITY_MISMATCH');
  if (!/^docs\/digital_twin\/mcft\/cap_[0-9]+\/.+\.json$/.test(declaration.status_file)) throw new Error('CANDIDATE_STATUS_FILE_INVALID');
  for (const key of ['candidate_field', 'focused_workflow', 'standard_workflow']) {
    if (!/^[A-Za-z0-9_.-]+$/.test(declaration[key])) throw new Error(`CANDIDATE_DECLARATION_FIELD_INVALID:${key}`);
  }
  if (!isSha(declaration.candidate_head) || !isSha(declaration.base_head)) throw new Error('CANDIDATE_SHA_INVALID');
  const semanticFiles = declaration.semantic_snapshot_files.split(',').map((value) => value.trim()).filter(Boolean);
  const semanticBlobs = declaration.semantic_snapshot_blobs.split(',').map((value) => value.trim()).filter(Boolean);
  if (semanticFiles.length < 1 || semanticFiles.length > 20 || semanticFiles.length !== semanticBlobs.length) throw new Error('CANDIDATE_SEMANTIC_SNAPSHOT_CARDINALITY_INVALID');
  if (new Set(semanticFiles).size !== semanticFiles.length) throw new Error('CANDIDATE_SEMANTIC_PATH_DUPLICATE');
  for (const file of semanticFiles) if (!/^(docs|scripts|apps)\//.test(file) || file.includes('..')) throw new Error(`CANDIDATE_SEMANTIC_PATH_INVALID:${file}`);
  for (const blob of semanticBlobs) if (!isSha(blob)) throw new Error(`CANDIDATE_SEMANTIC_BLOB_INVALID:${blob}`);
  if (!semanticFiles.includes(declaration.status_file)) throw new Error('CANDIDATE_STATUS_FILE_NOT_IN_SEMANTIC_SNAPSHOT');
  return {
    ...declaration,
    candidate_value_parsed: parseScalar(declaration.candidate_value),
    semantic_files: semanticFiles,
    semantic_blobs: semanticBlobs,
  };
}
function signalContractPath(registry) {
  const relative = String(registry.delivery_candidate_signal_contract_ref || '').trim();
  if (!relative || relative.includes('..') || !relative.startsWith('docs/digital_twin/mcft/')) throw new Error('DELIVERY_CANDIDATE_SIGNAL_CONTRACT_REF_INVALID');
  return path.join(ROOT, relative);
}
function loadAuthorities() {
  const policy = loadJson(POLICY_PATH);
  const registry = loadJson(REGISTRY_PATH);
  const signalContract = loadJson(signalContractPath(registry));
  return validatePolicyRegistryAndSignalContract(policy, registry, signalContract);
}
function validatePolicyRegistryAndSignalContract(policy, registry, signalContract) {
  assert.equal(policy.policy_id, 'MCFT-DELIVERY-POLICY-V2');
  assert.equal(policy.candidate_declaration.authority_registry_ref, 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json');
  assert.equal(policy.candidate_declaration.discovery_mode, 'AUTHORITY_REGISTRY_WITH_FAIL_CLOSED_UNREGISTERED_CANDIDATE_DETECTION');
  assert.equal(policy.candidate_declaration.array_traversal_required, true);
  assert.equal(policy.workflow_security.pull_request_target_executes_default_branch_policy_only, true);
  assert.equal(registry.registry_id, 'MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1');
  assert.equal(registry.registry_revision, '1.1');
  assert.equal(registry.default_behavior, 'FAIL_CLOSED');
  assert.equal(registry.array_traversal_required, true);
  assert.equal(signalContract.contract_id, 'MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1');
  assert.equal(signalContract.string_matching_mode, 'EXACT_ENUM_ONLY');
  assert.equal(signalContract.boolean_matching_mode, 'EXACT_FIELD_NAME_OR_EXPLICIT_SLICE_PATTERN_AND_TRUE_ONLY');
  assert.equal(signalContract.nested_array_traversal_required, true);
  assert.equal(signalContract.pr_modified_registry_trusted_for_same_pr, false);
  assert.ok(Array.isArray(signalContract.explicit_candidate_status_values) && signalContract.explicit_candidate_status_values.length >= 5);
  assert.ok(Array.isArray(signalContract.explicit_candidate_boolean_field_names));
  assert.ok(Array.isArray(signalContract.explicit_candidate_boolean_field_patterns));
  assert.ok(Array.isArray(signalContract.domain_term_non_signals) && signalContract.domain_term_non_signals.length >= 4);
  for (const pattern of signalContract.explicit_candidate_boolean_field_patterns) new RegExp(pattern);
  return { policy, registry, signalContract };
}
function capabilityEntry(registry, capabilityLine) {
  return registry.capabilities.find((entry) => entry.capability_line === capabilityLine) || null;
}
function validateDeclarationRegistration(declaration, registry) {
  const entry = capabilityEntry(registry, declaration.capability_line);
  if (!entry) throw new Error(`UNREGISTERED_CAPABILITY_LINE:${declaration.capability_line}`);
  if (entry.candidate_declaration_enabled !== true) throw new Error(`CANDIDATE_DECLARATION_DISABLED:${declaration.capability_line}`);
  if (!entry.authoritative_candidate_status_paths.includes(declaration.status_file)) throw new Error(`UNREGISTERED_CANDIDATE_STATUS_PATH:${declaration.status_file}`);
  const rule = entry.candidate_transition_fields.find((item) => item.status_file === declaration.status_file && item.field_path === declaration.candidate_field);
  if (!rule) throw new Error(`UNREGISTERED_CANDIDATE_FIELD:${declaration.status_file}:${declaration.candidate_field}`);
  if (!rule.allowed_candidate_values.some((value) => same(value, declaration.candidate_value_parsed))) throw new Error(`UNREGISTERED_CANDIDATE_VALUE:${declaration.candidate_field}`);
  return { entry, rule };
}
function booleanFieldMatches(key, signalContract) {
  if (signalContract.explicit_candidate_boolean_field_names.includes(key)) return true;
  return signalContract.explicit_candidate_boolean_field_patterns.some((pattern) => new RegExp(pattern).test(key));
}
function collectExplicitDeliveryCandidateSignals(value, signalContract, keyPath = [], output = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectExplicitDeliveryCandidateSignals(item, signalContract, [...keyPath, String(index)], output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  const statuses = new Set(signalContract.explicit_candidate_status_values);
  for (const [key, current] of Object.entries(value)) {
    const next = [...keyPath, key];
    if (current === true && booleanFieldMatches(key, signalContract)) {
      output.push({ field: next.join('.'), value: current, kind: 'EXPLICIT_BOOLEAN_DELIVERY_CANDIDATE_SIGNAL' });
    }
    if (typeof current === 'string' && statuses.has(current)) {
      output.push({ field: next.join('.'), value: current, kind: 'EXACT_STATUS_DELIVERY_CANDIDATE_SIGNAL' });
    }
    if (current && typeof current === 'object') collectExplicitDeliveryCandidateSignals(current, signalContract, next, output);
  }
  return output;
}
function collectRegisteredTransitions(base, head, entry, filePath) {
  const transitions = [];
  for (const rule of entry.candidate_transition_fields.filter((item) => item.status_file === filePath)) {
    const before = getField(base || {}, rule.field_path);
    const after = getField(head || {}, rule.field_path);
    if (!same(before, after) && rule.allowed_candidate_values.some((value) => same(value, after))) {
      transitions.push({ file: filePath, field: rule.field_path, base_value: before, head_value: after, kind: 'REGISTERED_CANDIDATE_TRANSITION' });
    }
  }
  return transitions;
}
async function apiJson(apiPath, token) {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'geox-mcft-candidate-integrity-v2-2' },
  });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`GITHUB_API_FAILED:${response.status}:${apiPath}:${body.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}
function decodeContent(payload, code) {
  if (!payload || payload.type !== 'file' || payload.encoding !== 'base64' || typeof payload.content !== 'string') throw new Error(code);
  return Buffer.from(payload.content.replace(/\s/g, ''), 'base64').toString('utf8');
}
async function readRepositoryFile(repository, filePath, ref, token) {
  const encoded = encodeURIComponent(filePath).replace(/%2F/g, '/');
  const payload = await apiJson(`/repos/${repository}/contents/${encoded}?ref=${encodeURIComponent(ref)}`, token);
  return { blob_sha: payload.sha, text: decodeContent(payload, `REPOSITORY_FILE_INVALID:${filePath}`) };
}
async function readOptionalJson(repository, filePath, ref, token) {
  try {
    const file = await readRepositoryFile(repository, filePath, ref, token);
    return { ...file, json: JSON.parse(file.text) };
  } catch (error) {
    if (error && error.status === 404) return null;
    throw error;
  }
}
async function listPullFiles(repository, prNumber, token) {
  const output = [];
  for (let page = 1; page <= 20; page += 1) {
    const batch = await apiJson(`/repos/${repository}/pulls/${prNumber}/files?per_page=100&page=${page}`, token);
    output.push(...batch);
    if (batch.length < 100) break;
  }
  return output;
}
async function detectTransitions(repository, pr, token, registry, signalContract) {
  const files = (await listPullFiles(repository, pr.number, token)).filter((file) => /^docs\/digital_twin\/mcft\/cap_[0-9]+\/.+\.json$/i.test(file.filename));
  const transitions = [];
  const unregisteredSignals = [];
  for (const file of files) {
    if (!['added', 'modified', 'renamed'].includes(file.status)) continue;
    const head = await readOptionalJson(repository, file.filename, pr.head.sha, token);
    if (!head) continue;
    const basePath = file.previous_filename || file.filename;
    const base = await readOptionalJson(repository, basePath, pr.base.sha, token);
    const match = file.filename.match(/^docs\/digital_twin\/mcft\/cap_([0-9]+)\//i);
    const capabilityLine = `MCFT-CAP-${String(Number(match[1])).padStart(2, '0')}`;
    const entry = capabilityEntry(registry, capabilityLine);
    const registered = entry?.authoritative_candidate_status_paths.includes(file.filename) || false;
    const beforeSignals = collectExplicitDeliveryCandidateSignals(base?.json || {}, signalContract);
    const afterSignals = collectExplicitDeliveryCandidateSignals(head.json, signalContract);
    const newSignals = afterSignals.filter((signal) => !beforeSignals.some((item) => item.field === signal.field && same(item.value, signal.value)));
    if (registered) {
      const registeredTransitions = collectRegisteredTransitions(base?.json || {}, head.json, entry, file.filename);
      transitions.push(...registeredTransitions);
      for (const signal of newSignals) {
        const covered = entry.candidate_transition_fields.some((rule) => rule.status_file === file.filename
          && rule.field_path === signal.field
          && rule.allowed_candidate_values.some((value) => same(value, signal.value)));
        if (!covered) unregisteredSignals.push({ file: file.filename, capability_line: capabilityLine, ...signal });
      }
    } else {
      for (const signal of newSignals) unregisteredSignals.push({ file: file.filename, capability_line: capabilityLine, ...signal });
    }
  }
  return { transitions, unregisteredSignals };
}
function latestRun(runs, workflowName, pr) {
  return runs.filter((run) => run.name === workflowName && run.event === 'pull_request' && run.head_sha === pr.head.sha && run.head_branch === pr.head.ref)
    .sort((left, right) => Number(right.run_number) - Number(left.run_number))[0] || null;
}
async function waitForRequiredRuns(repository, pr, declaration, token) {
  const maxAttempts = Number(process.env.MCFT_CANDIDATE_V2_MAX_ATTEMPTS || 240);
  const intervalMs = Number(process.env.MCFT_CANDIDATE_V2_POLL_INTERVAL_MS || 15000);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const page = await apiJson(`/repos/${repository}/actions/runs?head_sha=${pr.head.sha}&event=pull_request&per_page=100`, token);
    const focused = latestRun(page.workflow_runs || [], declaration.focused_workflow, pr);
    const standard = latestRun(page.workflow_runs || [], declaration.standard_workflow, pr);
    const failed = [focused, standard].find((run) => run && run.status === 'completed' && run.conclusion !== 'success');
    if (failed) throw new Error(`REQUIRED_WORKFLOW_NOT_PASS:${failed.name}:${failed.id}:${failed.conclusion}`);
    if (focused?.status === 'completed' && focused.conclusion === 'success' && standard?.status === 'completed' && standard.conclusion === 'success') return { focused, standard, attempt_count: attempt };
    if (attempt < maxAttempts) await sleep(intervalMs);
  }
  throw new Error('REQUIRED_WORKFLOWS_NOT_COMPLETED');
}
function selftest() {
  const { policy, registry, signalContract } = loadAuthorities();
  const cap07Status = 'docs/digital_twin/mcft/cap_07/GEOX-MCFT-CAP-07-CURRENT-AUTHORITY-V1.json';
  const body = `<!-- ${policy.candidate_declaration.marker}\ncapability_line=MCFT-CAP-07\nslice_id=MCFT-CAP-07.S0\nstatus_file=${cap07Status}\ncandidate_field=status\ncandidate_value=AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE\nfocused_workflow=mcft-cap-07-s0-authorization\nstandard_workflow=ci\nsemantic_snapshot_files=${cap07Status}\nsemantic_snapshot_blobs=${'1'.repeat(40)}\ncandidate_head=${'2'.repeat(40)}\nbase_head=${'3'.repeat(40)}\n-->`;
  const declaration = parseDeclaration(body, policy);
  validateDeclarationRegistration(declaration, registry);
  const cap07 = capabilityEntry(registry, 'MCFT-CAP-07');
  const transitions = collectRegisteredTransitions(
    { status: 'BLOCKED_REPOSITORY_FOUNDATION_P1B' },
    { status: 'AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE' },
    cap07,
    declaration.status_file,
  );
  assert.equal(transitions.length, 1);

  const domainSignals = collectExplicitDeliveryCandidateSignals({
    label: 'Calibration Candidate',
    projection: 'twin_calibration_candidate_projection_v1',
    description: 'candidate evaluation',
    attachment: 'candidate attachment',
    calibration_candidate: true,
  }, signalContract);
  assert.equal(domainSignals.length, 0, 'DOMAIN_CANDIDATE_TERMS_MUST_NOT_BE_DELIVERY_SIGNALS');

  const arraySignals = collectExplicitDeliveryCandidateSignals({ values: [{ status: 'REPAIR_CANDIDATE' }] }, signalContract);
  assert.equal(arraySignals.length, 1);
  assert.equal(arraySignals[0].field, 'values.0.status');

  const booleanSignals = collectExplicitDeliveryCandidateSignals({
    implementation_candidate: true,
    calibration_candidate: true,
    nested: { s10_candidate_implemented: true },
  }, signalContract);
  assert.equal(booleanSignals.length, 2);
  assert.equal(booleanSignals.some((item) => item.field === 'implementation_candidate'), true);
  assert.equal(booleanSignals.some((item) => item.field === 'nested.s10_candidate_implemented'), true);

  const cap06Body = `<!-- ${policy.candidate_declaration.marker}\ncapability_line=MCFT-CAP-06\nslice_id=MCFT-CAP-06.S9\nstatus_file=docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-STATUS.json\ncandidate_field=s9_candidate_implemented\ncandidate_value=true\nfocused_workflow=mcft-cap-06-s9-non-consumption\nstandard_workflow=ci\nsemantic_snapshot_files=docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S9-POST-EVALUATION-NON-CONSUMPTION-STATUS.json\nsemantic_snapshot_blobs=${'1'.repeat(40)}\ncandidate_head=${'2'.repeat(40)}\nbase_head=${'3'.repeat(40)}\n-->`;
  assert.throws(() => validateDeclarationRegistration(parseDeclaration(cap06Body, policy), registry), /CANDIDATE_DECLARATION_DISABLED:MCFT-CAP-06/);
  assert.throws(() => validateDeclarationRegistration({ ...declaration, status_file: 'docs/digital_twin/mcft/cap_07/UNREGISTERED.json' }, registry), /UNREGISTERED_CANDIDATE_STATUS_PATH/);

  writeResult({
    schema_version: 'geox_mcft_candidate_declaration_integrity_v2_2_result_v1',
    status: 'PASS',
    mode: 'SELFTEST',
    registry_driven: true,
    explicit_delivery_signal_only: true,
    domain_candidate_term_separation_verified: true,
    array_traversal_verified: true,
    cap07_minimal_registry_bootstrap_verified: true,
    cap06_candidate_declaration_disabled: true,
    trusted_default_branch_registry_required: true,
    pr_modified_registry_trusted_for_same_pr: false,
    registered_transition_count: transitions.length,
    capability_slice: false,
    runtime_authority: false,
  });
}
async function enforce() {
  const { policy, registry, signalContract } = loadAuthorities();
  const token = String(process.env.GITHUB_TOKEN || '').trim();
  const repository = String(process.env.GITHUB_REPOSITORY || '').trim();
  const eventPath = String(process.env.GITHUB_EVENT_PATH || '').trim();
  if (!token || !repository.includes('/') || !eventPath || !fs.existsSync(eventPath)) throw new Error('GITHUB_ENFORCEMENT_CONTEXT_INVALID');
  const event = loadJson(eventPath);
  if (!event.pull_request?.number) throw new Error('PULL_REQUEST_TARGET_EVENT_REQUIRED');
  const pr = await apiJson(`/repos/${repository}/pulls/${event.pull_request.number}`, token);
  const declaration = parseDeclaration(pr.body || '', policy);
  const { transitions, unregisteredSignals } = await detectTransitions(repository, pr, token, registry, signalContract);
  if (unregisteredSignals.length) throw new Error(`UNREGISTERED_CANDIDATE_AUTHORITY:${JSON.stringify(unregisteredSignals.slice(0, 10))}`);
  if (!declaration && transitions.length === 0) {
    writeResult({ schema_version: 'geox_mcft_candidate_declaration_integrity_v2_2_result_v1', status: 'PASS', mode: 'ENFORCE', disposition: 'NO_CANDIDATE_TRANSITION', pr_number: pr.number, head_sha: pr.head.sha, base_sha: pr.base.sha });
    return;
  }
  if (!declaration) throw new Error(`CANDIDATE_TRANSITION_REQUIRES_DECLARATION:${JSON.stringify(transitions)}`);
  if (transitions.length === 0) throw new Error('DECLARATION_WITHOUT_REGISTERED_CANDIDATE_TRANSITION');
  validateDeclarationRegistration(declaration, registry);
  if (declaration.candidate_head !== pr.head.sha || declaration.base_head !== pr.base.sha) throw new Error('DECLARATION_HEAD_OR_BASE_MISMATCH');
  const declaredTransition = transitions.find((item) => item.file === declaration.status_file && item.field === declaration.candidate_field && same(item.head_value, declaration.candidate_value_parsed));
  if (!declaredTransition) throw new Error('DECLARATION_DOES_NOT_MATCH_REGISTERED_TRANSITION');
  const status = await readRepositoryFile(repository, declaration.status_file, pr.head.sha, token);
  if (!same(getField(JSON.parse(status.text), declaration.candidate_field), declaration.candidate_value_parsed)) throw new Error('DECLARED_STATUS_FIELD_VALUE_MISMATCH');
  for (let index = 0; index < declaration.semantic_files.length; index += 1) {
    const file = await readRepositoryFile(repository, declaration.semantic_files[index], pr.head.sha, token);
    if (file.blob_sha !== declaration.semantic_blobs[index]) throw new Error(`SEMANTIC_BLOB_MISMATCH:${declaration.semantic_files[index]}`);
  }
  const runs = await waitForRequiredRuns(repository, pr, declaration, token);
  const finalPr = await apiJson(`/repos/${repository}/pulls/${pr.number}`, token);
  if (finalPr.head.sha !== pr.head.sha || finalPr.base.sha !== pr.base.sha) throw new Error('PR_HEAD_OR_BASE_MOVED_DURING_PROOF');
  writeResult({
    schema_version: 'geox_mcft_candidate_declaration_integrity_v2_2_result_v1',
    status: 'PASS', mode: 'ENFORCE', disposition: 'GENERIC_CANDIDATE_DECLARATION_VALID', validation_mode: 'REGISTRY_DRIVEN_EXPLICIT_SIGNAL_CONTRACT',
    pr_number: pr.number, head_sha: pr.head.sha, base_sha: pr.base.sha,
    capability_line: declaration.capability_line, slice_id: declaration.slice_id,
    registered_transition_count: transitions.length,
    focused_run_id: runs.focused.id, standard_run_id: runs.standard.id,
    poll_attempt_count: runs.attempt_count,
  });
}
function mergeGroup() {
  loadAuthorities();
  const eventName = String(process.env.GITHUB_EVENT_NAME || 'merge_group');
  const ref = String(process.env.GITHUB_REF || 'refs/heads/gh-readonly-queue/main/test');
  const sha = String(process.env.GITHUB_SHA || '0'.repeat(40));
  assert.equal(eventName, 'merge_group', 'MERGE_GROUP_EVENT_REQUIRED');
  assert.equal(ref.includes('gh-readonly-queue/main/'), true, 'MERGE_GROUP_MAIN_REF_REQUIRED');
  assert.equal(isSha(sha), true, 'MERGE_GROUP_SHA_INVALID');
  writeResult({ schema_version: 'geox_mcft_candidate_declaration_integrity_v2_2_result_v1', status: 'PASS', mode: 'MERGE_GROUP', subject_commit: sha, subject_ref: ref, registry_integrity: 'PASS', explicit_signal_contract_integrity: 'PASS', repository_write_performed: false });
}

(async () => {
  try {
    if (MODE === '--selftest') selftest();
    else if (MODE === '--enforce') await enforce();
    else if (MODE === '--merge-group') mergeGroup();
    else throw new Error(`UNKNOWN_MODE:${MODE}`);
  } catch (error) {
    const result = { schema_version: 'geox_mcft_candidate_declaration_integrity_v2_2_result_v1', status: 'FAIL', mode: MODE, error: error instanceof Error ? error.message : String(error) };
    writeResult(result);
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  }
})();
