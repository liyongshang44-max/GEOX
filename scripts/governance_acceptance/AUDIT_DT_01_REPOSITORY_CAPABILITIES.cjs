// scripts/governance_acceptance/AUDIT_DT_01_REPOSITORY_CAPABILITIES.cjs
// Purpose: collect reproducible static repository facts for DT-01 capability reconciliation.
// Boundary: this script does not build a complete TypeScript semantic call graph and does not claim runtime integration from text references.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '../..');
const INVENTORY_PATH = path.join(ROOT, 'docs/digital_twin/GEOX-DT-01-CAPABILITY-INVENTORY.json');
const OUTPUT_PATH = path.join(ROOT, 'tmp/dt-01/repository-capability-audit.json');
const CHECK_ONLY = process.argv.includes('--check');

const ignoredRoots = ['.git/','node_modules/','dist/','tmp/','acceptance-output/','docs/digital_twin/'];
const searchableExtensions = new Set(['.ts', '.tsx', '.js', '.cjs', '.mjs', '.json', '.md', '.sql']);

function rel(absPath) { return path.relative(ROOT, absPath).replaceAll(path.sep, '/'); }
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const relative = rel(abs);
    if (ignoredRoots.some((prefix) => relative === prefix.slice(0, -1) || relative.startsWith(prefix))) continue;
    if (entry.isDirectory()) { walk(abs, out); continue; }
    if (searchableExtensions.has(path.extname(entry.name))) out.push(abs);
  }
  return out;
}
function read(relativePath) { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }

function loadInventoryManifest(relativePath) {
  const manifest = JSON.parse(read(relativePath));
  const capabilities = [];
  for (const part of manifest.part_files || []) {
    const stored = fs.readFileSync(path.join(ROOT, part.path));
    const outer = JSON.parse(stored.toString('utf8'));
    const raw = outer?.encoding === 'GZIP_BASE64_JSON'
      ? zlib.gunzipSync(Buffer.from(outer.payload, 'base64'))
      : stored;
    const digest = crypto.createHash('sha256').update(raw).digest('hex');
    if (digest !== part.sha256) throw new Error(`INVENTORY_PART_SHA256_MISMATCH:${part.path}`);
    if (outer?.encoding === 'GZIP_BASE64_JSON' && outer.decoded_sha256 !== digest) {
      throw new Error(`INVENTORY_ENVELOPE_SHA256_MISMATCH:${part.path}`);
    }
    const decoded = JSON.parse(raw.toString('utf8'));
    capabilities.push(...(decoded.capabilities || []));
  }
  return { ...manifest, capabilities };
}

