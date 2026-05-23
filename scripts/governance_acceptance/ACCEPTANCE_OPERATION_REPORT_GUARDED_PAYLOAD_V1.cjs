#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = process.cwd();
const files = {
  chain: path.join(root, 'apps/server/src/projections/operation_report_chain_v1.ts'),
  validator: path.join(root, 'apps/server/src/projections/operation_chain_validator_v1.ts'),
  report: path.join(root, 'apps/server/src/projections/report_v1.ts'),
  reportsRoute: path.join(root, 'apps/server/src/routes/reports_v1.ts'),
  hook: path.join(root, 'apps/server/src/routes/operation_report_chain_hook_v1.ts'),
  projector: path.join(root, 'apps/server/src/projections/guarded_operation_report_projector_v1.ts'),
  routeCoverage: path.join(root, 'scripts/governance_acceptance/ACCEPTANCE_REPORT_GUARD_ROUTE_COVERAGE_V1.cjs'),
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}
function fail(message) {
  console.error(`[operation-report-guarded-payload] FAIL: ${message}`);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}
function assertIncludes(source, needle, label) {
  assert(source.includes(needle), `${label} must include ${needle}`);
}
function assertNotIncludes(source, needle, label) {
  assert(!source.includes(needle), `${label} must not include ${needle}`);
}

const chain = read(files.chain);
const validator = read(files.validator);
const report = read(files.report);
const reportsRoute = read(files.reportsRoute);
const hook = read(files.hook);
const projector = read(files.projector);

// Guard must exist and be applied to the main operation report payload.
assertIncludes(chain, 'applyOperationReportChainGuardV1', 'operation_report_chain_v1');
assertIncludes(chain, 'return applyOperationReportChainGuardV1(assembled, validation)', 'operation_report_chain_v1');
assertIncludes(chain, 'chain_validation: validation.validation', 'guarded payload top-level fields');
assertIncludes(chain, 'status_chain: validation.status_chain', 'guarded payload top-level fields');
assertIncludes(chain, 'customer_visible_eligible: passed', 'guarded payload top-level fields');
assertIncludes(chain, 'blocking_reasons: reasons', 'guarded payload top-level fields');
assertIncludes(chain, 'projection_source:', 'guarded payload top-level fields');
assertIncludes(chain, 'fallback_limited: !passed', 'guarded payload top-level fields');

// Failed validation must downgrade primary payload, not only attach metadata.
assertIncludes(chain, 'validation.validation.passed === true', 'chain guard pass predicate');
assertIncludes(chain, 'status: acceptanceStatus', 'acceptance main payload downgrade');
assertIncludes(chain, 'formal_acceptance: false', 'acceptance main payload downgrade');
assertIncludes(chain, 'evidence_sufficient: false', 'acceptance main payload downgrade');
assertIncludes(chain, 'missing_evidence: true', 'acceptance main payload downgrade');
assertIncludes(chain, 'final_status: executionFinalStatus', 'execution main payload downgrade');
assertIncludes(chain, 'evidence_status: evidenceStatus', 'evidence main payload downgrade');
assertIncludes(chain, 'formal_evidence_passed: false', 'evidence main payload downgrade');
assertIncludes(chain, 'has_customer_visible_value: false', 'ROI main payload downgrade');
assertIncludes(chain, 'customer_visible_memory: false', 'Field Memory main payload downgrade');

// Explicit downgrade states required by PR-4.
assertIncludes(chain, '"NEEDS_REVIEW"', 'acceptance downgrade states');
assertIncludes(chain, '"INSUFFICIENT_EVIDENCE"', 'acceptance downgrade states');
assertIncludes(chain, '"SIMULATED"', 'simulated downgrade states');
assertIncludes(chain, '"PENDING_ACCEPTANCE"', 'execution downgrade states');
assertIncludes(chain, '"BLOCKED"', 'execution downgrade states');
assertIncludes(chain, '"INCOMPLETE"', 'evidence downgrade states');

// Raw agronomic signals must be marked technical, not formal diagnosis.
assertIncludes(chain, 'markTechnicalSignal', 'technical signal marker');
assertIncludes(chain, 'source: "TECHNICAL_SIGNAL"', 'diagnosis technical signal source');
assertIncludes(chain, 'technical_signal: true', 'diagnosis technical signal flag');
assertIncludes(chain, 'formal_diagnosis: false', 'diagnosis technical signal formal false');
assertIncludes(chain, 'soil_moisture', 'raw soil moisture signal detection');
assertIncludes(chain, 'threshold', 'raw threshold signal detection');
assertIncludes(chain, 'skill_trace', 'skill trace signal detection');

