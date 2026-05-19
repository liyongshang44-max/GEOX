#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');

const files = {
  domainContract: 'apps/server/src/domain/inspection/pest_disease_inspection_contract_v1.ts',
  inspectionService: 'apps/server/src/services/inspection/pest_disease_inspection_service_v1.ts',
  inspectionProjection: 'apps/server/src/services/inspection/pest_disease_inspection_projection_v1.ts',
  inspectionRoute: 'apps/server/src/routes/v1/inspection.ts',
  reportsRoute: 'apps/server/src/routes/reports_v1.ts',
  reportProjection: 'apps/server/src/projections/report_v1.ts',
  customerLabels: 'apps/web/src/lib/customerScenarioLabels.ts',
  formalScenarioVm: 'apps/web/src/lib/formalScenarioViewModel.ts',
  formalScenarioCards: 'apps/web/src/components/customer/FormalScenarioCards.tsx',
  evidenceVm: 'apps/web/src/lib/evidenceViewModel.ts',
  evidenceComponent: 'apps/web/src/components/evidence/index.tsx',
  formalE2e: 'scripts/agronomy_acceptance/ACCEPTANCE_FORMAL_PEST_DISEASE_INSPECTION_E2E_V1.cjs',
  reportProjectionGate: 'scripts/agronomy_acceptance/ACCEPTANCE_PEST_DISEASE_INSPECTION_REPORT_PROJECTION_V1.cjs',
  mainChainDoc: 'docs/contracts/PEST_DISEASE_MAIN_CHAIN_ALIGNMENT_V1.md',
};

const scanPaths = Object.values(files);

const forbiddenTerms = [
  'spray_prescription',
  'spot_spray_prescription',
  'spray_recommendation',
  'ao_act_task',
  'dispatch_command',
  'device_command',
  'treatment_completed',
  'treatment_success',
  'spray_completed',
  'spray_success',
  'pest_control_completed',
  'roi_ledger',
  'field_memory',
];

const forbiddenCustomerPhrases = [
  '已喷药',
  '已防治',
  '防治完成',
  '喷药完成',
  '病虫害已解决',
  '作物风险已解除',
  '防治效果已达成',
];

const requiredBoundaryLiterals = [
  'pest_disease_inspection_acceptance PASS = 巡检证据链完整',
  'pest_disease_inspection_acceptance PASS ≠ spray recommendation',
  'pest_disease_inspection_acceptance PASS ≠ spot spray prescription',
  'pest_disease_inspection_acceptance PASS ≠ AO-ACT spray task',
  'SkillRun SUCCESS ≠ pest_disease_inspection_assessment CONFIRMED',
  'pest_disease_signal_v1 is a technical signal, not a formal assessment',
  '巡检证据已通过验收，可作为后续处理建议依据，但不代表已完成防治。',
  '巡检结果已确认，但尚未进入补喷处方。',
  '当前仅为识别信号，不作为正式巡检结论。',
];

function read(rel) {
  const file = path.join(root, rel);
  assert.equal(fs.existsSync(file), true, `missing required file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ');
}

function stripCommentsAndStringsForWriteTargets(source) {
  return stripComments(source)
    .replace(/`(?:\\.|[^`])*`/g, '`template`')
    .replace(/"(?:\\.|[^"])*"/g, '"string"')
    .replace(/'(?:\\.|[^'])*'/g, "'string'");
}

function splitLines(text) {
  return text.split(/\r?\n/);
}

function isAllowedNegativeContext(line) {
  const lower = line.toLowerCase();
  return [
    'does not create',
    'does not equal',
    'does not confirm',
    'not treatment',
    'not a formal assessment',
    'not spray',
    'not_spray',
    'no_spray',
    'does_not_create',
    'must not',
    '不得',
    '禁止',
    '不代表',
    '不作为',
    '尚未进入',
    'forbidden',
    'negative',
    'does_not_create',
    'acceptance_pass_does_not_create',
  ].some((needle) => lower.includes(needle));
}

function isAllowedDocSection(line, sectionName) {
  const lower = line.toLowerCase();
  return sectionName === 'forbidden' || isAllowedNegativeContext(line) || lower.includes('≠') || lower.includes('does not');
}

function docSectionForLine(line) {
  const lower = line.toLowerCase();
  if (lower.includes('forbidden') || lower.includes('does not mean') || lower.includes('does not create') || lower.includes('not treatment')) return 'forbidden';
  return 'normal';
}

function assertAll(text, required, label) {
  const missing = required.filter((x) => !text.includes(x));
  assert.deepEqual(missing, [], `${label} missing required entries: ${missing.join(', ')}`);
}