function occurrenceCount(text, token) { return token ? text.split(token).length - 1 : 0; }
function externalReferences(files, definitionPaths, tokens) {
  const definitionSet = new Set(definitionPaths);
  const refs = [];
  for (const abs of files) {
    const relative = rel(abs);
    if (definitionSet.has(relative)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const hits = tokens.reduce((sum, token) => sum + occurrenceCount(text, token), 0);
    if (hits > 0) refs.push({ path: relative, hit_count: hits });
  }
  return refs;
}

function checkCriticalFacts(inventory, report) {
  const byId = new Map(inventory.capabilities.map((item) => [item.capability_id, item]));
  const critical = [];
  function record(name, passed, detail) { critical.push({ name, passed: Boolean(passed), detail }); }

  const water = byId.get('DT01-CAP-020');
  const integration = water?.components?.find((item) => item.component_id === 'integration_status');
  record('water_state_integration_no_runtime_call_site', integration?.call_status === 'NO_RUNTIME_CALL_SITE_FOUND', integration?.call_status || 'missing');

  const p42 = read('scripts/twin_kernel/P42_21_CONTROLLED_ACTIVE_TWIN_FORECAST_LOOP_RUNNER_V0.cjs');
  record('p42_not_server_runtime', p42.includes('p42_is_not_server_runtime_loop:true'), 'explicit runner nonclaim');
  record('p42_acceptance_output_only', p42.includes('acceptance-output') && p42.includes('P42_CONTROLLED_ACTIVE_FORECAST_LEDGER.jsonl'), 'controlled file ledger');

  const p43 = read('scripts/twin_kernel/P43_21_CONTROLLED_FORECAST_RESIDUAL_MONITORING_RUNNER_V0.cjs');
  record('p43_ledger_only', p43.includes('ledger_only=true') && p43.includes('acceptance-output'), 'controlled residual ledger');

  const p50Doc = read('docs/twin_demo_runtime/GEOX-P50-REPLAY-BACKED-PRODUCTION-TWIN-DEMO-RUNTIME.md');
  record('p50_historical_replay', p50Doc.includes('source_truth_mode = historical_replay'), 'P50 source mode');
  record('p50_not_production', p50Doc.includes('demo_runtime_is_not_production_runtime = true'), 'P50 nonclaim');

  const routes = read('apps/web/src/app/routes/operatorFieldRuntimeRoutes.tsx');
  for (const route of [':fieldId/state', ':fieldId/forecast', ':fieldId/scenario', ':fieldId/residual', ':fieldId/calibration']) {
    record(`operator_route_${route}`, routes.includes(`path="${route}"`), route);
  }

  const aoAct = read('apps/server/src/routes/control_ao_act.ts');
  record('ao_act_canonical_route_family', aoAct.includes('/api/v1/actions/*'), 'canonical action route comment');
  record('ao_act_legacy_not_new_mainline', aoAct.includes('禁止新代码依赖 legacy/deprecated route'), 'legacy boundary');

  for (const id of ['DT01-CAP-070','DT01-CAP-071','DT01-CAP-072','DT01-CAP-073','DT01-CAP-074','DT01-CAP-075','DT01-CAP-076','DT01-CAP-077','DT01-CAP-078','DT01-CAP-079']) {
    record(`${id}_missing`, byId.get(id)?.capability_status === 'MISSING', byId.get(id)?.capability_status || 'absent');
  }

  report.critical_checks = critical;
  return critical.every((item) => item.passed);
}

if (!fs.existsSync(INVENTORY_PATH)) {
  console.error('DT01_AUDIT_INVENTORY_MISSING');
  process.exit(1);
}

const inventory = loadInventoryManifest('docs/digital_twin/GEOX-DT-01-CAPABILITY-INVENTORY.json');
const repositoryFiles = walk(ROOT);
const missingDefinitionPaths = [];
const componentReports = [];

for (const capability of inventory.capabilities) {
  for (const component of capability.components || []) {
    const pathResults = component.definition_paths.map((relativePath) => {
      const exists = fs.existsSync(path.join(ROOT, relativePath));
      if (!exists) missingDefinitionPaths.push(relativePath);
      return { path: relativePath, exists };
    });
    const definitionTexts = component.definition_paths
      .filter((relativePath) => fs.existsSync(path.join(ROOT, relativePath)))
      .map((relativePath) => ({ path: relativePath, text: read(relativePath) }));
    const staticHits = [];
    for (const token of component.symbols || []) {
      const matching = definitionTexts.filter((entry) => entry.text.includes(token)).map((entry) => entry.path);
      staticHits.push({ token, paths: matching });
    }
    const external = externalReferences(repositoryFiles, component.definition_paths, component.symbols || []);
    const staticReferenceFound = staticHits.some((item) => item.paths.length > 0);
    const directCallFound = external.length > 0;
    const runtimeEntryFound = (component.runtime_entries || []).length > 0 || (component.routes || []).length > 0;
    componentReports.push({
      capability_id: capability.capability_id,
      component_id: component.component_id,
      path_results: pathResults,
      static_hits: staticHits,
      external_references: external,
      static_reference_found: staticReferenceFound,
      direct_call_found: directCallFound,
      runtime_entry_found: runtimeEntryFound,
      not_found: !staticReferenceFound,
      manual_review_required: !staticReferenceFound || component.call_status.includes('NO_RUNTIME_CALL_SITE'),
      recorded_call_status: component.call_status,
      audit_limit: 'text-reference evidence only; transitive TypeScript semantics require manual review',
    });
  }
}

const report = {
  schema_version: 'geox_dt01_repository_capability_static_audit_v1',
  phase: 'DT-01',
  baseline_commit: 'bce918d1eea423397bdd329148b7a2e7eb181b6c',
  generated_at: new Date().toISOString(),
  check_only: CHECK_ONLY,
  repository_file_count: repositoryFiles.length,
  capability_count: inventory.capabilities.length,
  component_count: componentReports.length,
  missing_definition_paths: [...new Set(missingDefinitionPaths)].sort(),
  components: componentReports,
  critical_checks: [],
  limitations: ['This is static text and path analysis.','It does not construct a complete TypeScript semantic call graph.','A reference in a test or document is not a server runtime caller.'],
};

const criticalPass = checkCriticalFacts(inventory, report);
report.ok = report.missing_definition_paths.length === 0 && criticalPass;

if (!CHECK_ONLY) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({
  ok: report.ok,
  phase: report.phase,
  capability_count: report.capability_count,
  component_count: report.component_count,
  missing_definition_path_count: report.missing_definition_paths.length,
  failed_critical_check_count: report.critical_checks.filter((item) => !item.passed).length,
  report_path: CHECK_ONLY ? null : path.relative(ROOT, OUTPUT_PATH).replaceAll(path.sep, '/'),
}, null, 2));

process.exit(report.ok ? 0 : 1);
