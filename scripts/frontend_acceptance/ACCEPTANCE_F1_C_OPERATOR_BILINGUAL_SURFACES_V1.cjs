// scripts/frontend_acceptance/ACCEPTANCE_F1_C_OPERATOR_BILINGUAL_SURFACES_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const F1B_ACCEPTED_HEAD = '9f929ed34beb95d9603b30bdc84fbfc30f6b97cd';

const files = {
  overview: 'apps/web/src/features/operator/pages/OperatorTwinOverviewPage.tsx',
  gatewayWrapper: 'apps/web/src/features/operator/pages/OperatorGatewayDemoViewerPage.tsx',
  fieldLayout: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeLayout.tsx',
  fieldTabs: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeTabs.tsx',
  fieldBoundary: 'apps/web/src/features/operator/fieldRuntime/FieldRuntimeBoundaryBanner.tsx',
  replayPage: 'apps/web/src/features/operator/replayDemo/ReplayDemoPage.tsx',
  replayHero: 'apps/web/src/features/operator/replayDemo/ReplayDemoHero.tsx',
  replayBoundary: 'apps/web/src/features/operator/replayDemo/ReplayDemoBoundaryBanner.tsx',
  replaySnapshot: 'apps/web/src/features/operator/replayDemo/ReplayDemoSnapshotPanel.tsx',
  replayGatewayPath: 'apps/web/src/features/operator/replayDemo/ReplayDemoGatewayPathPanel.tsx',
  replayDeviceEvidence: 'apps/web/src/features/operator/replayDemo/ReplayDemoDeviceEvidencePanel.tsx',
  replayStandards: 'apps/web/src/features/operator/replayDemo/ReplayDemoStandardsPanel.tsx',
  replayTraceability: 'apps/web/src/features/operator/replayDemo/ReplayDemoTraceabilityPanel.tsx',
  pilotPage: 'apps/web/src/features/operator/pilotReadiness/OperatorPilotPage.tsx',
  pilotCss: 'apps/web/src/styles/operatorPilotReadiness.css',
  labels: 'apps/web/src/lib/productSurfaceLabels.ts',
  doc: 'docs/frontend-productization/F1-C-OPERATOR-BILINGUAL-SURFACES.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_F1_C_OPERATOR_BILINGUAL_SURFACES_V1.cjs',
};

const allowedExactFiles = new Set([
  files.overview,
  files.gatewayWrapper,
  files.pilotCss,
  files.labels,
  files.doc,
  files.acceptance,
]);

const allowedPrefixes = [
  'apps/web/src/features/operator/fieldRuntime/',
  'apps/web/src/features/operator/replayDemo/',
  'apps/web/src/features/operator/pilotReadiness/',
];

const blockedExactFiles = new Set([
  'apps/web/src/app/App.tsx',
  'apps/web/src/layouts/CustomerLayout.tsx',
  'apps/web/src/layouts/AdminLayout.tsx',
  'apps/web/src/layouts/OperatorLayout.tsx',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
]);

const blockedPrefixes = [
  'apps/web/src/app/routes/',
  'apps/web/src/features/customer/',
  'apps/web/src/features/admin/',
  'apps/web/src/views/',
  'apps/server/',
  'migrations/',
  'packages/contracts/',
  'fixtures/',
  '.github/',
];

const mojibakePatterns = ['鎬', '鍦', '浣', '璁', '杩', '閰', '绠', '瀵', '艰', '鍚', '彴', '潡', '惧', '悍', '嵁', '�'];
const cssForbidden = ['live-online', 'production-online', 'dispatch-enabled', 'ao-act-ready', 'roi-ready', 'field-memory-ready', 'risk-red', 'success-green', 'warning-yellow'];
const positiveClaimForbidden = ['Live Device: Connected', 'Production Gateway: Online', 'Production Gateway: Ready', 'Field Pilot: Started', 'Field Pilot: Active', 'Controlled Execution: Enabled', 'AO-ACT Dispatch: Enabled', 'live monitoring active', 'field pilot execution active', 'ROI computed', 'Field Memory learned', '实时设备：已连接', '生产网关：在线', '生产网关：已上线', '田间试点：已开始', '田间试点：进行中', '受控执行：已启用', 'AO-ACT 派发：已启用', '实时监控已启用', 'ROI 已计算', 'Field Memory 已学习'];
const engineeringPhaseForbidden = ['H58', 'H59', 'H60', 'H61', 'H62', 'H63', 'H64', 'H65', 'H66', 'H67', 'F0', 'F1', 'P51', 'P52', 'P53', 'P54', 'P55', 'P56', 'P57', 'TK', 'fixture', 'acceptance'];

