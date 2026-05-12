const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const TOKEN = process.env.ADMIN_TOKEN || process.env.AO_ACT_TOKEN || process.env.AO_ACT_ADMIN_TOKEN || 'set-via-env-or-external-secret-file-admin';
const OPERATION_ID = process.env.OPERATION_ID || 'ft_op_ft_ui_2_skills';

async function getJson(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { authorization: `Bearer ${TOKEN}` } });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json, text };
}

function reportOf(payload) {
  return payload?.operation_report_v1 || payload || {};
}

function nonEmpty(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function containsWeather(text) {
  return /weather|rainfall|interference|rain/i.test(String(text || ''));
}

(async () => {
  const resp = await getJson(`/api/v1/reports/operation/${encodeURIComponent(OPERATION_ID)}`);
  const report = reportOf(resp.json);
  const roi = report.roi || {};
  const checks = {
    api_ok: resp.ok,
    recommendation_value_hypothesis_present: nonEmpty(report.recommendation?.value_hypothesis),
    prescription_value_projection_present: nonEmpty(report.prescription?.value_projection),
    operation_report_roi_status_present: nonEmpty(roi.status),
    operation_report_roi_customer_safe_text_present: nonEmpty(roi.customer_safe_text),
    roi_hypothesis_present: nonEmpty(roi.hypothesis),
    roi_projection_present: nonEmpty(roi.projection),
  };

  const learning = String(report.learning_closure || report.learning || report.weather_learning_excluded_reason || roi.status || '').toUpperCase();
  const weatherExcluded = learning === 'EXCLUDED_WEATHER' || String(roi.status || '').toUpperCase() === 'EXCLUDED_WEATHER';
  const weatherChecks = weatherExcluded ? {
    weather_excluded_status: String(roi.status || '').toUpperCase() === 'EXCLUDED_WEATHER',
    exclusion_reason_mentions_weather: containsWeather(roi.exclusion_reason || report.weather_learning_excluded_reason || report.learning_excluded_reason),
  } : { skipped: true };

  const output = {
    ok: Object.values(checks).every(Boolean) && (weatherChecks.skipped || Object.values(weatherChecks).every(Boolean)),
    suite: 'ACCEPTANCE_VALUE_CHAIN_ROI_V1',
    operation_id: OPERATION_ID,
    checks,
    weather_checks: weatherChecks,
    summary: {
      recommendation_id: report.recommendation?.recommendation_id || null,
      value_hypothesis: report.recommendation?.value_hypothesis || null,
      prescription_id: report.prescription?.prescription_id || null,
      value_projection: report.prescription?.value_projection || null,
      roi_status: roi.status || null,
      roi_customer_safe_text: roi.customer_safe_text || null,
      exclusion_reason: roi.exclusion_reason || null,
      ledger_items_count: Array.isArray(roi.ledger_items) ? roi.ledger_items.length : 0,
    },
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!output.ok) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
