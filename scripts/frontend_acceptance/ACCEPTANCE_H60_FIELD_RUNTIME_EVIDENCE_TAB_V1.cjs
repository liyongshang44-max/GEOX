// scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_EVIDENCE_TAB_V1.cjs
// Purpose: statically verify H60-E Field Runtime Evidence tab migration without running frontend code or touching backend state.
// Boundary: this script reads repository files and git diff metadata only.

'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();

const FILES = {
  app: 'apps/web/src/app/App.tsx',
  routeModule: 'apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx',
  legacyEvidencePage: 'apps/web/src/features/operator/pages/OperatorFieldTwinEvidencePage.tsx',
  evidenceAdapter: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeEvidenceAdapter.ts',
  evidenceTabPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceTabPanel.tsx',
  evidenceTracePanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceTracePanel.tsx',
  evidenceCoveragePanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceCoveragePanel.tsx',
  evidenceQualityPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceQualityPanel.tsx',
  sourceIndexPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeSourceIndexPanel.tsx',
  evidenceGapPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceGapPanel.tsx',
  evidenceBoundaryPanel: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeEvidenceBoundaryPanel.tsx',
  routePage: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeRoutePage.tsx',
  layout: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx',
  viewModel: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts',
  css: 'apps/web/src/styles/operatorFieldRuntime.css',
  doc: 'docs/frontend-productization/H60-FIELD-RUNTIME-EVIDENCE-TAB.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H60_FIELD_RUNTIME_EVIDENCE_TAB_V1.cjs',
};

const H60E_ALLOWED_CHANGED_FILE_PATTERNS = [
  /^apps\/web\/src\/features\/operator\/fieldRuntime\/.+$/,
  /^apps\/web\/src\/features\/operator\/pages\/OperatorFieldTwinEvidencePage\.tsx$/,
  /^apps\/web\/src\/styles\/operatorFieldRuntime\.css$/,
  /^docs\/frontend-productization\/H60-FIELD-RUNTIME-EVIDENCE-TAB\.md$/,
  /^scripts\/frontend_acceptance\/ACCEPTANCE_H60_FIELD_RUNTIME_EVIDENCE_TAB_V1\.cjs$/,
];

const FORBIDDEN_CHANGED_FILE_PATTERNS = [
  /^apps\/web\/src\/app\/App\.tsx$/,
  /^apps\/web\/src\/app\/routes\/operatorFieldRuntimeRoutes\.tsx$/,
  /^apps\/server\//,
  /^migrations\//,
  /^packages\/contracts\//,
  /^fixtures\//,
  /^\.github\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
];

const CANONICAL_EVIDENCE_FILES = [
  FILES.evidenceAdapter,
  FILES.evidenceTabPanel,
  FILES.evidenceTracePanel,
  FILES.evidenceCoveragePanel,
  FILES.evidenceQualityPanel,
  FILES.sourceIndexPanel,
  FILES.evidenceGapPanel,
  FILES.evidenceBoundaryPanel,
  FILES.routePage,
  FILES.layout,
  FILES.viewModel,
];

const PANEL_FILES = [
  FILES.evidenceTabPanel,
  FILES.evidenceTracePanel,
  FILES.evidenceCoveragePanel,
  FILES.evidenceQualityPanel,
  FILES.sourceIndexPanel,
  FILES.evidenceGapPanel,
  FILES.evidenceBoundaryPanel,
];

const assertions = [];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function assert(name, condition, details = {}) {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  if (!passed) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[h60-field-runtime-evidence-tab] ok:', name);
}

