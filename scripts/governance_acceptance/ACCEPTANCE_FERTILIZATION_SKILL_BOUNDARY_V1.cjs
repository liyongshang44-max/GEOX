const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = process.cwd();

function full(rel) {
  return path.join(root, rel);
}

function normalizeRelPath(rel) {
  return String(rel ?? '').replace(/\\/g, '/');
}

function read(rel) {
  const fp = full(rel);
  assert.equal(fs.existsSync(fp), true, `missing required file: ${rel}`);
  return fs.readFileSync(fp, 'utf8');
}

function collectFiles(dir, suffixes = ['.ts', '.cjs', '.mjs', '.js']) {
  const start = full(dir);
  if (!fs.existsSync(start)) return [];
  const out = [];
  for (const entry of fs.readdirSync(start, { withFileTypes: true })) {
    const fp = path.join(start, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(path.relative(root, fp), suffixes));
    else if (entry.isFile() && suffixes.some((suffix) => fp.endsWith(suffix))) out.push(normalizeRelPath(path.relative(root, fp)));
  }
  return out;
}

function assertIncludes(text, needle, label) {
  assert.equal(text.includes(needle), true, `${label} missing ${needle}`);
}

function assertNotRegex(text, pattern, label) {
  assert.equal(pattern.test(text), false, `${label} matched forbidden pattern ${pattern}`);
}

function hasActualFactsInsert(text) {
  return /INSERT\s+INTO\s+facts/i.test(text);
}

function hasFactTypeWriteLiteral(text, factType) {
  return new RegExp(`type:\\s*["']${factType}["']`).test(text)
    || new RegExp(`type["']?\\s*[:=]\\s*["']${factType}["']`).test(text)
    || new RegExp(`record_json[\\s\\S]{0,240}${factType}`).test(text);
}

function isPathUnder(rel, dir) {
  return normalizeRelPath(rel).startsWith(normalizeRelPath(dir));
}

function assertOnlyAuthorizedFactsWriter(files, factType, allowedPathPredicates, label) {
  const offenders = [];
  for (const rel of files.map(normalizeRelPath)) {
    const text = read(rel);
    if (!hasActualFactsInsert(text)) continue;
    if (!hasFactTypeWriteLiteral(text, factType)) continue;
    if (allowedPathPredicates.some((fn) => fn(rel))) continue;
    offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `${label} unauthorized fact writers: ${offenders.join(', ')}`);
}

const serviceRel = 'apps/server/src/services/fertilization/fertilization_service_v1.ts';
const routeRel = 'apps/server/src/routes/v1/fertilization.ts';
const deviceSkillsRel = 'packages/device-skills/src/index.ts';
const fertilityCoreRel = 'packages/device-skills/src/fertility_inference_core_v1.ts';
const acceptanceSkillsRel = 'apps/server/src/domain/acceptance/skills.ts';
const skillConstitutionRel = 'docs/governance/GEOX_SKILL_CONSTITUTION_V1.md';
const fertilizationContractRel = 'apps/server/src/domain/fertilization/fertilization_contract_v1.ts';

const service = read(serviceRel);
const route = read(routeRel);
const deviceSkills = read(deviceSkillsRel);
const fertilityCore = read(fertilityCoreRel);
const acceptanceSkills = read(acceptanceSkillsRel);
const constitution = read(skillConstitutionRel);
const fertilizationContract = read(fertilizationContractRel);

// 1. Fertilization business facts must be written by the Fertilization domain service.
assertIncludes(service, 'export class FertilizationServiceV1', 'fertilization service');
assertIncludes(service, 'INSERT INTO facts', 'fertilization service append-only writer');
assertIncludes(service, 'type: "fertilization_recommendation_v1"', 'fertilization recommendation writer');
assertIncludes(service, 'type: "fertilization_prescription_v1"', 'fertilization prescription writer');
assertIncludes(service, 'type: "fertilization_acceptance_v1"', 'fertilization acceptance writer');
assertIncludes(service, 'type: "nitrogen_need_assessment_v1"', 'nitrogen assessment writer');
assertIncludes(route, 'new FertilizationServiceV1(pool)', 'fertilization route uses domain service');

const sourceFiles = [
  ...collectFiles('apps/server/src', ['.ts']),
  ...collectFiles('packages', ['.ts']),
];

assertOnlyAuthorizedFactsWriter(
  sourceFiles,
  'fertilization_recommendation_v1',
  [(rel) => rel === serviceRel],
  'fertilization_recommendation_v1',
);
assertOnlyAuthorizedFactsWriter(
  sourceFiles,
  'fertilization_prescription_v1',
  [(rel) => rel === serviceRel],
  'fertilization_prescription_v1',
);
assertOnlyAuthorizedFactsWriter(
  sourceFiles,
  'fertilization_acceptance_v1',
  [
    (rel) => rel === serviceRel,
    (rel) => isPathUnder(rel, 'apps/server/src/domain/acceptance'),
    (rel) => isPathUnder(rel, 'apps/server/src/services/acceptance'),
  ],
  'fertilization_acceptance_v1',
);

