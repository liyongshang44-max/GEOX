const fs = require('node:fs');
const path = require('node:path');

const TASK = 'BLINE_B5F4_ROI_SKILL_AUTHORITY_LINEAGE_V1';
const target = path.join(
  process.cwd(),
  'apps/server/src/domain/roi/roi_ledger_v1.ts',
);

function pass(value) {
  return value ? 'PASS' : 'FAIL';
}

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + 1);
  if (start < 0 || end < 0) {
    throw new Error(`ANCHOR_MISSING:${startNeedle}:${endNeedle}`);
  }
  return source.slice(start, end);
}

function main() {
  const source = fs.readFileSync(target, 'utf8');

  const waterSaved = sliceBetween(
    source,
    'export function computeWaterSavedEntry(',
    'export function computeCostImpactEntry(',
  );
  const enrich = sliceBetween(
    source,
    'function enrichCommercialFields(',
    'export function computeRoiLedgerEntriesFromAsExecuted(',
  );
  const createRoi = sliceBetween(
    source,
    'export async function createRoiLedgersFromAsExecuted(',
    'function formalRoiTypeFromInterim(',
  );

  const computeAt = createRoi.indexOf('const candidates = computeRoiLedgerEntriesFromAsExecuted(');
  const prescriptionAt = createRoi.indexOf('const prescriptionSkillRef = asExecuted.prescription_id');
  const resolvedRefsAt = createRoi.indexOf('const resolvedSkillRefs = normalizeSkillRefs([');
  const resolvedTraceAt = createRoi.indexOf('const resolvedSkillTraceId =');
  if (computeAt < 0 || prescriptionAt < 0 || resolvedRefsAt < 0 || resolvedTraceAt < 0) {
    throw new Error('B5F4_RESOLUTION_ANCHOR_MISSING');
  }

  const checks = {
    water_saved_no_stale_deficit_source_hardcode: pass(
      !waterSaved.includes('source_skill_id: "irrigation_deficit_skill_v1"'),
    ),
    enrich_no_global_deficit_source_fallback: pass(
      !enrich.includes('?? "irrigation_deficit_skill_v1"'),
    ),
    prescription_skill_ref_resolved_before_candidate_compute: pass(
      prescriptionAt < computeAt,
    ),
    canonical_skill_refs_resolved_before_candidate_compute: pass(
      resolvedRefsAt < computeAt,
    ),
    prescription_skill_precedes_caller_supplemental_refs: pass(
      /const resolvedSkillRefs = normalizeSkillRefs\(\[\s*\.\.\.\(prescriptionSkillRef \? \[prescriptionSkillRef\] : \[\]\),[\s\S]*\.\.\.\(input\.skill_refs \?\? \[\]\)/.test(createRoi),
    ),
    canonical_trace_precedes_caller_trace: pass(
      /const resolvedSkillTraceId = String\(prescriptionSkillRef\?\.trace_id \?\? ""\)\.trim\(\)[\s\S]*executionTraceId[\s\S]*String\(input\.skill_trace_id \?\? ""\)\.trim\(\)/.test(createRoi),
    ),
    candidate_compute_consumes_resolved_skill_lineage: pass(
      /computeRoiLedgerEntriesFromAsExecuted\(asExecuted, asApplied, \{\s*skill_trace_id: resolvedSkillTraceId,\s*skill_refs: resolvedSkillRefs,\s*\}\)/.test(createRoi),
    ),
    roi_upsert_reuses_same_resolved_skill_lineage: pass(
      createRoi.includes('skill_trace_id: resolvedSkillTraceId,')
      && createRoi.includes('skill_refs: resolvedSkillRefs,'),
    ),
    caller_skill_refs_preserved_as_supplemental_evidence: pass(
      createRoi.includes('...(input.skill_refs ?? [])'),
    ),
  };

  const ok = Object.values(checks).every((value) => value === 'PASS');
  process.stdout.write(`${JSON.stringify({ ok, task: TASK, checks }, null, 2)}\n`);
  if (!ok) process.exit(1);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    ok: false,
    task: TASK,
    error: String(error?.stack ?? error?.message ?? error),
  }, null, 2)}\n`);
  process.exit(1);
}
