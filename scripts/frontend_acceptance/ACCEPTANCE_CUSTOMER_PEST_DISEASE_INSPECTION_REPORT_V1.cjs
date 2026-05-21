#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const files = {
  projection: path.join(root, 'apps/server/src/services/inspection/pest_disease_inspection_projection_v1.ts'),
  reportSchema: path.join(root, 'apps/server/src/projections/report_v1.ts'),
  operationReportPage: path.join(root, 'apps/web/src/views/OperationReportPage.tsx'),
  exportBlocks: path.join(root, 'apps/web/src/components/customer/CustomerExportBlocks.tsx'),
  formalCards: path.join(root, 'apps/web/src/components/customer/FormalScenarioCards.tsx'),
};

function read(file) {
  assert.equal(fs.existsSync(file), true, `missing required file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}
function assertAll(text, required, label) {
  const missing = required.filter((x) => !text.includes(x));
  assert.deepEqual(missing, [], `${label} missing required entries: ${missing.join(', ')}`);
}
function assertNone(text, blocked, label) {
  const found = blocked.filter((x) => text.includes(x));
  assert.deepEqual(found, [], `${label} contains blocked entries: ${found.join(', ')}`);
}
function extractFunctionBody(text, signatureStart) {
  const start = text.indexOf(signatureStart);
  assert.notEqual(start, -1, `unable to locate function signature: ${signatureStart}`);
  const braceStart = text.indexOf('{', start);
  assert.notEqual(braceStart, -1, `unable to locate function opening brace: ${signatureStart}`);
  let depth = 0;
  for (let i = braceStart; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(braceStart + 1, i);
    }
  }
  assert.fail(`unable to extract function body: ${signatureStart}`);
}

(function main() {
  const projection = read(files.projection);
  const reportSchema = read(files.reportSchema);
  const operationReportPage = read(files.operationReportPage);
  const exportBlocks = read(files.exportBlocks);
  const formalCards = read(files.formalCards);
  const pdiSectionBody = extractFunctionBody(operationReportPage, 'function buildPestDiseaseInspectionSections(report: OperationReportV1): PestDiseaseSection[]');
  const pdiAuditBody = extractFunctionBody(operationReportPage, 'function PestDiseaseAuditChain({ report }: { report: OperationReportV1 }): React.ReactElement');
  const operationExportBody = extractFunctionBody(exportBlocks, 'export function OperationExportBlocks({ vm, report }: { vm: OperationReportPageVm; report?: OperationReportV1 | null }): React.ReactElement');

  assertAll(projection, [
    'observation_evidence',
    'latest_observation',
    'media_refs',
    'captured_at_ts',
    'captured_at_text',
    'geo_point',
    'device_profile',
    'scout_note',
    'pest_count',
    'incidence_percent',
    'severity_percent',
    'affected_area_percent',
    'evidence_quality',
    'customer_visible_eligible',
    'blocking_reasons',
  ], 'PDI projection observation_evidence fields');

  assertAll(reportSchema, [
    'OperationReportPestDiseaseInspectionV1',
    'PestDiseaseInspectionReportProjectionV1',
    'pest_disease_inspection?: OperationReportPestDiseaseInspectionV1',
    '"FORMAL_PEST_DISEASE_INSPECTION"',
  ], 'Operation Report schema PDI exposure');

  assertAll(operationReportPage, [
    'function buildPestDiseaseInspectionSections(report: OperationReportV1): PestDiseaseSection[]',
    'observation_evidence',
    'latest_observation',
    'media_refs',
    'captured_at_text',
    'captured_at_ts',
    'geo_point',
    'device_profile',
    'scout_note',
    'incidence_percent',
    'severity_percent',
    'affected_area_percent',
    '图片/媒体证据',
    '采集时间',
    '定位点',
    '设备来源',
    '现场备注',
    '发生率',
    '严重度比例',
    '影响面积',
    '巡检证据已通过验收，可作为后续处理建议依据，但不代表已完成防治。',
    '当前仅完成巡检证据链；是否补喷、用药、派发执行任务，需进入后续正式决策链路。',
  ], 'OperationReportPage PDI observation evidence display');

  assertAll(formalCards, [
    '巡检证据汇总',
    '图片/媒体',
    '定位证据',
    '人工复核',
    '严重度',
    '置信度',
  ], 'FormalScenarioCards PDI summary');

  assertAll(exportBlocks, [
    'pdiEvidenceBasisRows',
    'operation_report_v1.pest_disease_inspection.observation_evidence',
    'observation_evidence',
    'latest_observation',
    'media_refs',
    'captured_at_text',
    'captured_at_ts',
    'geo_point',
    'device_profile',
    'scout_note',
    'incidence_percent',
    'severity_percent',
    'affected_area_percent',
    '病虫害巡检观察证据',
    '图片/媒体证据',
    '采集时间',
    '采集位置',
    '采集设备',
    '现场备注',
    '发生率',
    '严重度',
    '影响面积',
    '巡检证据通过 ≠ 已执行喷药',
    '巡检证据通过 ≠ 防治闭环已结束',
    '巡检证据通过 ≠ ROI / Field Memory',
  ], 'Customer export PDI same-source observation evidence');

  const blockedPositiveTreatmentTerms = [
    '已喷药',
    '已防治',
    '防治完成',
    '喷药完成',
    '病虫害已解决',
    '作物风险已解除',
  ];
  assertNone(pdiSectionBody, blockedPositiveTreatmentTerms, 'OperationReportPage PDI section treatment-complete forbidden claims');
  assertNone(pdiAuditBody, blockedPositiveTreatmentTerms, 'OperationReportPage PDI audit treatment-complete forbidden claims');
  assertNone(operationExportBody, blockedPositiveTreatmentTerms, 'Customer export PDI treatment-complete forbidden claims');

  console.log('PASS acceptance customer pest disease inspection report v1', files);
})();