function assertNoForbiddenWriteTargets(rel, text) {
  const code = stripCommentsAndStringsForWriteTargets(text);
  const illegal = [];
  const writeMatches = [...code.matchAll(/\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|UPSERT\s+INTO|CREATE\s+TABLE|ALTER\s+TABLE)\s+([`"']?)([a-zA-Z0-9_\.]+)/gi)];
  for (const match of writeMatches) {
    const op = String(match[1] ?? '').replace(/\s+/g, ' ').toUpperCase();
    const target = String(match[3] ?? '').toLowerCase();
    if (op === 'INSERT INTO' && target === 'facts') continue;
    illegal.push(`${op} ${target}`);
  }
  assert.deepEqual(illegal, [], `${rel}: P2-C main chain code may only write INSERT INTO facts; found ${illegal.join(', ')}`);
}

function assertCodeForbiddenTerms(rel, text) {
  const lines = splitLines(stripComments(text));
  const violations = [];
  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    for (const term of forbiddenTerms) {
      if (!lower.includes(term.toLowerCase())) continue;
      if (isAllowedNegativeContext(line)) continue;
      violations.push(`${rel}:${idx + 1}: forbidden downstream chain term ${term}`);
    }
  });
  assert.deepEqual(violations, [], `P2-C main chain forbidden code terms:\n${violations.join('\n')}`);
}

function assertCustomerCopySafe(rel, text) {
  const lines = splitLines(stripComments(text));
  const violations = [];
  lines.forEach((line, idx) => {
    for (const phrase of forbiddenCustomerPhrases) {
      if (!line.includes(phrase)) continue;
      if (line.includes('不代表') || line.includes('不是') || line.includes('不得') || line.includes('禁止') || line.includes('not') || line.includes('Forbidden')) continue;
      violations.push(`${rel}:${idx + 1}: customer copy must not imply treatment completion phrase ${phrase}`);
    }
  });
  assert.deepEqual(violations, [], `customer copy treatment-completion violations:\n${violations.join('\n')}`);
}

function assertDocForbiddenTermsOnlyInAllowedContext(text) {
  const lines = splitLines(text);
  const violations = [];
  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    const section = docSectionForLine(line);
    for (const term of forbiddenTerms) {
      if (!lower.includes(term.toLowerCase())) continue;
      if (isAllowedDocSection(line, section)) continue;
      violations.push(`docs/contracts/PEST_DISEASE_MAIN_CHAIN_ALIGNMENT_V1.md:${idx + 1}: forbidden term ${term} outside allowed boundary/forbidden context`);
    }
    for (const phrase of forbiddenCustomerPhrases) {
      if (!line.includes(phrase)) continue;
      if (isAllowedDocSection(line, section) || line.includes('不得表达') || line.includes('Forbidden')) continue;
      violations.push(`docs/contracts/PEST_DISEASE_MAIN_CHAIN_ALIGNMENT_V1.md:${idx + 1}: forbidden customer phrase ${phrase} outside allowed boundary/forbidden context`);
    }
  });
  assert.deepEqual(violations, [], `document forbidden-term context violations:\n${violations.join('\n')}`);
}

function extractFunctionBody(text, functionName) {
  const start = text.indexOf(`function ${functionName}`);
  if (start < 0) return '';
  const braceStart = text.indexOf('{', start);
  if (braceStart < 0) return '';
  let depth = 0;
  for (let i = braceStart; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return text.slice(braceStart, i + 1);
  }
  return text.slice(braceStart);
}

function assertInspectionServiceBoundary(text) {
  const code = stripComments(text);
  assert.equal(/from\s+["'][^"']*ao[_-]?act[^"']*(task|builder|executor|dispatch)[^"']*["']/i.test(code), false, 'inspection service must not import AO-ACT task builder/executor/dispatch module');
  assert.equal(/create[A-Za-z0-9_]*(AoAct|AOACT|ActTask|ActionTask)|dispatch[A-Za-z0-9_]*Command|registerAoAct|post\([^)]*\/api\/v1\/actions\/task/i.test(code), false, 'inspection service must not create or call AO-ACT task/dispatch');
  assertNoForbiddenWriteTargets(files.inspectionService, text);
}

function assertInspectionProjectionBoundary(text) {
  const lower = stripComments(text).toLowerCase();
  const violations = [];
  for (const term of ['spray_prescription', 'spot_spray_prescription', 'spray_recommendation', 'ao_act_task', 'dispatch_command', 'device_command', 'treatment_completed', 'treatment_success', 'spray_completed', 'spray_success', 'pest_control_completed']) {
    if (lower.includes(term)) violations.push(term);
  }
  assert.deepEqual(violations, [], `inspection projection must not generate downstream spray/treatment/execution fields: ${violations.join(', ')}`);
}

function assertReportMergeBoundary(text) {
  const body = extractFunctionBody(text, 'mergePestDiseaseInspectionIntoReport');
  assert.equal(Boolean(body), true, 'reports_v1.ts must contain mergePestDiseaseInspectionIntoReport');
  assert.equal(/execution\s*:\s*|\.execution\.|final_status\s*:/i.test(body), false, 'mergePestDiseaseInspectionIntoReport must not mutate execution.final_status');
  assert.equal(/acceptance\s*:\s*|\.acceptance\.|acceptance\s*\.\s*status|status\s*:\s*["']PASS["']/i.test(body), false, 'mergePestDiseaseInspectionIntoReport must not mutate acceptance.status');
  assert.equal(body.includes('FORMAL_PEST_DISEASE_INSPECTION'), true, 'merge must set FORMAL_PEST_DISEASE_INSPECTION scenario');
}

(function main() {
  const content = Object.fromEntries(scanPaths.map((rel) => [rel, read(rel)]));
  const domain = content[files.domainContract];
  const doc = content[files.mainChainDoc];
  const allBoundaryText = `${domain}\n${doc}\n${content[files.customerLabels]}\n${content[files.formalScenarioVm]}\n${content[files.formalScenarioCards]}`;

  assertAll(doc, [
    'P2-C is Inspection Evidence Chain, not Treatment Chain.',
    'AO-SENSE receipt success does not confirm pest/disease.',
    'SkillRun SUCCESS does not confirm pest/disease.',
    'Inspection acceptance PASS means evidence-chain completeness only.',
    'Inspection acceptance PASS does not create spray recommendation.',
    'Inspection acceptance PASS does not create spot spray prescription.',
    'Inspection acceptance PASS does not create AO-ACT spray task.',
    'Inspection acceptance PASS does not create dispatch command.',
    'Inspection acceptance PASS does not create ROI.',
    'Inspection acceptance PASS does not create Field Memory.',
    'Customer report must say inspection evidence passed, not treatment completed.',
    '巡检证据已通过验收，可作为后续处理建议依据，但不代表已完成防治。',
    '巡检结果已确认，但尚未进入补喷处方。',
    '当前仅为识别信号，不作为正式巡检结论。',
  ], 'PEST_DISEASE_MAIN_CHAIN_ALIGNMENT_V1.md');

  assertAll(allBoundaryText, requiredBoundaryLiterals, 'P2-C main-chain boundary literals');

  assertDocForbiddenTermsOnlyInAllowedContext(doc);
  assertInspectionServiceBoundary(content[files.inspectionService]);
  assertInspectionProjectionBoundary(content[files.inspectionProjection]);
  assertReportMergeBoundary(content[files.reportsRoute]);

  for (const rel of [files.inspectionService, files.inspectionProjection, files.inspectionRoute, files.reportsRoute, files.reportProjection, files.formalE2e, files.reportProjectionGate]) {
    assertCodeForbiddenTerms(rel, content[rel]);
  }

  for (const rel of [files.customerLabels, files.formalScenarioVm, files.formalScenarioCards, files.evidenceVm, files.evidenceComponent]) {
    assertCustomerCopySafe(rel, content[rel]);
  }

  assert.equal(content[files.customerLabels].includes('巡检证据已通过验收，可作为后续处理建议依据，但不代表已完成防治。'), true, 'customer labels must include safe acceptance PASS copy');
  assert.equal(content[files.customerLabels].includes('巡检结果已确认，但尚未进入补喷处方。'), true, 'customer labels must include no spot-spray prescription copy');
  assert.equal(content[files.customerLabels].includes('当前仅为识别信号，不作为正式巡检结论。'), true, 'customer labels must include skill-signal-only copy');
  assert.equal(/treatment[_\s-]?completed|spray[_\s-]?completed|pest[_\s-]?control[_\s-]?completed/i.test(content[files.formalScenarioVm]), false, 'formalScenarioViewModel must not output treatment completed semantics');

  const output = {
    main_chain_alignment: {
      inspection_evidence_chain_not_treatment_chain: true,
      ao_sense_not_execution: true,
      skill_signal_not_assessment: true,
      acceptance_pass_not_spray: true,
      acceptance_pass_not_ao_act: true,
      acceptance_pass_not_roi_or_field_memory: true,
      customer_copy_not_treatment_completed: true,
      report_merge_does_not_mutate_execution_or_acceptance: true,
    },
  };

  console.log(JSON.stringify(output, null, 2));
  console.log('PASS acceptance pest disease main chain alignment v1', { scanned: scanPaths });
})();
