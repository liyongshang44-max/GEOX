const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function fail(msg) { console.error(`[ACCEPTANCE_SKILL_CATEGORY_BOUNDARY_V1] FAIL: ${msg}`); process.exit(1); }
function assert(cond, msg) { if (!cond) fail(msg); }
function includesAll(text, xs, label) { for (const x of xs) assert(text.includes(x), `${label} missing ${x}`); }

const contracts = read('packages/contracts/src/skills/skill_contract_v1.ts');
const security = read('apps/server/src/auth/skill_security_v1.ts');
const registry = read('apps/server/src/domain/skill_registry/facts.ts');
const openapi = read('apps/server/src/routes/openapi_v1.ts');

includesAll(contracts, [
  '| "sensing"', '| "agronomy"', '| "device"', '| "acceptance"', '| "roi"', '| "other"',
  '| "SENSING"', '| "AGRONOMY"', '| "DEVICE"', '| "ACCEPTANCE"', '| "CONTROL"', '| "OPS"', '| "OBSERVABILITY"',
  'roi: "OPS"', 'other: "OBSERVABILITY"', 'normalizeSkillCategoryToCanonicalV1', 'isLegacySkillCategoryV1'
], 'contracts category contract');

includesAll(security, [
  'normalizeSkillCategoryToCanonicalV1(input.category)',
  'category === "AGRONOMY"',
  'category === "DEVICE"',
  'category === "ACCEPTANCE"',
  'category === "OPS"',
  'category === "CONTROL"',
  '["SENSING", "OBSERVABILITY"].includes(category)',
], 'skill security category gates');

includesAll(registry, [
  'const SKILL_CATEGORY_VALUES = ["SENSING", "AGRONOMY", "OPS", "CONTROL", "OBSERVABILITY", "DEVICE", "ACCEPTANCE"] as const',
  'function normalizeCategory',
  'normalizeSkillCategoryToCanonicalV1(value)',
  'before_approval is deprecated',
], 'registry canonical categories');

assert(!registry.includes('const SKILL_CATEGORY_VALUES = ["AGRONOMY", "OPS", "CONTROL", "OBSERVABILITY", "DEVICE", "ACCEPTANCE"]'), 'registry must not omit SENSING category');
assert(openapi.includes('SkillBindingCreateRequest'), 'OpenAPI must expose skill binding request schema');
assert(openapi.includes('SkillRunsResponse'), 'OpenAPI must expose skill run response schema');

console.log('[ACCEPTANCE_SKILL_CATEGORY_BOUNDARY_V1] PASSED');
