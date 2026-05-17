#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OPERATION_VIEW = 'apps/web/src/views/OperationReportPage.tsx';
const EVIDENCE_COMPONENT = 'apps/web/src/components/evidence/index.tsx';

function read(relPath) {
  const abs = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(abs)) throw new Error(`missing required file: ${relPath}`);
  return fs.readFileSync(abs, 'utf8');
}

function mustContain(text, pattern, message) {
  if (!pattern.test(text)) throw new Error(message);
}

function main() {
  const operation = read(OPERATION_VIEW);
  const evidence = read(EVIDENCE_COMPONENT);

  mustContain(operation, /<EvidenceGapPanel\s+vm=\{evidenceVm\}\s+mode="customer"\s*\/>/, 'OperationReportPage customer main view must use <EvidenceGapPanel vm={evidenceVm} mode="customer" />');
  mustContain(operation, /<details>[\s\S]*展开技术详情[\s\S]*<\/details>/, 'OperationReportPage must keep technical details in a <details> block');
  mustContain(evidence, /证据信任级别：\{vm\.trustText\}/, 'EvidenceTrustLegend must render customer-safe vm.trustText');

  const ids = ['operation_id', 'recommendation_id', 'prescription_id', 'approval_request_id', 'act_task_id', 'receipt_id', 'missing_links'];
  const techBlockMatch = operation.match(/<section className="operationTechDetailsMuted">[\s\S]*?<\/section>/);
  if (!techBlockMatch) throw new Error('OperationReportPage missing operationTechDetailsMuted section');
  const techBlock = techBlockMatch[0];

  for (const id of ids) {
    if (!techBlock.includes(`${id}：`)) throw new Error(`technical details must include ${id}`);
  }

  const mainView = operation.split('<section className="operationTechDetailsMuted">')[0];
  for (const id of ids) {
    if (mainView.includes(`${id}：`)) throw new Error(`raw field leaked into customer main view: ${id}`);
  }

  console.log('ACCEPTANCE_CUSTOMER_TECHNICAL_DETAILS_BOUNDARY_V1 passed');
}

try { main(); } catch (error) {
  console.error('ACCEPTANCE_CUSTOMER_TECHNICAL_DETAILS_BOUNDARY_V1 failed');
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
}
