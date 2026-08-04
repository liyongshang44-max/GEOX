'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const CURRENT = 'docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json';
const CONTRACT = 'docs/frontend-productization/PFE-14-S3-OPERATOR-SHELL-CONTRACT.json';
const BOUNDARY = 'docs/frontend-productization/PFE-14-S3-CHANGED-FILE-BOUNDARY.json';
const READ_CONTRACT = 'docs/frontend-productization/PFE-14-S1-FRONTEND-READ-CONTRACT.json';
const COPY_CONTRACT = 'docs/frontend-productization/PFE-14-S1-COPY-NONCLAIM-CONTRACT.json';
const VISUAL_CONTRACT = 'docs/frontend-productization/PFE-14-S2-APPLE-VISUAL-CONTRACT.json';
const LAYOUT = 'apps/web/src/layouts/OperatorLayout.tsx';
const CSS = 'apps/web/src/styles/operatorShellApple.css';
const APP = 'apps/web/src/app/App.tsx';
const OUTPUT = path.join(ROOT, 'acceptance-output/PFE_14_S3_OPERATOR_SHELL_RESULT.json');

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const check = (value, message) => { if (!value) throw new Error(message); };
const same = (actual, expected, message) => assert.deepEqual(actual, expected, message);
const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));

function writeResult(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const current = json(CURRENT);
  const contract = json(CONTRACT);
  const boundary = json(BOUNDARY);
  const readContract = json(READ_CONTRACT);
  const copyContract = json(COPY_CONTRACT);
  const visualContract = json(VISUAL_CONTRACT);
  const layout = read(LAYOUT);
  const css = read(CSS);

  const baseSha = process.env.PFE14_BASE_SHA || boundary.base_main_sha;
  check(/^[0-9a-f]{40}$/.test(baseSha), 'PFE14_S3_BASE_SHA_INVALID');
  git('cat-file', '-e', `${baseSha}^{commit}`);
  check(boundary.predecessor_merge_sha === baseSha, 'PFE14_S3_PREDECESSOR_BINDING_MISMATCH');

  const changedFiles = git('diff', '--name-only', `${baseSha}...HEAD`).split(/\r?\n/).filter(Boolean);
  same(sorted(changedFiles), sorted(boundary.expected_changed_files), 'PFE14_S3_CHANGED_FILES_MISMATCH');
  same(sorted(changedFiles), sorted(boundary.allowed_exact_files), 'PFE14_S3_ALLOWLIST_MISMATCH');
  check(changedFiles.length === boundary.expected_changed_file_count, 'PFE14_S3_CHANGED_FILE_COUNT_MISMATCH');
  for (const file of changedFiles) {
    check(!boundary.forbidden_prefixes.some((prefix) => file.startsWith(prefix)), `PFE14_S3_FORBIDDEN_PREFIX:${file}`);
    check(!boundary.forbidden_exact_files.includes(file), `PFE14_S3_FORBIDDEN_FILE:${file}`);
  }

  check(current.slice_id === 'PFE-14.S3', 'PFE14_S3_CURRENT_SLICE_MISMATCH');
  check(current.status === 'S3_OPERATOR_SHELL_CONSOLIDATION_IN_PROGRESS', 'PFE14_S3_CURRENT_STATUS_MISMATCH');
  check(current.base_main_sha === baseSha, 'PFE14_S3_CURRENT_BASE_MISMATCH');
  check(current.s2_merge_sha === baseSha && current.s2_effective === true, 'PFE14_S3_S2_PREDECESSOR_NOT_EFFECTIVE');
  for (const key of [
    'operator_layout_source_authorized', 'operator_shell_css_authorized',
    'valid_navigation_consolidation_authorized', 'runtime_context_slot_authorized',
    'legacy_navigation_removal_authorized'
  ]) {
    check(current[key] === true, `PFE14_S3_AUTHORITY_MISSING:${key}`);
  }
  for (const key of [
    'page_source_authorized', 'route_source_authorized', 'api_client_source_authorized', 'backend_source_authorized',
    'database_delta_authorized', 'package_delta_authorized', 'workflow_delta_authorized',
    'runtime_claim_authorized', 'shadow_online_label_authorized', 'authoritative_runtime_context_authorized',
    'scheduler_ui_authorized', 'evidence_freshness_ui_authorized', 'backfill_ui_authorized',
    'recovery_ui_authorized', 'controlled_action_authorized', 'ao_act_authorized', 'dispatch_authorized',
    'model_activation_authorized', 'production_launch_authorized', 'commercial_launch_authorized',
    'candidate_declaration_authorized', 's3_effective'
  ]) {
    check(current[key] === false, `PFE14_S3_AUTHORITY_MUST_REMAIN_FALSE:${key}`);
  }

  check(readContract.record_status === 'DESIGN_FROZEN_NOT_IMPLEMENTED', 'PFE14_S3_READ_CONTRACT_DRIFT');
  check(copyContract.record_status === 'DESIGN_FROZEN_NOT_IMPLEMENTED', 'PFE14_S3_COPY_CONTRACT_DRIFT');
  check(visualContract.record_status === 'VISUAL_FOUNDATION_FROZEN_NOT_APPLIED_TO_PAGES', 'PFE14_S3_VISUAL_CONTRACT_DRIFT');
  check(contract.record_status === 'SHELL_CONSOLIDATION_FROZEN', 'PFE14_S3_CONTRACT_STATUS_MISMATCH');
  check(contract.base_main_sha === baseSha, 'PFE14_S3_CONTRACT_BASE_MISMATCH');
  same(contract.valid_primary_navigation.map((item) => item.key), ['overview', 'fields'], 'PFE14_S3_VALID_NAV_MISMATCH');
  check(contract.removed_navigation_slots.length === 6, 'PFE14_S3_REMOVED_NAV_COUNT_MISMATCH');
  check(contract.pilot_route_policy.operator_layout_injection_removed === true, 'PFE14_S3_PILOT_INJECTION_NOT_REMOVED');
  check(contract.pilot_route_policy.navigation_visible === false, 'PFE14_S3_PILOT_NAV_VISIBLE');
  check(contract.runtime_context_slot.accepts_external_descriptor === true, 'PFE14_S3_CONTEXT_SLOT_NOT_DYNAMIC');
  check(contract.runtime_context_slot.default_source === 'governed-static-nonclaim', 'PFE14_S3_CONTEXT_DEFAULT_SOURCE_MISMATCH');
  check(contract.runtime_context_slot.authoritative_source_enabled_in_s3 === false, 'PFE14_S3_AUTHORITATIVE_CONTEXT_FALSE_CLAIM');
  check(contract.runtime_context_slot.shadow_online_default_forbidden === true, 'PFE14_S3_SHADOW_DEFAULT_ALLOWED');
  check(contract.single_nonclaim_area.duplicate_banner_forbidden === true, 'PFE14_S3_DUPLICATE_BANNER_ALLOWED');
  check(contract.style_rules.customer_shell_class_dependency_removed === true, 'PFE14_S3_CUSTOMER_CLASS_DEPENDENCY_ALLOWED');
  same(contract.style_rules.font_weights_allowed, [400, 500, 600], 'PFE14_S3_FONT_WEIGHT_CONTRACT_DRIFT');

  check(layout.includes('ProductTechnicalDisclosure'), 'PFE14_S3_TECHNICAL_DISCLOSURE_MISSING');
  check(layout.includes('runtimeContext?: OperatorRuntimeContextDescriptor'), 'PFE14_S3_DYNAMIC_CONTEXT_PROP_MISSING');
  check(layout.includes('runtimeContext = DEFAULT_RUNTIME_CONTEXT'), 'PFE14_S3_GOVERNED_DEFAULT_CONTEXT_MISSING');
  check(layout.includes('data-runtime-context-source={runtimeContext.source}'), 'PFE14_S3_CONTEXT_SOURCE_ATTRIBUTE_MISSING');
  check(layout.includes('data-surface="operator"'), 'PFE14_S3_OPERATOR_SURFACE_ATTRIBUTE_MISSING');
  check(layout.includes('className="operatorShell operatorRuntimeVisualRoot"'), 'PFE14_S3_VISUAL_ROOT_MISSING');
  check(layout.includes('key: "overview"') && layout.includes('key: "fields"'), 'PFE14_S3_PRIMARY_NAV_MISSING');
  for (const forbiddenKey of ['key: "evidence"', 'key: "forecast"', 'key: "calibration"', 'key: "health"', 'key: "settings"', 'key: "pilot"']) {
    check(!layout.includes(forbiddenKey), `PFE14_S3_INVALID_NAV_PRESENT:${forbiddenKey}`);
  }
  for (const forbiddenSource of ['OperatorPilotPage', 'coming-soon', 'customerShellNavItem', 'customerShellSidebar', 'operatorRuntimeModeBanner']) {
    check(!layout.includes(forbiddenSource), `PFE14_S3_LEGACY_SHELL_SOURCE_PRESENT:${forbiddenSource}`);
  }
  check(!layout.includes('SHADOW_ONLINE'), 'PFE14_S3_SHADOW_ONLINE_HARDCODED');
  check(!layout.includes('authoritative-read-model"\n  ?'), 'PFE14_S3_CONTEXT_INFERENCE_PATTERN');
  check(layout.includes('source: "governed-static-nonclaim"'), 'PFE14_S3_STATIC_SOURCE_MISSING');
  check(layout.includes('mode: RUNTIME_CONTEXT_COPY.replayMode'), 'PFE14_S3_REPLAY_DEFAULT_MISSING');

  const baseApp = git('show', `${baseSha}:${APP}`);
  same(read(APP), baseApp, 'PFE14_S3_ROUTE_SOURCE_CHANGED');

  for (const selector of [
    '.operatorShell.operatorRuntimeVisualRoot', '.operatorShell__sidebar', '.operatorShell__navItem',
    '.operatorShell__topbar', '.operatorShell__runtimeContext', '.operatorShell__content'
  ]) {
    check(css.includes(selector), `PFE14_S3_CSS_SELECTOR_MISSING:${selector}`);
  }
  for (const token of [
    '--operator-runtime-page-background', '--operator-runtime-panel-background', '--operator-runtime-text-primary',
    '--operator-runtime-text-secondary', '--operator-runtime-separator', '--operator-runtime-accent',
    '--operator-runtime-radius-control', '--operator-runtime-radius-card', '--operator-runtime-radius-container',
    '--operator-runtime-shadow-panel', '--operator-runtime-motion-fast'
  ]) {
    check(css.includes(token), `PFE14_S3_S2_TOKEN_NOT_USED:${token}`);
  }
  check(css.includes('@media (max-width: 820px)'), 'PFE14_S3_RESPONSIVE_STACK_MISSING');
  check(css.includes(':focus-visible'), 'PFE14_S3_FOCUS_VISIBLE_MISSING');
  check(css.includes('@media (prefers-reduced-motion: reduce)'), 'PFE14_S3_REDUCED_MOTION_MISSING');
  check(!/font-weight:\s*(700|750|800|850|900)\b/.test(css), 'PFE14_S3_FORBIDDEN_FONT_WEIGHT');
  check(!/font:\s*(700|750|800|850|900)\b/.test(css), 'PFE14_S3_FORBIDDEN_FONT_SHORTHAND_WEIGHT');
  check(!/#132016|#f6f7f4|0 16px 48px|0 12px 36px/i.test(css), 'PFE14_S3_LEGACY_HEAVY_VISUAL_TOKEN');

  check(boundary.delta_assertions.operator_layout_delta === 1, 'PFE14_S3_LAYOUT_DELTA_MISMATCH');
  check(boundary.delta_assertions.operator_shell_css_file_count === 1, 'PFE14_S3_CSS_COUNT_MISMATCH');
  check(boundary.delta_assertions.valid_primary_nav_count === 2, 'PFE14_S3_NAV_COUNT_MISMATCH');
  check(boundary.delta_assertions.disabled_nav_placeholder_count === 0, 'PFE14_S3_DISABLED_NAV_DELTA');
  check(boundary.delta_assertions.pilot_layout_injection_count === 0, 'PFE14_S3_PILOT_INJECTION_DELTA');
  for (const key of [
    'page_source_delta', 'route_source_delta', 'api_client_delta', 'backend_source_delta',
    'database_delta', 'package_delta', 'workflow_delta', 'runtime_claim_delta', 'controlled_action_delta'
  ]) {
    check(boundary.delta_assertions[key] === 0, `PFE14_S3_NONZERO_FORBIDDEN_DELTA:${key}`);
  }
  check(boundary.authoritative_runtime_context_enabled === false, 'PFE14_S3_AUTHORITATIVE_CONTEXT_ENABLED');
  check(boundary.default_runtime_context === 'GOVERNED_STATIC_REPLAY_NONCLAIM', 'PFE14_S3_DEFAULT_CONTEXT_DRIFT');
  check(boundary.candidate_declaration === false, 'PFE14_S3_CANDIDATE_DECLARATION');
  check(boundary.runtime_implementation_authority === false, 'PFE14_S3_RUNTIME_AUTHORITY');
  check(boundary.shadow_online_product_claim === false, 'PFE14_S3_SHADOW_PRODUCT_CLAIM');

  const result = {
    status: 'PASS',
    change_class: boundary.change_class,
    base_main_sha: baseSha,
    head_sha: git('rev-parse', 'HEAD'),
    changed_file_count: changedFiles.length,
    changed_files: sorted(changedFiles),
    primary_navigation: contract.valid_primary_navigation.map((item) => item.route),
    removed_navigation_slot_count: contract.removed_navigation_slots.length,
    runtime_context_default_source: contract.runtime_context_slot.default_source,
    authoritative_runtime_context_enabled: false,
    page_source_delta: 0,
    route_source_delta: 0,
    api_client_delta: 0,
    runtime_claim_delta: 0,
    completion_claim: boundary.completion_claim_when_accepted,
    next_slice: boundary.next_slice_after_effectiveness
  };
  writeResult(result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  const result = { status: 'FAIL', error: error instanceof Error ? error.message : String(error) };
  writeResult(result);
  process.stderr.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = 1;
}
