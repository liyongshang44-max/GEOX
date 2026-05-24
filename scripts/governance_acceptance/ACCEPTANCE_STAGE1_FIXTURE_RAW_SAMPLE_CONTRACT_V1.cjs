const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const fixturePath = path.join(root, 'scripts', 'agronomy_acceptance', '_stage1_formal_irrigation_fixture.cjs');
const fixture = fs.readFileSync(fixturePath, 'utf8');

function fail(message, detail) {
  console.error(`[stage1-fixture-raw-sample-contract] FAIL: ${message}`);
  if (detail !== undefined) console.error(JSON.stringify(detail, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

const compact = fixture.replace(/\s+/g, ' ');

assert(!fixture.includes("qc_quality: 'good'"), 'fixture must not use illegal qc_quality good');
assert(!fixture.includes('qc_quality: "good"'), 'fixture must not use illegal qc_quality good');
assert(fixture.includes("qc_quality: 'ok'") || fixture.includes('qc_quality: "ok"'), 'fixture must use qc_quality ok');

const illegalQualityRegexes = [
  /qc_quality\s*:\s*['"]good['"]/,
  /qc_quality\s*:\s*['"]pass['"]/,
  /qc_quality\s*:\s*['"]healthy['"]/,
];
for (const re of illegalQualityRegexes) {
  assert(!re.test(fixture), `fixture contains illegal raw sample quality matching ${re}`);
}

const rawSampleInsert = fixture.match(/INSERT INTO raw_samples[\s\S]*?VALUES[\s\S]*?ON CONFLICT \(sample_id\) DO NOTHING/);
assert(rawSampleInsert, 'fixture must insert raw_samples through explicit raw_samples insert');
assert(rawSampleInsert[0].includes('qc_quality'), 'raw_samples insert must include qc_quality column');
assert(rawSampleInsert[0].includes('source'), 'raw_samples insert must include source column');

const illegalSourceRegexes = [
  /source\s*:\s*['"]sim['"]/,
  /source\s*:\s*['"]simulation['"]/,
  /source\s*:\s*['"]debug['"]/,
  /source\s*:\s*['"]flight_table['"]/,
  /source\s*:\s*['"]human['"]/,
  /source\s*:\s*['"]import['"]/,
  /source\s*:\s*['"]unknown['"]/,
];
for (const re of illegalSourceRegexes) {
  assert(!re.test(fixture), `fixture contains non-formal raw sample source matching ${re}`);
}

assert(/source\s*:\s*['"]device['"]/.test(fixture), 'fixture must use formal raw sample source device');
assert(!compact.includes('ALTER TABLE raw_samples'), 'fixture must not alter raw_samples contract');
assert(!compact.includes('raw_samples_qc_quality_v1_check'), 'fixture must not modify raw_samples qc constraint');

assert(!/now_ms\s*\+/.test(fixture), 'fixture must not create future raw sample timestamps from now_ms + ...');
assert(!compact.includes('now_ms - staleOffset - (5 * 60 * 60 * 1000) +'), 'fixture must not use old now_ms - 5h boundary sample window');
assert(fixture.includes('SAMPLE_WINDOW_START_BUFFER_MS'), 'fixture must define an explicit safe sample window start buffer');
assert(fixture.includes('((5 * 60) + 50) * 60 * 1000'), 'fixture must use 5h50m sample window start buffer');
assert(fixture.includes('FORMAL_SAMPLE_INTERVAL_MS'), 'fixture must define explicit formal sample interval');
assert(fixture.includes('FORMAL_SAMPLE_POINT_COUNT = 12'), 'fixture must keep 12 formal sample time points');

assert(fixture.includes('seedFormalCropContextV1'), 'fixture must export seedFormalCropContextV1');
assert(fixture.includes("type: 'crop_context_v1'"), 'crop context fixture must use type crop_context_v1');
assert(fixture.includes("status: 'PLANTED_CONFIRMED'"), 'crop context fixture must use PLANTED_CONFIRMED');
assert(fixture.includes("crop_code = 'corn'"), 'crop context fixture default crop_code must be corn');
assert(fixture.includes("crop_stage = 'V8'"), 'crop context fixture default crop_stage must be V8');
assert(fixture.includes("fixture: 'commercial_mvp0_crop_context'"), 'crop context fixture must identify commercial_mvp0_crop_context');
assert(!compact.includes("record = { type: 'crop_context_v1', tenant_id"), 'crop context fields must not be written at record root');
assert(compact.includes('payload: { tenant_id, project_id, group_id, field_id, season_id'), 'crop context tenant/project/group/field/season must be under payload');

async function assertDynamicFormalWindowAndCropContext() {
  const { seedFormalCropContextV1, seedFormalIrrigationStage1Evidence } = require(fixturePath);
  assert(typeof seedFormalCropContextV1 === 'function', 'seedFormalCropContextV1 must be exported as a function');
  assert(typeof seedFormalIrrigationStage1Evidence === 'function', 'seedFormalIrrigationStage1Evidence must be exported as a function');

  const nowMs = 1_800_000_000_000;
  const rawSamples = [];
  const cropContextFacts = [];
  const pool = {
    async query(sql, params = []) {
      if (String(sql).includes('INSERT INTO raw_samples')) {
        rawSamples.push({
          sample_id: params[0],
          sensor_id: params[1],
          ts_ms: Number(params[2]),
          metric: params[3],
          value: params[4],
          qc_quality: params[5],
          source: params[6],
          payload_json: JSON.parse(params[7]),
        });
      }
      if (String(sql).includes('INSERT INTO facts')) {
        const record = JSON.parse(params[2]);
        if (record?.type === 'crop_context_v1') {
          cropContextFacts.push({ fact_id: params[0], occurred_at_ts_ms: params[1], source: 'acceptance_fixture', record });
        }
      }
      return { rows: [], rowCount: 0 };
    },
  };

  await seedFormalIrrigationStage1Evidence(pool, {
    tenant_id: 'tenantA',
    project_id: 'projectA',
    group_id: 'groupA',
    field_id: 'field_gap_closure_1800000000000',
    device_id: 'device_stage1_fixture_contract',
    now_ms: nowMs,
    sample_mode: 'formal',
  });

  assert(rawSamples.length === 48, 'formal fixture must create 48 raw samples', { count: rawSamples.length });
  assert(rawSamples.every((x) => x.qc_quality === 'ok'), 'formal fixture raw samples must all use qc_quality ok');
  assert(rawSamples.every((x) => x.source === 'device'), 'formal fixture raw samples must all use source device');
  assert(rawSamples.every((x) => x.ts_ms <= nowMs), 'formal fixture must not create future raw samples', {
    future_samples: rawSamples.filter((x) => x.ts_ms > nowMs).slice(0, 5),
  });

  const timePoints = [...new Set(rawSamples.map((x) => x.ts_ms))].sort((a, b) => a - b);
  assert(timePoints.length === 12, 'formal fixture must create 12 unique raw sample time points', { time_points: timePoints.length });

  const minTs = timePoints[0];
  const maxTs = timePoints[timePoints.length - 1];
  const minAllowed = nowMs - ((5 * 60 + 30) * 60 * 1000);
  const maxAllowed = nowMs - (5 * 60 * 1000);
  assert(minTs <= minAllowed, 'formal fixture first sample must be at least 5h30m before now_ms', { min_ts: minTs, min_allowed: minAllowed, now_ms: nowMs });
  assert(maxTs <= maxAllowed, 'formal fixture last sample must be at least 5m before now_ms', { max_ts: maxTs, max_allowed: maxAllowed, now_ms: nowMs });

  const gaps = [];
  for (let i = 1; i < timePoints.length; i += 1) gaps.push(timePoints[i] - timePoints[i - 1]);
  const maxGap = Math.max(...gaps);
  assert(maxGap <= 30 * 60 * 1000, 'formal fixture adjacent time point gap must be <= 30m', { max_gap_ms: maxGap, gaps });

  const expectedFirst = nowMs - ((5 * 60 + 50) * 60 * 1000);
  const expectedLast = nowMs - (20 * 60 * 1000);
  assert(minTs === expectedFirst, 'formal fixture first sample must use 5h50m start buffer', { min_ts: minTs, expected_first: expectedFirst });
  assert(maxTs === expectedLast, 'formal fixture last sample must land at now_ms - 20m', { max_ts: maxTs, expected_last: expectedLast });

  assert(cropContextFacts.length >= 1, 'formal irrigation fixture must seed crop_context_v1 before recommendation generate');
  const cropPayload = cropContextFacts[0].record.payload;
  assert(cropContextFacts[0].record.type === 'crop_context_v1', 'crop context fact type must be crop_context_v1');
  assert(cropPayload.tenant_id === 'tenantA', 'crop context tenant_id must be under payload');
  assert(cropPayload.project_id === 'projectA', 'crop context project_id must be under payload');
  assert(cropPayload.group_id === 'groupA', 'crop context group_id must be under payload');
  assert(cropPayload.field_id === 'field_gap_closure_1800000000000', 'crop context field_id must be under payload');
  assert(cropPayload.season_id === 'season_gap_closure_1800000000000', 'crop context season_id must be under payload and match field fixture');
  assert(cropPayload.status === 'PLANTED_CONFIRMED', 'crop context status must be PLANTED_CONFIRMED');
  assert(cropPayload.crop_code === 'corn', 'crop context crop_code must be corn');
  assert(cropPayload.crop_stage === 'V8', 'crop context crop_stage must be V8');
  assert(cropPayload.source === 'USER_DECLARED', 'crop context source must be USER_DECLARED');
}

assertDynamicFormalWindowAndCropContext()
  .then(() => console.log('[stage1-fixture-raw-sample-contract] PASS'))
  .catch((error) => fail(error instanceof Error ? error.message : String(error)));
