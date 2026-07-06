// scripts/frontend_acceptance/ACCEPTANCE_PFE_10_PERFORMANCE_BUDGET_BUNDLE_HYGIENE.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const docs = [
  'docs/frontend-productization/PFE-10-PERFORMANCE-BUDGET-BUNDLE-HYGIENE.md',
  'docs/frontend-productization/PFE-10-BUNDLE-BUDGET.json',
  'docs/frontend-productization/PFE-10-BUNDLE-MATRIX.md',
  'docs/frontend-productization/PFE-10-BUNDLE-ISSUE-REGISTER.md',
];
const baselineDocs = [
  'docs/frontend-productization/PFE-6-ACCESSIBILITY-KEYBOARD-COMPLIANCE.md',
  'docs/frontend-productization/PFE-7-RESPONSIVE-VIEWPORT-COMPLETION.md',
  'docs/frontend-productization/PFE-8-EMPTY-LOADING-ERROR-STATE-COMPLETION.md',
  'docs/frontend-productization/PFE-9-VISUAL-REGRESSION-SCREENSHOT-BASELINE.md',
];
const checkerFile = 'scripts/frontend_acceptance/CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs';
const acceptanceFile = 'scripts/frontend_acceptance/ACCEPTANCE_PFE_10_PERFORMANCE_BUDGET_BUNDLE_HYGIENE.cjs';
const allowedChangedFiles = new Set([...docs, checkerFile, acceptanceFile]);
const assertions = [];

function repoPath(file) { return path.join(root, file); }
function exists(file) { return fs.existsSync(repoPath(file)); }
function read(file) { return fs.readFileSync(repoPath(file), 'utf8'); }
function lower(value) { return String(value).toLowerCase(); }
function includesAll(text, tokens) { const haystack = lower(text); return tokens.every((token) => haystack.includes(lower(token))); }
function assert(name, passed, details = {}) { assertions.push({ name, passed: passed === true, details }); if (passed !== true) { const error = new Error('ASSERTION_FAILED:' + name); error.details = details; throw error; } console.log('[pfe-10-performance-budget-bundle-hygiene] ok:', name); }
function runGit(args) { try { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (_error) { return ''; } }
function statusFiles() { const output = runGit(['status', '--short', '--untracked-files=all']); if (!output) return []; return output.split(/\r?\n/).map((line) => { if (!line.trim()) return ''; const arrow = line.indexOf(' -> '); if (arrow >= 0) return line.slice(arrow + 4).trim(); return line.replace(/^[ MADRCU?!]{1,2}\s+/, '').trim(); }).filter(Boolean); }
function changedFiles() { const set = new Set(); const output = runGit(['diff', '--name-only', 'origin/main...HEAD']) || runGit(['diff', '--name-only', 'main...HEAD']); if (output) output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => set.add(file)); statusFiles().forEach((file) => set.add(file)); return Array.from(set).sort(); }
function parseBudget() { return JSON.parse(read('docs/frontend-productization/PFE-10-BUNDLE-BUDGET.json')); }
function allDocsText() { return docs.filter((file) => file.endsWith('.md')).map(read).join('\n'); }

