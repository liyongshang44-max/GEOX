'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = process.cwd();
const CURRENT = 'docs/frontend-productization/PFE-14-CURRENT-AUTHORITY.json';
const CONTRACT = 'docs/frontend-productization/PFE-14-S2-APPLE-VISUAL-CONTRACT.json';
const BOUNDARY = 'docs/frontend-productization/PFE-14-S2-CHANGED-FILE-BOUNDARY.json';
const READ_CONTRACT = 'docs/frontend-productization/PFE-14-S1-FRONTEND-READ-CONTRACT.json';
const COPY_CONTRACT = 'docs/frontend-productization/PFE-14-S1-COPY-NONCLAIM-CONTRACT.json';
const SEGMENTED = 'apps/web/src/design-system/product/ProductSegmentedControl.tsx';
const DISCLOSURE = 'apps/web/src/design-system/product/ProductTechnicalDisclosure.tsx';
const INDEX = 'apps/web/src/design-system/product/index.ts';
const STYLES_ENTRY = 'apps/web/src/styles.css';
const VISUAL_CSS = 'apps/web/src/styles/operatorRuntimeVisualSystem.css';
const OUTPUT = path.join(ROOT, 'acceptance-output/PFE_14_S2_APPLE_VISUAL_FOUNDATION_RESULT.json');

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

function normalize(value) {
  return value.replace(/\r\n/g, '\n').trimEnd();
}

