// scripts/frontend_acceptance/ACCEPTANCE_F1_B_SHELL_BILINGUAL_INTEGRATION_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const F1B_BASE_HEAD = '6e16784fced8f7cae1b7cd37b49c6f7bd9d51495';
const F1B_ACCEPTED_HEAD = '9f929ed34beb95d9603b30bdc84fbfc30f6b97cd';

const files = {
  customerLayout: 'apps/web/src/layouts/CustomerLayout.tsx',
  operatorLayout: 'apps/web/src/layouts/OperatorLayout.tsx',
  adminLayout: 'apps/web/src/layouts/AdminLayout.tsx',
  customerCss: 'apps/web/src/styles/customerShell.css',
  operatorCss: 'apps/web/src/styles/operatorShell.css',
  adminCss: 'apps/web/src/styles/adminShell.css',
  productSurfaceLabels: 'apps/web/src/lib/productSurfaceLabels.ts',
  localeToggle: 'apps/web/src/components/common/LocaleToggle.tsx',
  app: 'apps/web/src/app/App.tsx',
  doc: 'docs/frontend-productization/F1-B-SHELL-BILINGUAL-INTEGRATION.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_F1_B_SHELL_BILINGUAL_INTEGRATION_V1.cjs',
};

const allowedChangedFiles = new Set([files.customerLayout, files.operatorLayout, files.adminLayout, files.customerCss, files.operatorCss, files.adminCss, files.productSurfaceLabels, files.doc, files.acceptance]);
const blockedExactFiles = new Set(['apps/web/src/app/App.tsx', 'apps/web/src/components/common/LocaleToggle.tsx', 'apps/web/src/lib/locale.tsx', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']);
const blockedPrefixes = ['apps/web/src/app/routes/', 'apps/web/src/features/', 'apps/web/src/views/', 'apps/server/', 'migrations/', 'packages/contracts/', 'fixtures/', '.github/'];
const mojibakePatterns = ['鎬', '鍦', '浣', '璁', '杩', '閰', '绠', '瀵', '艰', '鍚', '彴', '潡', '惧', '悍', '嵁', '�'];
const cssForbidden = ['live-online', 'production-online', 'dispatch-enabled', 'ao-act-ready', 'roi-ready', 'field-memory-ready', 'risk-red', 'success-green', 'warning-yellow'];
const formalNavForbidden = ['H58', 'H59', 'H60', 'H61', 'H62', 'H63', 'H64', 'H65', 'H66', 'H67', 'P51', 'P52', 'P53', 'P54', 'P55', 'P56', 'P57', 'TK', 'fixture', 'acceptance', 'debug', 'Dev Tools', 'ROI Ledger', 'Field Memory', 'Dispatch', 'AO-ACT', 'Judge Config', 'Sim Config'];
const positiveClaimForbidden = ['Live Device: Connected', 'Production Gateway: Online', 'Field Pilot: Started', 'Controlled Execution: Enabled', 'AO-ACT Dispatch: Enabled', 'dispatch enabled', 'live monitoring active', 'production gateway online', 'field pilot started', 'ROI computed', 'Field Memory learned', '实时设备：已连接', '生产网关：在线', '生产网关：已上线', '田间试点：已开始', '受控执行：已启用', '自动执行：已启用'];
const assertions = [];

function repoPath(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function hasAll(text, tokens) { return tokens.every((token) => text.includes(token)); }
function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[f1-b-shell-bilingual-integration] ok:', name);
}
function changedFiles() {
  try {
    return cp.execFileSync('git', ['diff', '--name-only', `${F1B_BASE_HEAD}...${F1B_ACCEPTED_HEAD}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch (_error) {
    return [];
  }
}
function isBlockedFile(file) { return blockedExactFiles.has(file) || blockedPrefixes.some((prefix) => file.startsWith(prefix)); }
function countDirectTextCalls(text) { return (text.match(/\btext\s*\(/g) || []).length; }
function extractConstArray(text, constName) {
  const marker = `const ${constName}`;
  const start = text.indexOf(marker);
  if (start < 0) return '';
  const fromArray = text.indexOf('[', start);
  if (fromArray < 0) return '';
  const end = text.indexOf('];', fromArray);
  if (end < 0) return '';
  return text.slice(start, end + 2);
}
function stripCommentsAndDataAttributes(text) {
  return text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/data-[\w-]+="[^"]*"/g, '').replace(/data-[\w-]+='[^']*'/g, '');
}
function violations(text, tokens) { return tokens.filter((token) => text.includes(token)); }
function shellLabelRegistryText(text) {
  const start = text.indexOf('export const PRODUCT_SURFACE_LABELS');
  const end = text.indexOf('export const OPERATOR_FORMAL_SURFACE_COPY');
  if (start < 0) return text;
  return end > start ? text.slice(start, end) : text.slice(start);
}
function positiveClaimViolations(text) {
  const lowered = text.toLowerCase();
  return positiveClaimForbidden.filter((claim) => {
    const needle = String(claim).toLowerCase();
    const index = lowered.indexOf(needle);
    if (index < 0) return false;
    const before = lowered.slice(Math.max(0, index - 24), index);
    if (before.includes('not ') || before.includes('not a ') || before.includes('不是') || before.includes('未')) return false;
    return true;
  });
}

try {
  [files.customerLayout, files.operatorLayout, files.adminLayout, files.localeToggle, files.productSurfaceLabels, files.doc, files.acceptance].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const routeTopologyChanged = diff.includes(files.app) || diff.some((file) => file.startsWith('apps/web/src/app/routes/'));
  const backendChanged = diff.some((file) => file.startsWith('apps/server/') || file.startsWith('migrations/') || file.startsWith('packages/contracts/') || file.startsWith('fixtures/'));
  const packageChanged = diff.some((file) => ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file));

  assert('changed_files_allowlist', diff.length > 0 && diff.every((file) => allowedChangedFiles.has(file)), { diff, base: F1B_BASE_HEAD, head: F1B_ACCEPTED_HEAD });
  assert('blocked_files_unchanged', diff.every((file) => !isBlockedFile(file)), { diff, base: F1B_BASE_HEAD, head: F1B_ACCEPTED_HEAD });
  assert('route_topology_unchanged', routeTopologyChanged === false, { diff });
  assert('backend_unchanged', backendChanged === false, { diff });
  assert('package_unchanged', packageChanged === false, { diff });

  const customerLayout = read(files.customerLayout);
  const operatorLayout = read(files.operatorLayout);
  const adminLayout = read(files.adminLayout);
  const shellRegistry = shellLabelRegistryText(read(files.productSurfaceLabels));
  const app = read(files.app);
  const doc = read(files.doc);

  assert('locale_toggle_imported_in_formal_shells', customerLayout.includes('LocaleToggle') && operatorLayout.includes('LocaleToggle') && adminLayout.includes('LocaleToggle'));
  assert('locale_toggle_rendered_in_formal_shells', customerLayout.includes('<LocaleToggle') && operatorLayout.includes('<LocaleToggle') && adminLayout.includes('<LocaleToggle'));
  assert('locale_toggle_not_wired_to_app', !app.includes('LocaleToggle'), { file: files.app });
  assert('formal_shells_use_locale_helpers', hasAll(customerLayout, ['useLocale', 'localizedText']) && hasAll(operatorLayout, ['useLocale', 'localizedText']) && hasAll(adminLayout, ['useLocale', 'localizedText']));
  assert('direct_text_calls_limited', [customerLayout, operatorLayout, adminLayout].every((text) => countDirectTextCalls(text) <= 8));
  assert('admin_topbar_title_lead_bilingualized', hasAll(adminLayout, ['ADMIN_SHELL_LABELS.topbar.title', 'ADMIN_SHELL_LABELS.topbar.lead', 'topbarTitle', 'topbarLead']) && !adminLayout.includes('{topBar.title}') && !adminLayout.includes('{topBar.lead}'));

  const shellCopy = [customerLayout, operatorLayout, adminLayout, shellRegistry].join('\n');
  assert('customer_shell_bilingual_copy_present', hasAll(shellCopy, ['Dashboard', 'Fields', 'Operations', 'Reports', 'Export', 'Authorized scope pending', 'Reading access scope', 'No authorized fields', 'Contact operations', 'Authorized scope confirmed', '经营总览', '地块', '作业', '报告', '导出', '授权范围待确认', '正在读取权限', '暂无授权地块', '授权范围已确认']));
  assert('operator_shell_bilingual_copy_present', hasAll(shellCopy, ['Overview', 'Fields', 'Evidence', 'Forecast', 'Calibration', 'Health', 'Pilot', 'Settings', 'Route active', 'Route preserved', 'Coming soon', 'Runtime Mode: Replay-backed Demo', 'Live Device: Not connected', 'Production Gateway: Not online', 'Field Pilot: Not started', 'Controlled Execution: Disabled', '总览', '地块', '证据', '预测', '校准', '健康', '试点', '设置', '路由可用', '路由保留', '即将开放', '运行模式：回放支撑演示', '实时设备：未连接', '生产网关：未上线', '田间试点：未开始', '受控执行：已禁用']));
  assert('admin_shell_bilingual_copy_present', hasAll(shellCopy, ['Dashboard', 'Fields', 'Operations', 'Devices', 'Evidence', 'Runtime Health', 'Config', 'Admin Console', 'Internal governance surface', 'Read-only shell boundary', 'Formal navigation', 'Admin routes only', 'Route family', 'Surface mode', 'Governed readback', '后台管理', '总览', '地块', '作业', '设备', '证据', '运行健康', '配置', '内部治理界面', '只读 Shell 边界', '正式导航', '仅后台管理路由', '路由族', '界面模式', '治理回查']));
  assert('negative_nonclaims_present', hasAll(shellCopy, ['Live Device: Not connected', 'Production Gateway: Not online', 'Field Pilot: Not started', 'Controlled Execution: Disabled', '实时设备：未连接', '生产网关：未上线', '田间试点：未开始', '受控执行：已禁用']));

  const positiveClaimHits = positiveClaimViolations(shellCopy);
  assert('forbidden_positive_production_claims_absent', positiveClaimHits.length === 0, { positiveClaimHits });
  const formalNavText = stripCommentsAndDataAttributes([extractConstArray(customerLayout, 'CUSTOMER_NAV_ITEMS'), extractConstArray(operatorLayout, 'OPERATOR_NAV_ITEMS'), extractConstArray(adminLayout, 'ADMIN_NAV_ITEMS')].join('\n'));
  const formalNavHits = violations(formalNavText, formalNavForbidden);
  assert('formal_nav_pollution_absent', formalNavHits.length === 0, { formalNavHits });

  const scanForMojibake = [customerLayout, operatorLayout, adminLayout, shellRegistry, doc].map((text, index) => ({ index, hits: violations(text, mojibakePatterns) })).filter((entry) => entry.hits.length > 0);
  assert('no_mojibake_in_f1b_files', scanForMojibake.length === 0, { scanForMojibake });
  const cssText = [files.customerCss, files.operatorCss, files.adminCss].filter(exists).map(read).join('\n');
  const cssHits = violations(cssText, cssForbidden);
  assert('css_runtime_status_tokens_absent', cssHits.length === 0, { cssHits });
  assert('doc_required_sections_present', hasAll(doc, ['Phase', 'Purpose', 'Preconditions', 'Allowed files', 'Forbidden files', 'Shell integration scope', 'Customer shell bilingual scope', 'Operator shell bilingual scope', 'Admin shell bilingual scope', 'Nonclaim translation boundary', 'Formal nav pollution guard', 'Acceptance', 'Non-goals', 'Next phase', 'F1-B does not translate full product pages.', 'F1-B does not translate backend values.', 'F1-B does not translate raw evidence or identifiers.', 'F1-B does not change route topology.', 'F1-B does not change runtime semantics.', 'F1-B prepares F1-C Operator Formal Surface Bilingualization.']), { file: files.doc });

  console.log(JSON.stringify({ ok: true, acceptance: 'ACCEPTANCE_F1_B_SHELL_BILINGUAL_INTEGRATION_V1', phase: 'F1-B Shell / Navigation Bilingual Integration', shells: { customer: 'locale-toggle-and-bilingual-shell-copy', operator: 'locale-toggle-and-bilingual-shell-copy', admin: 'locale-toggle-and-bilingual-shell-copy' }, route_topology_changed: false, backend_changed: false, package_changed: false, next: 'F1-C Operator Formal Surface Bilingualization', changed_files_checked: diff, diff_base: F1B_BASE_HEAD, diff_head: F1B_ACCEPTED_HEAD, assertions }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_F1_B_SHELL_BILINGUAL_INTEGRATION_V1', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