// 2. Fertility/nitrogen inference skills must not directly write or declare formal fertilization recommendations.
const skillCandidateFiles = sourceFiles.filter((rel) => {
  const text = fs.readFileSync(full(rel), 'utf8');
  return text.includes('fertility_inference_v1') || text.includes('nitrogen_need_inference_v1');
});
assert.equal(skillCandidateFiles.length >= 1, true, 'expected at least one fertility/nitrogen inference skill candidate file');
for (const rel of skillCandidateFiles) {
  const text = fs.readFileSync(full(rel), 'utf8');
  assert.equal(hasActualFactsInsert(text), false, `${rel} must not insert facts directly`);
  assert.equal(text.includes('fertilization_recommendation_v1'), false, `${rel} must not emit fertilization_recommendation_v1 directly`);
  assert.equal(text.includes('fertilization_prescription_v1'), false, `${rel} must not emit fertilization_prescription_v1 directly`);
  assert.equal(text.includes('fertilization_acceptance_v1'), false, `${rel} must not emit fertilization_acceptance_v1 directly`);
}
assertIncludes(deviceSkills, 'fertility_inference_v1', 'device skill registry');
assertIncludes(fertilityCore, 'inferFertilityFromDeviceObservationV1', 'fertility inference core');

// 3. SkillRun SUCCESS must not be translated into LOW_N_RISK by service or scripts.
const serviceAndScriptFiles = [
  ...collectFiles('apps/server/src/services', ['.ts']),
  ...collectFiles('scripts', ['.cjs', '.mjs', '.js', '.ts']),
];
const skillRunToLowNRiskPatterns = [
  /SkillRun\s+SUCCESS\s*(?:=>|->|=|===|:)\s*["']?LOW_N_RISK/i,
  /skill_run_status[\s\S]{0,120}SUCCESS[\s\S]{0,120}LOW_N_RISK/i,
  /skillRunStatus[\s\S]{0,120}SUCCESS[\s\S]{0,120}LOW_N_RISK/i,
  /status\s*[:=]\s*["']LOW_N_RISK["'][\s\S]{0,160}(?:skill_run|skillRun|SkillRun)/i,
];
for (const rel of serviceAndScriptFiles) {
  const text = fs.readFileSync(full(rel), 'utf8');
  for (const pattern of skillRunToLowNRiskPatterns) {
    assertNotRegex(text, pattern, rel);
  }
}

// 4. Skill outputs must stay inside Skill Constitution boundaries.
assertIncludes(constitution, 'SkillRun SUCCESS != Recommendation成立', 'skill constitution');
assertIncludes(constitution, 'SkillRun SUCCESS != Prescription成立', 'skill constitution');
assertIncludes(constitution, 'SkillRun SUCCESS != Acceptance PASS', 'skill constitution');
assertIncludes(fertilizationContract, 'SkillRun SUCCESS ≠ nitrogen_need_assessment LOW_N_RISK', 'fertilization contract hard rule');

const skillImplementationFiles = [
  ...collectFiles('packages/device-skills/src', ['.ts']),
  ...collectFiles('packages/skill-registry/src', ['.ts']),
  'apps/server/src/domain/acceptance/skills.ts',
].map(normalizeRelPath).filter((rel, index, arr) => fs.existsSync(full(rel)) && arr.indexOf(rel) === index);

const forbiddenSkillOutputPatterns = [
  /approval[_\s-]*decision/i,
  /ao[_-]?act[_\s-]*task/i,
  /dispatch[_\s-]*command/i,
  /roi[_\s-]*(ledger|result|formal|customer)/i,
  /field[_\s-]*memory/i,
  /customer[_\s-]*success/i,
];
for (const rel of skillImplementationFiles) {
  const text = fs.readFileSync(full(rel), 'utf8');
  for (const pattern of forbiddenSkillOutputPatterns) {
    assertNotRegex(text, pattern, rel);
  }
}

// 5. The existing same-name AcceptanceSkill must remain a signal producer, not a formal fact writer.
assertIncludes(acceptanceSkills, 'skill_id: "fertilization_acceptance_v1"', 'acceptance skill registry');
assert.equal(hasActualFactsInsert(acceptanceSkills), false, 'AcceptanceSkill must not insert formal facts directly');
assert.equal(hasFactTypeWriteLiteral(acceptanceSkills, 'fertilization_acceptance_v1'), false, 'AcceptanceSkill must not declare formal fertilization_acceptance_v1 fact type');
assertIncludes(fertilizationContract, 'AcceptanceSkill skill_id=fertilization_acceptance_v1 is only an acceptance_signal producer', 'fertilization contract skill boundary note');

console.log('PASS acceptance fertilization skill boundary v1', {
  serviceRel,
  routeRel,
  skillCandidateFiles: skillCandidateFiles.length,
  serviceAndScriptFiles: serviceAndScriptFiles.length,
  skillImplementationFiles: skillImplementationFiles.length,
  guardedFactTypes: [
    'fertilization_recommendation_v1',
    'fertilization_prescription_v1',
    'fertilization_acceptance_v1',
  ],
});