function main() {
  const current = json(CURRENT);
  const contract = json(CONTRACT);
  const boundary = json(BOUNDARY);
  const readContract = json(READ_CONTRACT);
  const copyContract = json(COPY_CONTRACT);
  const segmented = read(SEGMENTED);
  const disclosure = read(DISCLOSURE);
  const indexSource = read(INDEX);
  const stylesEntry = read(STYLES_ENTRY);
  const visualCss = read(VISUAL_CSS);

  const baseSha = process.env.PFE14_BASE_SHA || boundary.base_main_sha;
  check(/^[0-9a-f]{40}$/.test(baseSha), 'PFE14_S2_BASE_SHA_INVALID');
  git('cat-file', '-e', `${baseSha}^{commit}`);
  check(boundary.predecessor_merge_sha === baseSha, 'PFE14_S2_PREDECESSOR_BINDING_MISMATCH');

  const changedFiles = git('diff', '--name-only', `${baseSha}...HEAD`).split(/\r?\n/).filter(Boolean);
  same(sorted(changedFiles), sorted(boundary.expected_changed_files), 'PFE14_S2_CHANGED_FILES_MISMATCH');
  check(changedFiles.length === boundary.expected_changed_file_count, 'PFE14_S2_CHANGED_FILE_COUNT_MISMATCH');
  same(sorted(changedFiles), sorted(boundary.allowed_exact_files), 'PFE14_S2_ALLOWLIST_MISMATCH');
  for (const file of changedFiles) {
    check(!boundary.forbidden_prefixes.some((prefix) => file.startsWith(prefix)), `PFE14_S2_FORBIDDEN_PREFIX:${file}`);
    check(!boundary.forbidden_exact_files.includes(file), `PFE14_S2_FORBIDDEN_FILE:${file}`);
  }

  check(current.slice_id === 'PFE-14.S2', 'PFE14_S2_CURRENT_SLICE_MISMATCH');
  check(current.status === 'S2_APPLE_VISUAL_FOUNDATION_IN_PROGRESS', 'PFE14_S2_CURRENT_STATUS_MISMATCH');
  check(current.base_main_sha === baseSha, 'PFE14_S2_CURRENT_BASE_MISMATCH');
  check(current.s1_merge_sha === baseSha && current.s1_effective === true, 'PFE14_S2_S1_PREDECESSOR_NOT_EFFECTIVE');
  for (const key of ['visual_token_design_authorized', 'product_primitive_source_authorized', 'operator_scoped_css_authorized', 'global_style_import_authorized']) {
    check(current[key] === true, `PFE14_S2_VISUAL_AUTHORITY_MISSING:${key}`);
  }
  for (const key of [
    'page_source_authorized', 'layout_source_authorized', 'route_source_authorized', 'api_client_source_authorized',
    'backend_source_authorized', 'database_delta_authorized', 'package_delta_authorized', 'workflow_delta_authorized',
    'runtime_claim_authorized', 'shadow_online_label_authorized', 'scheduler_ui_authorized',
    'evidence_freshness_ui_authorized', 'backfill_ui_authorized', 'recovery_ui_authorized',
    'controlled_action_authorized', 'ao_act_authorized', 'dispatch_authorized', 'model_activation_authorized',
    'production_launch_authorized', 'commercial_launch_authorized', 'candidate_declaration_authorized', 's2_effective'
  ]) {
    check(current[key] === false, `PFE14_S2_AUTHORITY_MUST_REMAIN_FALSE:${key}`);
  }

  check(readContract.record_status === 'DESIGN_FROZEN_NOT_IMPLEMENTED', 'PFE14_S2_READ_CONTRACT_DRIFT');
  check(copyContract.record_status === 'DESIGN_FROZEN_NOT_IMPLEMENTED', 'PFE14_S2_COPY_CONTRACT_DRIFT');
  check(contract.record_status === 'VISUAL_FOUNDATION_FROZEN_NOT_APPLIED_TO_PAGES', 'PFE14_S2_CONTRACT_STATUS_MISMATCH');
  check(contract.base_main_sha === baseSha, 'PFE14_S2_CONTRACT_BASE_MISMATCH');
  same(contract.principles, ['CLARITY', 'DEFERENCE', 'DEPTH', 'CONTINUITY'], 'PFE14_S2_PRINCIPLES_MISMATCH');
  same(contract.tokens.font_weights_allowed, [400, 500, 600], 'PFE14_S2_ALLOWED_WEIGHT_MISMATCH');
  same(contract.tokens.font_weights_forbidden, [700, 750, 800, 850, 900], 'PFE14_S2_FORBIDDEN_WEIGHT_MISMATCH');
  check(contract.tokens.page_background === '#F5F5F7', 'PFE14_S2_PAGE_BACKGROUND_MISMATCH');
  check(contract.tokens.text_primary === '#1D1D1F', 'PFE14_S2_TEXT_PRIMARY_MISMATCH');
  check(contract.tokens.radius_container === '20px', 'PFE14_S2_RADIUS_MISMATCH');
  check(contract.tokens.shadow_panel === '0 1px 2px rgba(0, 0, 0, 0.04)', 'PFE14_S2_PANEL_SHADOW_MISMATCH');
  check(contract.motion_rules.prefers_reduced_motion_required === true, 'PFE14_S2_REDUCED_MOTION_NOT_REQUIRED');
  check(contract.brand_boundary.apple_brand_claim === false, 'PFE14_S2_APPLE_BRAND_CLAIM');
  check(contract.brand_boundary.apple_trademark_assets === false, 'PFE14_S2_APPLE_ASSET_CLAIM');
  check(contract.brand_boundary.bundled_apple_fonts === false, 'PFE14_S2_APPLE_FONT_BUNDLE');
  check(contract.implementation_boundary.operator_page_migration === false, 'PFE14_S2_PAGE_MIGRATION_CLAIM');
  check(contract.implementation_boundary.operator_layout_migration === false, 'PFE14_S2_LAYOUT_MIGRATION_CLAIM');
  check(contract.implementation_boundary.runtime_claim_change === false, 'PFE14_S2_RUNTIME_CLAIM_CHANGE');

  check(segmented.includes('role="group"'), 'PFE14_S2_SEGMENTED_GROUP_SEMANTICS_MISSING');
  check(segmented.includes('aria-current={item.active ? "page" : undefined}'), 'PFE14_S2_SEGMENTED_CURRENT_STATE_MISSING');
  check(segmented.includes('aria-pressed={Boolean(item.active)}'), 'PFE14_S2_SEGMENTED_PRESSED_STATE_MISSING');
  check(segmented.includes('disabled={item.disabled}'), 'PFE14_S2_SEGMENTED_DISABLED_STATE_MISSING');
  check(!/SHADOW_ONLINE|recommendation|dispatch|AO-ACT/i.test(segmented), 'PFE14_S2_SEGMENTED_BUSINESS_SEMANTICS');

  check(disclosure.includes('<details'), 'PFE14_S2_DISCLOSURE_DETAILS_MISSING');
  check(disclosure.includes('<summary'), 'PFE14_S2_DISCLOSURE_SUMMARY_MISSING');
  check(disclosure.includes('defaultOpen = false'), 'PFE14_S2_DISCLOSURE_DEFAULT_OPEN_DRIFT');
  check(disclosure.includes('data-monospace'), 'PFE14_S2_DISCLOSURE_MONOSPACE_SUPPORT_MISSING');
  check(!/SHADOW_ONLINE|recommendation|dispatch|AO-ACT/i.test(disclosure), 'PFE14_S2_DISCLOSURE_BUSINESS_SEMANTICS');

  for (const exportLine of [
    'export { ProductSegmentedControl } from "./ProductSegmentedControl";',
    'export type { ProductSegmentedControlItem, ProductSegmentedControlProps } from "./ProductSegmentedControl";',
    'export { ProductTechnicalDisclosure } from "./ProductTechnicalDisclosure";',
    'export type { ProductTechnicalDisclosureItem, ProductTechnicalDisclosureProps } from "./ProductTechnicalDisclosure";'
  ]) {
    check(indexSource.includes(exportLine), `PFE14_S2_INDEX_EXPORT_MISSING:${exportLine}`);
  }
  const baseIndex = git('show', `${baseSha}:${INDEX}`);
  const indexWithoutS2 = indexSource
    .split(/\r?\n/)
    .filter((line) => !line.includes('ProductSegmentedControl') && !line.includes('ProductTechnicalDisclosure'))
    .join('\n');
  same(normalize(indexWithoutS2), normalize(baseIndex), 'PFE14_S2_INDEX_UNRELATED_DELTA');

  const importLine = '@import "./styles/operatorRuntimeVisualSystem.css";';
  check(stylesEntry.split(importLine).length === 2, 'PFE14_S2_VISUAL_IMPORT_COUNT_MISMATCH');
  const baseStyles = git('show', `${baseSha}:${STYLES_ENTRY}`);
  const stylesWithoutS2 = stylesEntry.split(/\r?\n/).filter((line) => line !== importLine).join('\n');
  same(normalize(stylesWithoutS2), normalize(baseStyles), 'PFE14_S2_STYLES_ENTRY_UNRELATED_DELTA');

  for (const token of [
    '--operator-runtime-font-family', '--operator-runtime-page-background', '--operator-runtime-panel-background',
    '--operator-runtime-text-primary', '--operator-runtime-text-secondary', '--operator-runtime-separator',
    '--operator-runtime-accent', '--operator-runtime-focus-ring', '--operator-runtime-radius-control',
    '--operator-runtime-radius-card', '--operator-runtime-radius-container', '--operator-runtime-shadow-panel',
    '--operator-runtime-shadow-elevated', '--operator-runtime-motion-fast', '--operator-runtime-motion-normal'
  ]) {
    check(visualCss.includes(token), `PFE14_S2_CSS_TOKEN_MISSING:${token}`);
  }
  for (const selector of ['.operatorProductSurface', '.operatorRuntimeVisualRoot', '[data-surface="operator"]']) {
    check(visualCss.includes(selector), `PFE14_S2_SCOPE_SELECTOR_MISSING:${selector}`);
  }
  check(visualCss.includes('@media (prefers-reduced-motion: reduce)'), 'PFE14_S2_REDUCED_MOTION_CSS_MISSING');
  check(visualCss.includes(':focus-visible'), 'PFE14_S2_FOCUS_VISIBLE_MISSING');
  check(visualCss.includes('min-height: 36px'), 'PFE14_S2_MINIMUM_TARGET_MISSING');
  check(!/font-weight:\s*(700|750|800|850|900)\b/.test(visualCss), 'PFE14_S2_FORBIDDEN_FONT_WEIGHT');
  check(!/font:\s*(700|750|800|850|900)\b/.test(visualCss), 'PFE14_S2_FORBIDDEN_FONT_SHORTHAND_WEIGHT');
  check(!/continuous|pulse|flash|blink/i.test(visualCss), 'PFE14_S2_FORBIDDEN_MOTION_STYLE');

  check(boundary.delta_assertions.new_product_primitive_count === 2, 'PFE14_S2_PRIMITIVE_COUNT_DRIFT');
  check(boundary.delta_assertions.operator_visual_stylesheet_count === 1, 'PFE14_S2_STYLESHEET_COUNT_DRIFT');
  check(boundary.delta_assertions.global_style_import_delta === 1, 'PFE14_S2_IMPORT_DELTA_DRIFT');
  for (const key of [
    'page_source_delta', 'layout_source_delta', 'route_source_delta', 'api_client_delta', 'backend_source_delta',
    'database_delta', 'package_delta', 'workflow_delta', 'runtime_claim_delta', 'controlled_action_delta'
  ]) {
    check(boundary.delta_assertions[key] === 0, `PFE14_S2_NONZERO_FORBIDDEN_DELTA:${key}`);
  }
  check(boundary.page_migration === false, 'PFE14_S2_PAGE_MIGRATION');
  check(boundary.layout_migration === false, 'PFE14_S2_LAYOUT_MIGRATION');
  check(boundary.candidate_declaration === false, 'PFE14_S2_CANDIDATE_DECLARATION');
  check(boundary.runtime_implementation_authority === false, 'PFE14_S2_RUNTIME_AUTHORITY');
  check(boundary.shadow_online_product_claim === false, 'PFE14_S2_SHADOW_PRODUCT_CLAIM');

  const result = {
    status: 'PASS',
    change_class: boundary.change_class,
    base_main_sha: baseSha,
    head_sha: git('rev-parse', 'HEAD'),
    changed_file_count: changedFiles.length,
    changed_files: sorted(changedFiles),
    product_primitive_count: 2,
    operator_visual_stylesheet_count: 1,
    global_style_import_delta: 1,
    allowed_font_weights: contract.tokens.font_weights_allowed,
    page_source_delta: 0,
    layout_source_delta: 0,
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
