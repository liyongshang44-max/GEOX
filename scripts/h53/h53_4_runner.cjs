'use strict';

const { readInputs } = require('./h53_4_reader.cjs');
const { SOURCE, VERSION, buildRecommendation } = require('./h53_4_recommendation_candidate_model.cjs');
const { writeRecommendation } = require('./h53_4_writer.cjs');

async function main() {
  const dryRun = !process.argv.includes('--apply');
  const { stateRow, forecastRow, scenarioRow } = await readInputs();
  const record = buildRecommendation(stateRow, forecastRow, scenarioRow);
  const writeResult = dryRun ? null : await writeRecommendation(record);
  console.log(JSON.stringify({ ok: true, derivation: 'DERIVE_H53_4_RECOMMENDATION_CANDIDATE_V1', dry_run: dryRun, source: SOURCE, version: VERSION, recommendation: record.payload, write_result: writeResult }, null, 2));
}

module.exports = { main };
