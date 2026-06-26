'use strict';

// scripts/h53/DERIVE_H53_4_RECOMMENDATION_CANDIDATE_V1.cjs
// Purpose: entrypoint for H53.4 recommendation candidate derivation.

const { main } = require('./h53_4_recommendation_candidate_main.cjs');

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, derivation: 'DERIVE_H53_4_RECOMMENDATION_CANDIDATE_V1', error: error.message }, null, 2));
  process.exit(1);
});
