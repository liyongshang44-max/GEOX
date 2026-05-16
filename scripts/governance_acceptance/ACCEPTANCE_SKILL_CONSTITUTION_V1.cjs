const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function fail(msg) { console.error(`[ACCEPTANCE_SKILL_CONSTITUTION_V1] FAIL: ${msg}`); process.exit(1); }
function assert(cond, msg) { if (!cond) fail(msg); }
function includesAll(text, xs, label) { for (const x of xs) assert(text.includes(x), `${label} missing ${x}`); }

const constitution = read('docs/governance/GEOX_SKILL_CONSTITUTION_V1.md');
const safety = read('docs/security/GEOX_SKILL_SAFETY_BOUNDARY_V1.md');
const contracts = read('packages/contracts/src/skills/skill_contract_v1.ts');
const security = read('apps/server/src/auth/skill_security_v1.ts');
const registry = read('apps/server/src/domain/skill_registry/facts.ts');
const pkg = read('package.json');

includesAll(constitution, [
  'v1.0-draft / governance proposal',
  'does not immediately override the current code contract',
  'SkillRun SUCCESS != Operation成功',
  'AO-SENSE receipt != AO-ACT receipt',
  'SENSING', 'AGRONOMY', 'DEVICE', 'ACCEPTANCE', 'CONTROL', 'OPS', 'OBSERVABILITY',
  'roi        -> legacy ROI technical signal',
  'other      -> legacy only',
  'Skill expands capability.',
  'Contract preserves trust.',
], 'constitution');

includesAll(safety, [
  'docs/governance/GEOX_SKILL_CONSTITUTION_V1.md',
  '如有冲突，以 Skill Constitution 为准',
], 'subordinate safety boundary note');

includesAll(contracts, [
  'SkillCanonicalCategoryV1',
  'SkillCanonicalCategoryValuesV1',
  'normalizeSkillCategoryToCanonicalV1',
  'isLegacySkillCategoryV1',
  'roi: "OPS"',
  'other: "OBSERVABILITY"',
], 'contracts category normalization');

includesAll(security, [
  'normalizeSkillCategoryToCanonicalV1',
  'export type SkillCategoryV1 = SkillCanonicalCategoryV1',
  'SKILL_CATEGORY_BOUNDARY_VIOLATION',
  'SKILL_OUTPUT_FORBIDDEN_ACTION',
], 'server skill security');

includesAll(registry, [
  '"SENSING"',
  'normalizeSkillCategoryToCanonicalV1',
  'category: normalizeCategory(input.category)',
  'INVALID_TRIGGER_STAGE: before_approval is deprecated',
], 'skill registry canonical category');

includesAll(pkg, [
  'ci:governance:skill-constitution',
  'ci:governance:full-base-contract',
], 'package governance scripts');

console.log('[ACCEPTANCE_SKILL_CONSTITUTION_V1] PASSED');
