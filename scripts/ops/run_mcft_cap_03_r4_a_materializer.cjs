'use strict';

const fs = require('node:fs');
const path = require('node:path');

const target = path.join(
  process.cwd(),
  'scripts/ops/materialize_mcft_cap_03_r4_a.cjs',
);
const current = fs.readFileSync(target, 'utf8');
const before = `replaceOnce(
  selectorPath,
  \`    source_unit: sourceUnit,\\n    canonical_unit: "fraction",\\n    conversion_rule: conversionRule,\`,
  \`    source_unit: sourceUnit,\\n    canonical_unit: canonicalUnit,\\n    conversion_rule: conversionRule,\`,
);`;
const after = `replaceOnce(
  selectorPath,
  \`  const contentHash = computeAssimilatedObservationSemanticContentHashV2({\\n    canonical_payload: committedCanonicalPayload,\\n    quality,\\n    source_unit: sourceUnit,\\n    canonical_unit: "fraction",\\n    conversion_rule: conversionRule,\\n    epistemic_class: "OBSERVED",\\n  });\`,
  \`  const contentHash = computeAssimilatedObservationSemanticContentHashV2({\\n    canonical_payload: committedCanonicalPayload,\\n    quality,\\n    source_unit: sourceUnit,\\n    canonical_unit: canonicalUnit,\\n    conversion_rule: conversionRule,\\n    epistemic_class: "OBSERVED",\\n  });\`,
);`;

if (!current.includes(before)) {
  throw new Error('R4_A_MATERIALIZER_SELECTOR_PATCH_SOURCE_NOT_FOUND');
}
if (current.indexOf(before) !== current.lastIndexOf(before)) {
  throw new Error('R4_A_MATERIALIZER_SELECTOR_PATCH_SOURCE_NOT_UNIQUE');
}
fs.writeFileSync(target, current.replace(before, after), 'utf8');
require('./materialize_mcft_cap_03_r4_a.cjs');