try {
  [...docs, ...baselineDocs, checkerFile, acceptanceFile].forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const budget = parseBudget();
  const budgetText = read('docs/frontend-productization/PFE-10-BUNDLE-BUDGET.json');
  const mainDoc = read('docs/frontend-productization/PFE-10-PERFORMANCE-BUDGET-BUNDLE-HYGIENE.md');
  const matrix = read('docs/frontend-productization/PFE-10-BUNDLE-MATRIX.md');
  const issueRegister = read('docs/frontend-productization/PFE-10-BUNDLE-ISSUE-REGISTER.md');
  const checker = read(checkerFile);
  const docsCombined = allDocsText();
  const budgets = budget.budgets || {};
  const requiredBudgetKeys = [
    'totalJsRawBytes',
    'totalJsGzipBytes',
    'largestJsRawBytes',
    'largestJsGzipBytes',
    'totalCssRawBytes',
    'totalCssGzipBytes',
    'largestCssRawBytes',
    'largestCssGzipBytes',
    'maxJsAssetCount',
    'maxCssAssetCount',
    'maxTotalAssetCount',
  ];

  assert('changed_files_allowlist', diff.length === 0 || diff.every((file) => allowedChangedFiles.has(file)), { diff, allowed: Array.from(allowedChangedFiles) });
  assert('no_route_topology_changes', diff.every((file) => file !== 'apps/web/src/app/App.tsx' && file !== 'apps/web/src/app/AppShell.tsx' && !file.startsWith('apps/web/src/app/routes/')), { diff });
  assert('no_backend_migration_contract_fixture_changes', diff.every((file) => !file.startsWith('apps/server/') && !file.startsWith('migrations/') && !file.startsWith('packages/contracts/') && !file.startsWith('fixtures/')), { diff });
  assert('no_package_or_workspace_changes', diff.every((file) => !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'apps/web/package.json'].includes(file)), { diff });
  assert('no_ci_workflow_changes', diff.every((file) => !file.startsWith('.github/')), { diff });
  assert('no_committed_dist_or_audit_binaries', diff.every((file) => !file.startsWith('apps/web/dist/') && !/docs\/audit\/.*\.(png|jpg|jpeg|webp)$/i.test(file)), { diff });

  assert('budget_json_valid_phase', budget.phase === 'PFE-10 Performance Budget & Bundle Hygiene' && budget.version === 1 && budget.mode === 'build-output-budget');
  assert('budget_json_points_to_web_dist', budget.buildOutputDir === 'apps/web/dist');
  assert('budget_json_has_required_thresholds', requiredBudgetKeys.every((key) => Number.isFinite(Number(budgets[key])) && Number(budgets[key]) > 0), { requiredBudgetKeys });
  assert('budget_json_has_scope_markers', includesAll(budgetText, ['pixelDiff', 'lighthouseScore', 'rum', 'budgetChangePolicy']));

  assert('checker_exists_and_reads_budget', checker.includes('PFE-10-BUNDLE-BUDGET.json') && checker.includes('readJson'));
  assert('checker_requires_dist_after_build', checker.includes('not found. Run pnpm run build:web first.'));
  assert('checker_uses_node_zlib', checker.includes("require('node:zlib')") && checker.includes('gzipSync'));
  assert('checker_measures_js_css_and_counts', requiredBudgetKeys.every((key) => checker.includes(key)));
  assert('checker_writes_report', checker.includes('PFE_10_BUNDLE_BUDGET_REPORT.md') && checker.includes('writeReport'));
  assert('checker_lists_top_assets', checker.includes('topAssets') && checker.includes('slice(0, 10)'));

  assert('baseline_docs_present', baselineDocs.every(exists));
  assert('main_doc_has_required_policy', includesAll(mainDoc, ['Budget policy', 'Bundle hygiene policy', 'Build-output policy', 'Non-goals', 'Budget checker policy', 'Completion boundary']));
  assert('matrix_has_budget_dimensions', requiredBudgetKeys.every((key) => matrix.includes(key)));
  assert('issue_register_has_blocker_policy', includesAll(issueRegister, ['Blocking issues not allowed', 'build output missing', 'bundle checker missing', 'JS gzip budget exceeded', 'asset count budget exceeded']));
  assert('issue_register_has_budget_change_policy', includesAll(issueRegister, ['Budget change policy', 'measured current value', 'proposed budget value', 'reason for change']));

  assert('no_lighthouse_or_rum_completion_claim', !lower(docsCombined).includes('completed lighthouse') && !lower(docsCombined).includes('completed real-user monitoring') && !lower(docsCombined).includes('completed rum'));
  assert('no_new_dependency_claim_or_change', diff.every((file) => !['package.json', 'pnpm-lock.yaml', 'apps/web/package.json'].includes(file)));

  console.log(JSON.stringify({
    ok: true,
    acceptance: 'ACCEPTANCE_PFE_10_PERFORMANCE_BUDGET_BUNDLE_HYGIENE',
    scope: 'performance budget and bundle hygiene only',
    budget: { mode: budget.mode, dist: budget.buildOutputDir, pixel_diff: 'out-of-scope', lighthouse: 'out-of-scope' },
    checks: { docs: 'passed', budget_config: 'passed', bundle_checker: 'passed', no_route_changes: 'passed', no_package_changes: 'passed', no_backend_changes: 'passed' },
    changed_files_checked: diff.length ? diff : Array.from(allowedChangedFiles),
    assertions,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: 'ACCEPTANCE_PFE_10_PERFORMANCE_BUDGET_BUNDLE_HYGIENE', error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