// Prescription must come only from formal prescription fact.
assertIncludes(chain, 'const prescription = prescriptionFact ?', 'formal prescription fact guard');
assertIncludes(chain, 'formal_prescription: true', 'formal prescription output');
assertIncludes(chain, 'prescriptionStatus === "DONE"', 'prescription availability guard');
assertIncludes(chain, 'status: prescriptionStatus === "DONE" ? (base.prescription.status ?? "AVAILABLE") : "NOT_AVAILABLE"', 'missing prescription downgrade');
assertNotIncludes(chain, 'plan.operation_plan_id)', 'operation_plan_id fallback must not create prescription id');

// Validator must block weak/legacy acceptance_result_v1 PASS without formal metadata.
assertIncludes(validator, 'isFormalAcceptancePayload', 'chain validator formal acceptance guard');
assertIncludes(validator, 'acceptance_result_without_formal_acceptance_gate', 'chain validator formal acceptance flag');
assertIncludes(validator, 'formal_acceptance', 'chain validator formal acceptance metadata');
assertIncludes(validator, 'formal_evidence_passed', 'chain validator formal acceptance metadata');
assertIncludes(validator, 'formal_execution_passed', 'chain validator formal acceptance metadata');
assertIncludes(validator, 'non_simulated_chain', 'chain validator formal acceptance metadata');
assertIncludes(validator, 'customer_visible_eligible', 'chain validator customer visibility metadata');
assertIncludes(validator, 'is_simulated', 'chain validator simulated acceptance metadata');
assertIncludes(validator, 'sourceLane === "SIMULATED_DEV_ONLY" || sourceLane === "DEBUG_ONLY"', 'chain validator simulated acceptance guard');
assertIncludes(validator, 'payload.customer_visible_eligible === false', 'chain validator customer visibility guard');
assertIncludes(validator, 'acceptanceFormal', 'chain validator acceptance status requires formal gate');
assertIncludes(validator, 'evidenceStatus === "DONE" && acceptanceFormal', 'chain validator acceptance DONE predicate');

// Validator must still identify missing formal prescription and simulated/helper chains.
assertIncludes(validator, 'prescription_id_without_formal_prescription_fact', 'chain validator prescription guard');
assertIncludes(validator, 'helper_or_simulated_facts_present', 'chain validator simulated guard');
assertIncludes(validator, 'simulated_acceptance_not_customer_conclusion', 'chain validator simulated acceptance guard');
assertIncludes(validator, 'validation:', 'chain validator result shape');

// Projector must own the canonical active guard order and route must call it before sending.
assertIncludes(projector, 'export async function buildGuardedOperationReportV1', 'guarded operation report projector');
assertIncludes(projector, 'enrichOperationReportChainV1({ pool: params.pool, report })', 'guarded projector chain enrich order');
assertIncludes(projector, 'enrichOperationReportValueChainRoiV1(compatible)', 'guarded projector ROI enrich order');
assertIncludes(projector, 'applyGuardedOperationReportV1(withValueChainRoi)', 'guarded projector final guard order');
assertIncludes(projector, 'ensureGuardedOperationReportContractV1', 'guarded projector contract field check');
assertIncludes(reportsRoute, 'buildGuardedOperationReportV1', 'operation report route main outlet');
assertIncludes(reportsRoute, 'const guardedOperationReport = await buildGuardedOperationReportV1({ pool, report: enrichedReport })', 'operation report route main outlet');
assertIncludes(reportsRoute, 'operation_report_v1: guardedOperationReport', 'operation report route guarded payload');
assertNotIncludes(reportsRoute, 'operation_report_v1: enrichedReport }', 'operation report route unguarded payload');

// Hook must remain defense-in-depth and reuse projector, not duplicate active guard chain.
assertIncludes(hook, 'buildGuardedOperationReportV1', 'operation report chain hook projector reuse');
assertIncludes(hook, 'guardOperationReportResponse', 'operation report chain hook');
assertIncludes(hook, 'isOperationReportPath', 'operation report chain hook');
assertIncludes(hook, 'operation_report_v1: guarded', 'operation report chain hook returns guarded report');
assertNotIncludes(hook, 'enrichOperationReportValueChainRoiV1', 'operation report hook must not duplicate ROI enrichment');
assertNotIncludes(hook, 'applyGuardedOperationReportV1', 'operation report hook must not duplicate guard application');

// Base report type still has primary payload fields that the guard mutates.
assertIncludes(report, 'acceptance:', 'report_v1 primary acceptance payload');
assertIncludes(report, 'execution:', 'report_v1 primary execution payload');
assertIncludes(report, 'evidence:', 'report_v1 primary evidence payload');
assertIncludes(report, 'roi_ledger:', 'report_v1 primary ROI payload');
assertIncludes(report, 'field_memory:', 'report_v1 primary Field Memory payload');

const coverage = spawnSync('node', ['scripts/governance_acceptance/ACCEPTANCE_REPORT_GUARD_ROUTE_COVERAGE_V1.cjs'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (coverage.status !== 0) {
  process.stderr.write(coverage.stdout || '');
  process.stderr.write(coverage.stderr || '');
  fail('report guard route coverage gate failed');
}

console.log('[operation-report-guarded-payload] PASS');
