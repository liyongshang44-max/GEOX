#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');

const scanRoots = [
  'apps/server/src/services',
  'apps/server/src/routes',
  'packages/device-skills/src',
  'packages/skill-registry/src',
];

const excludedRoots = [
  'scripts/agronomy_acceptance',
  'scripts/governance_acceptance',
  'scripts/acceptance',
];

const allowedFormalAssessmentWriter = 'apps/server/src/services/inspection/pest_disease_inspection_service_v1.ts';
const contractFile = 'apps/server/src/domain/inspection/pest_disease_inspection_contract_v1.ts';

function toPosix(input) {
  return input.split(path.sep).join('/');
}

function existsDir(rel) {
  return fs.existsSync(path.join(root, rel)) && fs.statSync(path.join(root, rel)).isDirectory();
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (entry.isFile() && /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function readRel(rel) {
  const fp = path.join(root, rel);
  assert.equal(fs.existsSync(fp), true, `missing required file: ${fp}`);
  return fs.readFileSync(fp, 'utf8');
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ');
}

function isSkillRelated(text) {
  return /pest_disease_signal_v1|PestDiseaseSignal|skill_run_id|skill_trace_id|skill_id|SkillRun|skill output|skill_output|signal_type|PEST_SIGNAL|DISEASE_SIGNAL|WEED_SIGNAL|CROP_STRESS_SIGNAL/i.test(text);
}

function isPestDiseaseRelated(text) {
  return /pest_disease|PestDisease|PEST_SIGNAL|DISEASE_SIGNAL|WEED_SIGNAL|CROP_STRESS_SIGNAL/i.test(text);
}

function assertNoForbiddenSkillOutputTerms(files) {
  const forbiddenOutputTerms = [
    'spray_prescription',
    'ao_act_task',
    'dispatch_command',
    'acceptance_result',
    'roi_ledger',
    'field_memory',
  ];
  const violations = [];
  for (const file of files) {
    const rel = toPosix(path.relative(root, file));
    const raw = fs.readFileSync(file, 'utf8');
    const text = stripComments(raw);
    if (!isPestDiseaseRelated(text) && !isSkillRelated(text)) continue;
    for (const term of forbiddenOutputTerms) {
      if (text.includes(term)) {
        violations.push(`${rel}: skill-related pest/disease production code must not contain forbidden output term ${term}`);
      }
    }
  }
  assert.deepEqual(violations, [], `forbidden skill output boundary violations:\n${violations.join('\n')}`);
}

function assertSignalDoesNotWriteAssessment(files) {
  const violations = [];
  for (const file of files) {
    const rel = toPosix(path.relative(root, file));
    const text = stripComments(fs.readFileSync(file, 'utf8'));
    if (!text.includes('pest_disease_signal_v1')) continue;
    const directAssessmentInsert = /INSERT\s+INTO\s+facts[\s\S]{0,1600}pest_disease_inspection_assessment_v1/i.test(text);
    const directAssessmentEnvelope = /type\s*:\s*["']pest_disease_inspection_assessment_v1["']/i.test(text);
    if (rel !== allowedFormalAssessmentWriter && (directAssessmentInsert || directAssessmentEnvelope)) {
      violations.push(`${rel}: pest_disease_signal producer must not write pest_disease_inspection_assessment_v1`);
    }
  }
  assert.deepEqual(violations, [], `signal-to-assessment boundary violations:\n${violations.join('\n')}`);
}

function assertSkillRunSuccessNotConfirmed(files) {
  const violations = [];
  for (const file of files) {
    const rel = toPosix(path.relative(root, file));
    const text = stripComments(fs.readFileSync(file, 'utf8'));
    if (!/SkillRun|skill_run|skillRun|skill_run_id|skill_trace_id|pest_disease_signal_v1/i.test(text)) continue;
    const successToConfirmedPatterns = [
      /SUCCESS[\s\S]{0,240}assessment_status[\s\S]{0,80}CONFIRMED/i,
      /assessment_status[\s\S]{0,80}CONFIRMED[\s\S]{0,240}SUCCESS/i,
      /confidence[\s\S]{0,80}HIGH[\s\S]{0,240}assessment_status[\s\S]{0,80}CONFIRMED/i,
      /assessment_status[\s\S]{0,80}CONFIRMED[\s\S]{0,240}confidence[\s\S]{0,80}HIGH/i,
    ];
    if (successToConfirmedPatterns.some((rx) => rx.test(text))) {
      violations.push(`${rel}: SkillRun SUCCESS or HIGH confidence must not be translated into assessment_status=CONFIRMED`);
    }
  }
  assert.deepEqual(violations, [], `SkillRun success to CONFIRMED violations:\n${violations.join('\n')}`);
}

function assertFormalAssessmentWriter(files) {
  const writers = [];
  for (const file of files) {
    const rel = toPosix(path.relative(root, file));
    const text = stripComments(fs.readFileSync(file, 'utf8'));
    const writesAssessmentFact = /type\s*:\s*["']pest_disease_inspection_assessment_v1["']/.test(text);
    if (writesAssessmentFact) writers.push(rel);
  }
  assert.deepEqual(
    writers,
    [allowedFormalAssessmentWriter],
    `formal pest_disease_inspection_assessment_v1 must be written only by Inspection domain service; writers=${writers.join(', ')}`,
  );
}

function assertScanScope(files) {
  const scannedRel = files.map((f) => toPosix(path.relative(root, f)));
  for (const rel of scannedRel) {
    for (const excluded of excludedRoots) {
      assert.equal(rel.startsWith(`${excluded}/`), false, `gate must not scan excluded acceptance/script path: ${rel}`);
    }
  }
  assert.equal(scannedRel.some((rel) => rel.startsWith('apps/server/src/services/')), true, 'scan must include apps/server/src/services');
  assert.equal(scannedRel.some((rel) => rel.startsWith('apps/server/src/routes/')), true, 'scan must include apps/server/src/routes');
}

(function main() {
  const files = scanRoots
    .filter(existsDir)
    .flatMap((rel) => walk(path.join(root, rel)));

  assertScanScope(files);

  const contract = readRel(contractFile);
  assert.equal(contract.includes('pest_disease_signal_v1'), true, 'contract must define pest_disease_signal_v1');
  assert.equal(contract.includes('pest_disease_inspection_assessment_v1'), true, 'contract must define pest_disease_inspection_assessment_v1');
  assert.equal(contract.includes('SkillRun SUCCESS ≠ pest_disease_inspection_assessment CONFIRMED'), true, 'contract must document SkillRun SUCCESS boundary');
  assert.equal(contract.includes('Pest/Disease AGRONOMY or SENSING Skill output may produce pest_disease_signal_v1 only'), true, 'contract must document skill output boundary');

  assertSignalDoesNotWriteAssessment(files);
  assertSkillRunSuccessNotConfirmed(files);
  assertNoForbiddenSkillOutputTerms(files);
  assertFormalAssessmentWriter(files);

  console.log('PASS acceptance pest disease skill boundary v1', {
    scanRoots,
    excludedRoots,
    scannedFiles: files.length,
    formalAssessmentWriter: allowedFormalAssessmentWriter,
  });
})();