function normalizeForTokenScan(value) {
  return value
    .replace(/[\uFEFF]/g, '')
    .replace(/[`'"“”‘’]/g, '')
    .replace(/[，。；、：:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAll(content, tokens) {
  const normalizedContent = normalizeForTokenScan(content);
  return tokens.every((token) => normalizedContent.includes(normalizeForTokenScan(token)));
}

function lacksAll(content, tokens) {
  const normalizedContent = normalizeForTokenScan(content);
  return tokens.every((token) => !normalizedContent.includes(normalizeForTokenScan(token)));
}

function extractFunctionBlock(content, functionName) {
  const marker = `function ${functionName}`;
  const markerIndex = content.indexOf(marker);
  if (markerIndex < 0) return '';
  const firstBraceIndex = content.indexOf('{', markerIndex);
  if (firstBraceIndex < 0) return '';
  let depth = 0;
  for (let index = firstBraceIndex; index < content.length; index += 1) {
    if (content[index] === '{') depth += 1;
    if (content[index] === '}') depth -= 1;
    if (depth === 0) return content.slice(markerIndex, index + 1);
  }
  return '';
}

function getChangedFiles() {
  const commands = [
    ['git', ['diff', '--name-only', 'origin/main...HEAD']],
    ['git', ['diff', '--name-only', 'main...HEAD']],
  ];
  for (const [command, args] of commands) {
    try {
      const output = childProcess.execFileSync(command, args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return output.split(/\r?\n/g).map((line) => line.trim()).filter(Boolean);
    } catch (_error) {
      // Try the next read-only diff command.
    }
  }
  return [];
}

function matchesAny(filePath, patterns) {
  return patterns.some((pattern) => pattern.test(filePath));
}

function main() {
  for (const [key, relativePath] of Object.entries(FILES)) {
    assert(key + '_exists', exists(relativePath), { file: relativePath });
  }

  const changedFiles = getChangedFiles();
  assert('h60e_changed_files_within_allowlist_when_diff_context_exists', changedFiles.length === 0 || changedFiles.every((filePath) => matchesAny(filePath, H60E_ALLOWED_CHANGED_FILE_PATTERNS)), {
    changed_files: changedFiles,
    allowed_patterns: H60E_ALLOWED_CHANGED_FILE_PATTERNS.map((pattern) => String(pattern)),
  });
  assert('h60e_forbidden_files_not_changed', changedFiles.every((filePath) => !matchesAny(filePath, FORBIDDEN_CHANGED_FILE_PATTERNS)), {
    changed_files: changedFiles,
    forbidden_patterns: FORBIDDEN_CHANGED_FILE_PATTERNS.map((pattern) => String(pattern)),
  });

  const app = read(FILES.app);
  const routeModule = read(FILES.routeModule);
  const legacyEvidencePage = read(FILES.legacyEvidencePage);
  const evidenceAdapter = read(FILES.evidenceAdapter);
  const routePage = read(FILES.routePage);
  const layout = read(FILES.layout);
  const viewModel = read(FILES.viewModel);
  const css = read(FILES.css);
  const doc = read(FILES.doc);
  const operatorRoutesBlock = extractFunctionBlock(app, 'OperatorRoutes');
  const canonicalBundle = CANONICAL_EVIDENCE_FILES.map(read).join('\n');
  const panelBundle = PANEL_FILES.map(read).join('\n');

  assert('route_topology_preserved_for_canonical_and_legacy_evidence', containsAll(routeModule, [
    'tab="evidence"',
    'FieldRuntimeRoutePage',
  ]) && containsAll(operatorRoutesBlock, [
    'path="fields/*" element={<OperatorFieldRuntimeRoutes />} />',
    'path="twin/fields/:fieldId/evidence" element={<OperatorFieldTwinEvidencePage />}',
  ]) && lacksAll(app + '\n' + routeModule, [
    'path="/app/operator/*"',
    'to="/operator/fields/:fieldId/evidence"',
    'replace to="/operator/fields',
  ]), { files: [FILES.app, FILES.routeModule] });

  assert('legacy_evidence_page_remains_available', containsAll(legacyEvidencePage, [
    'export default function OperatorFieldTwinEvidencePage',
    'fetchOperatorFieldTwinEvidenceQuality',
    'data-page="operator-field-twin-evidence-quality"',
    'operator_field_twin_evidence_quality_v1',
  ]), { file: FILES.legacyEvidencePage });

  assert('evidence_adapter_reuses_existing_read_only_fetch', containsAll(evidenceAdapter, [
    'fetchOperatorFieldTwinEvidenceQuality',
    'operator_field_twin_evidence_quality_v1',
    'FieldRuntimeEvidenceLoadState',
    'FieldRuntimeEvidenceViewModel',
    'loadFieldRuntimeEvidence',
    'mapFieldRuntimeEvidence',
    'gapStatus',
  ]) && lacksAll(evidenceAdapter, [
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    '/api/control',
    '/api/control/ao_act',
    'new endpoint',
    'server route',
  ]), { file: FILES.evidenceAdapter });

  assert('route_page_loads_only_expected_read_models', containsAll(routePage, [
    'overview" || tab === "state"',
    'loadFieldRuntimeWorkspaceOverview',
    'tab === "evidence"',
    'loadFieldRuntimeEvidence',
    'evidenceLoadState',
    'FieldRuntimeLayout',
  ]), { file: FILES.routePage });

  assert('layout_composes_evidence_tab_inside_h60c_shell', containsAll(layout, [
    'FieldRuntimeEvidenceTabPanel',
    'viewModel.routeKey === "evidence"',
    'evidenceLoadState',
    'FieldRuntimeTabs',
    'FieldRuntimeBoundaryBanner',
    'data-h60e="field-runtime-evidence-tab"',
  ]), { file: FILES.layout });

  assert('view_model_marks_evidence_available_and_preserves_future_tabs', containsAll(viewModel, [
    'key: "evidence"',
    'status: "available"',
    'H60-E evidence quality tab',
    'Evidence content is derived from the existing read-only Operator Field Twin evidence quality read model.',
    'Full Evidence trace is displayed for review only.',
    'No facts are written.',
    'No recommendation is created.',
    'No approval / dispatch / AO-ACT task is created.',
    'Forecast route is reserved for H60-F.',
    'Scenario route is reserved for H60-G.',
    'Residual route is reserved for H60-H.',
    'Calibration route is reserved for H60-I.',
    'Health route is reserved for H62.',
    'not_enabled',
    'planned for H62',
    'Audit route is reserved for H60-K.',
  ]), { file: FILES.viewModel });

  assert('evidence_panels_contain_required_product_copy', containsAll(panelBundle, [
    'Evidence',
    'Evidence Trace',
    'Data Coverage',
    'Quality Summary',
    'Source Index',
    'Evidence Gaps',
    'Evidence Boundary',
    'Evidence content is derived from the existing read-only Operator Field Twin evidence quality read model.',
    'source: operator_field_twin_evidence_quality_v1',
    'Full Evidence trace is displayed for review only.',
    'No facts are written.',
    'No recommendation is created.',
    'No approval / dispatch / AO-ACT task is created.',
    'Evidence Gap Status',
    'Evidence quality status is not agronomic risk',
    'Evidence gaps do not trigger observation requests',
    'No facts write',
    'No recommendation creation',
    'No approval',
    'No dispatch',
    'No AO-ACT task',
    'No ROI write',
    'No Field Memory write',
    'No evidence mutation',
    'No backend contract change',
  ]), { files: PANEL_FILES });

  assert('canonical_evidence_bundle_has_no_write_or_mutation_tokens', lacksAll(canonicalBundle, [
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'writeFact',
    'createFact',
    'submitRecommendation',
    'SubmitScenarioToRecommendationPanel',
    'approvalClient',
    'dispatchClient',
    'createAoActTask',
    'roiWriter',
    'fieldMemoryWriter',
    'modelUpdate',
  ]), { files: CANONICAL_EVIDENCE_FILES });

  assert('canonical_evidence_titles_avoid_legacy_product_language', lacksAll(panelBundle, [
    'Operator Twin Evidence Quality',
    'H25 Evidence Page',
    'raw evidence contract',
    'Twin 工作区',
  ]), { files: PANEL_FILES });

  assert('css_defines_h60e_evidence_classes_and_avoids_risk_priority_language', containsAll(css, [
    '.operatorFieldRuntime__evidenceGrid',
    '.operatorFieldRuntime__evidenceTrace',
    '.operatorFieldRuntime__evidenceTraceItem',
    '.operatorFieldRuntime__coverageTable',
    '.operatorFieldRuntime__sourceIndexTable',
    '.operatorFieldRuntime__qualitySummary',
    '.operatorFieldRuntime__qualityBadge',
    '.operatorFieldRuntime__evidenceRefs',
    '.operatorFieldRuntime__evidenceGapList',
    '.operatorFieldRuntime__evidenceBoundary',
  ]) && lacksAll(css, [
    'risk-red',
    'danger',
    'warning',
    'success',
    'green',
    'yellow',
    'red',
    'priority',
    'severity',
  ]), { file: FILES.css });

  assert('h60e_doc_records_scope_boundaries_and_next_phases', containsAll(doc, [
    'H60-E migrates Evidence tab only',
    '/operator/fields/:fieldId/evidence',
    '/operator/twin/fields/:fieldId/evidence',
    'source: operator_field_twin_evidence_quality_v1',
    'fetchOperatorFieldTwinEvidenceQuality',
    'H60-E does not create backend contract',
    'H60-E does not write facts',
    'H60-E does not create recommendation',
    'H60-E does not approve / dispatch / create AO-ACT',
    'H60-E does not write ROI / Field Memory',
    'Forecast remains H60-F',
    'Scenario split remains H60-G',
    'Residual remains H60-H',
    'Calibration remains H60-I',
    'Health remains not_enabled / planned for H62',
    'Audit remains H60-K',
    'Evidence quality status is not agronomic risk.',
    'Evidence gaps do not trigger observation requests.',
    'Source index tables are audit/detail metadata, not primary product titles.',
  ]), { file: FILES.doc });

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_EVIDENCE_TAB_V1',
    scope: 'static H60-E evidence tab migration only',
    changed_files_checked: changedFiles,
    allowed_changed_file_patterns: H60E_ALLOWED_CHANGED_FILE_PATTERNS.map((pattern) => String(pattern)),
    files_checked: FILES,
    assertions,
    next_step: 'H60-F_FORECAST_TAB',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_H60_FIELD_RUNTIME_EVIDENCE_TAB_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