const assertions = [];

function repoPath(file) {
  return path.join(root, file);
}

function exists(file) {
  return fs.existsSync(repoPath(file));
}

function read(file) {
  return fs.readFileSync(repoPath(file), 'utf8');
}

function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[f1-c-operator-bilingual-surfaces] ok:', name);
}

function hasAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function violations(text, tokens) {
  return tokens.filter((token) => text.includes(token));
}

function changedFiles() {
  try {
    return cp.execFileSync('git', ['diff', '--name-only', `${F1B_ACCEPTED_HEAD}...HEAD`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (_error) {
    try {
      return cp.execFileSync('git', ['diff', '--name-only', 'origin/main...HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    } catch (_inner) {
      return [];
    }
  }
}

function isAllowed(file) {
  return allowedExactFiles.has(file) || allowedPrefixes.some((prefix) => file.startsWith(prefix));
}

function isBlocked(file) {
  return blockedExactFiles.has(file) || blockedPrefixes.some((prefix) => file.startsWith(prefix));
}

function stripCommentsAndDataAttributes(text) {
  return text
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/data-[\w-]+="[^"]*"/g, '')
    .replace(/data-[\w-]+='[^']*'/g, '');
}

function visibleProductCopyText() {
  return [
    files.overview,
    files.fieldLayout,
    files.fieldTabs,
    files.fieldBoundary,
    files.replayPage,
    files.replayHero,
    files.replayBoundary,
    files.replaySnapshot,
    files.replayGatewayPath,
    files.replayDeviceEvidence,
    files.replayStandards,
    files.replayTraceability,
    files.pilotPage,
    files.labels,
  ]
    .filter(exists)
    .map((file) => stripCommentsAndDataAttributes(read(file)))
    .join('\n');
}

try {
  [files.doc, files.acceptance, files.fieldLayout, files.replayPage, files.pilotPage, files.gatewayWrapper, files.overview, files.labels]
    .forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const routeTopologyChanged = diff.some((file) => file === 'apps/web/src/app/App.tsx' || file.startsWith('apps/web/src/app/routes/'));
  const customerOrAdminChanged = diff.some((file) => file.startsWith('apps/web/src/features/customer/') || file.startsWith('apps/web/src/features/admin/') || file === 'apps/web/src/layouts/CustomerLayout.tsx' || file === 'apps/web/src/layouts/AdminLayout.tsx');
  const backendChanged = diff.some((file) => file.startsWith('apps/server/') || file.startsWith('migrations/') || file.startsWith('packages/contracts/') || file.startsWith('fixtures/'));
  const packageChanged = diff.some((file) => ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file));

  assert('changed_files_allowlist_from_f1b_base', diff.every(isAllowed), { diff, base: F1B_ACCEPTED_HEAD });
  assert('blocked_files_unchanged_from_f1b_base', diff.every((file) => !isBlocked(file)), { diff, base: F1B_ACCEPTED_HEAD });
  assert('route_topology_unchanged', routeTopologyChanged === false, { diff });
  assert('customer_admin_unchanged', customerOrAdminChanged === false, { diff });
  assert('backend_unchanged', backendChanged === false, { diff });
  assert('package_unchanged', packageChanged === false, { diff });

  const labels = read(files.labels);
  const doc = read(files.doc);
  const productText = visibleProductCopyText();

  assert('operator_copy_registry_present', labels.includes('OPERATOR_FORMAL_SURFACE_COPY'), { file: files.labels });
  assert('operator_pages_use_locale_registry', [files.overview, files.fieldLayout, files.fieldTabs, files.fieldBoundary, files.replayPage, files.replayHero, files.replayBoundary, files.pilotPage].every((file) => hasAll(read(file), ['useLocale', 'localizedText'])), {});

  assert('field_runtime_copy_present', hasAll(productText, ['Field Runtime', 'Fields', 'Overview', 'Evidence', 'State', 'Forecast', 'Scenario', 'Residual', 'Calibration', 'Health', 'Audit', 'Read-only', 'No runtime mutation', 'No external command', 'No model state mutation', 'No value ledger mutation', 'No long-term field record mutation', '地块运行视图', '地块', '总览', '证据', '状态', '预测', '情景', '残差', '校准', '健康', '审计', '只读', '不修改运行状态', '不下发外部命令', '不修改模型状态', '不写入价值台账', '不写入长期地块记录']));
  assert('replay_demo_copy_present', hasAll(productText, ['Replay-backed Gateway Demo', 'Replay-backed Gateway Snapshot', 'Replay-backed demo', 'not a live device connection', 'Production Gateway: Not online', 'Field Pilot: Not started', 'AO-ACT Dispatch: Disabled', 'Snapshot', 'Gateway path', 'Device evidence', 'Standards mapping', 'Traceability', '回放支撑网关演示', '回放支撑网关快照', '回放支撑演示', '不是实时设备连接', '生产网关：未上线', '田间试点：未开始', 'AO-ACT 派发：已禁用', '快照', '网关路径', '设备证据', '标准映射', '可追溯性']));
  assert('pilot_readiness_copy_present', hasAll(productText, ['Pilot Readiness', 'readiness gate', 'planning gate', 'safety', 'stop rules', 'human role', 'rollback', 'not field execution', 'Field Pilot: Not started', 'AO-ACT Dispatch: Disabled', '试点准备度', '准备度门禁', '规划门禁', '安全', '停止规则', '人员角色', '回滚', '不是田间执行', '田间试点：未开始', 'AO-ACT 派发：已禁用']));
  assert('runtime_overview_copy_present', hasAll(productText, ['Runtime Overview', 'Runtime status', 'Evidence coverage', 'Replay-backed boundary', 'Read-only runtime review', '运行总览', '运行状态', '证据覆盖', '回放支撑边界', '只读运行审查']));

  assert('raw_source_text_boundary_documented', hasAll(doc, ['route paths', 'source identifiers', 'fact IDs', 'trace IDs', 'commit hashes', 'acceptance script names', 'raw evidence payload', 'raw source labels', 'enum values']));

  const positiveClaimHits = violations(productText, positiveClaimForbidden);
  assert('forbidden_positive_production_claims_absent', positiveClaimHits.length === 0, { positiveClaimHits });
  assert('negative_nonclaims_present', hasAll(productText, ['not connected', 'not online', 'not started', 'Disabled', '未连接', '未上线', '未开始', '已禁用']));

  const engineeringHits = violations(productText, engineeringPhaseForbidden);
  assert('visible_engineering_phase_labels_absent', engineeringHits.length === 0, { engineeringHits });

  const scanFiles = diff.filter((file) => exists(file));
  const mojibakeHits = scanFiles.map((file) => ({ file, hits: violations(read(file), mojibakePatterns) })).filter((entry) => entry.hits.length > 0);
  assert('no_mojibake_in_f1c_files', mojibakeHits.length === 0, { mojibakeHits });

  const cssText = scanFiles.filter((file) => file.endsWith('.css')).map(read).join('\n');
  const cssHits = violations(cssText, cssForbidden);
  assert('css_runtime_status_tokens_absent', cssHits.length === 0, { cssHits });

  assert('doc_required_sections_present', hasAll(doc, ['Phase', 'Purpose', 'Preconditions', 'Allowed files', 'Forbidden files', 'Operator surface scope', 'Operator Runtime Overview bilingual scope', 'Field Runtime bilingual scope', 'Replay Demo bilingual scope', 'Pilot Readiness bilingual scope', 'Raw/source text boundary', 'Nonclaim translation boundary', 'Engineering phase label guard', 'Acceptance', 'Non-goals', 'Next phase', 'F1-C only covers Operator formal surfaces.', 'F1-C does not cover Customer or Admin.', 'F1-C does not translate raw evidence or identifiers.', 'F1-C does not change route topology.', 'F1-C does not change runtime semantics.', 'F1-C does not claim live runtime readiness.']), { file: files.doc });

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_F1_C_OPERATOR_BILINGUAL_SURFACES_V1',
    phase: 'F1-C Operator Formal Surface Bilingualization',
    surfaces: {
      operator_runtime_overview: 'bilingual-or-registered',
      field_runtime: 'bilingual-or-registered',
      replay_gateway_demo: 'bilingual-or-registered',
      pilot_readiness: 'bilingual-or-registered',
    },
    raw_source_text: 'preserved',
    route_topology_changed: false,
    backend_changed: false,
    package_changed: false,
    next: 'F1-D Customer / Admin Formal Surface Bilingualization',
    changed_files_checked: diff,
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_F1_C_OPERATOR_BILINGUAL_SURFACES_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
