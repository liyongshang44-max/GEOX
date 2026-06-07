import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const failures = [];
const cache = new Map();

function filePath(file) {
  return path.join(appRoot, file);
}

function read(file) {
  if (cache.has(file)) return cache.get(file);
  const fullPath = filePath(file);
  if (!fs.existsSync(fullPath)) {
    failures.push({ file, rule: "missing-file", detail: "Required P2.2 UI closure file is missing." });
    cache.set(file, "");
    return "";
  }
  const text = fs.readFileSync(fullPath, "utf8");
  cache.set(file, text);
  return text;
}

function fail(file, rule, detail) {
  failures.push({ file, rule, detail });
}

function expectPattern(file, pattern, rule, detail) {
  const text = read(file);
  if (!text) return;
  if (!pattern.test(text)) fail(file, rule, detail);
}

function expectNotPattern(file, pattern, rule, detail) {
  const text = read(file);
  if (!text) return;
  if (pattern.test(text)) fail(file, rule, detail);
}

function expectPatterns(file, patterns, rule) {
  for (const item of patterns) expectPattern(file, item.pattern, rule, item.detail);
}

function expectFiles(files) {
  for (const file of files) read(file);
}

function runNestedCheck(label, scriptName) {
  const result = spawnSync(process.execPath, [path.join(scriptDir, scriptName)], {
    cwd: appRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    fail(`scripts/${scriptName}`, `${label}-failed`, `${label} failed. ${String(result.stderr || result.stdout || "").trim()}`);
  }
}

function expectPermissionGate({ file, key, label }) {
  const text = read(file);
  if (!text) return;
  const actionPattern = new RegExp(`permissionKey=["']${key}["']|hasOperatorPermission\\(session, ["']${key}["']\\)`);
  if (!actionPattern.test(text)) fail(file, "operator-write-permission-missing", `${file} must gate write actions by ${key}.`);

  const literalLabelPattern = new RegExp(label);
  const permissionReasonPattern = new RegExp(`permissionReason\\(session, ["']${key}["']\\)`);
  const localPermissionReasonPattern = new RegExp(`permissionReason\\([^)]*["']${label}["'][^)]*\\)`);
  if (!literalLabelPattern.test(text) && !permissionReasonPattern.test(text) && !localPermissionReasonPattern.test(text)) {
    fail(file, "operator-permission-reason-missing", `${file} must expose standard permission text for ${label} either literally or through permissionReason(session, "${key}").`);
  }
}

expectFiles([
  "src/api/operatorEvidence.ts",
  "src/api/weather.ts",
  "src/api/operatorSkillTrace.ts",
  "src/components/FieldGisMap.tsx",
  "src/components/customer/WeatherInterferencePanel.tsx",
  "src/components/customer/CustomerExportBlocks.tsx",
  "src/components/operator/LearningClosurePanel.tsx",
  "src/components/operator/PermissionGate.tsx",
  "src/viewmodels/operatorLearningClosureVm.ts",
  "src/views/OperationReportPage.tsx",
  "src/views/FieldReportPage.tsx",
  "src/views/operator/OperatorEvidencePage.tsx",
  "src/views/operator/OperatorApprovalsPage.tsx",
  "src/views/operator/OperatorDispatchPage.tsx",
  "src/views/operator/OperatorAcceptancePage.tsx",
  "src/views/operator/OperatorDevicesAlertsPage.tsx",
  "src/views/operator/OperatorFieldMemoryPage.tsx",
  "src/views/operator/OperatorRoiLedgerPage.tsx",
  "scripts/check-customer-export-same-source.mjs",
]);

expectPatterns("src/api/operatorEvidence.ts", [
  { pattern: /\/api\/v1\/operator\/evidence\/export-jobs/, detail: "Evidence export must use the official operator export-jobs API." },
  { pattern: /operation_id/, detail: "Evidence export job creation must carry operation_id." },
  { pattern: /from_ts_ms/, detail: "Evidence export job creation must carry from_ts_ms." },
  { pattern: /to_ts_ms/, detail: "Evidence export job creation must carry to_ts_ms." },
], "evidence-export-api-incomplete");

expectPatterns("src/views/operator/OperatorEvidencePage.tsx", [
  { pattern: /createOperatorEvidenceExportJob/, detail: "OperatorEvidencePage must reference createOperatorEvidenceExportJob." },
  { pattern: /fetchSessionMe/, detail: "OperatorEvidencePage must reference fetchSessionMe before write actions." },
  { pattern: /hasOperatorPermission/, detail: "OperatorEvidencePage must reference hasOperatorPermission for session permission checks." },
  { pattern: /PermissionGate/, detail: "Evidence export action must use PermissionGate." },
  { pattern: /permissionKey=["']export_evidence["']/, detail: "Evidence export action must be gated by export_evidence." },
  { pattern: /缺少会话权限：operator_evidence_export/, detail: "Evidence export permission denial must use the standard text." },
  { pattern: /fetchOperatorEvidenceJobDetail/, detail: "Evidence page must support job detail refresh/polling." },
  { pattern: /sha256/, detail: "Evidence page must surface sha256 when returned by backend." },
], "evidence-delivery-ui-incomplete");

expectPatterns("src/components/FieldGisMap.tsx", [
  { pattern: /type\s+LayerKey/, detail: "FieldGisMap must declare typed layer keys." },
  { pattern: /地块边界/, detail: "FieldGisMap must expose field boundary legend/layer text." },
  { pattern: /计划区域/, detail: "FieldGisMap must expose planned layer legend/layer text." },
  { pattern: /实际覆盖/, detail: "FieldGisMap must expose coverage layer legend/layer text." },
  { pattern: /设备轨迹|实际执行轨迹/, detail: "FieldGisMap must expose trajectory layer legend/layer text." },
  { pattern: /验收点/, detail: "FieldGisMap must expose acceptance point legend/layer text." },
  { pattern: /暂无可渲染空间图层/, detail: "FieldGisMap must show a formal empty state instead of fake GIS data." },
], "spatial-gis-ui-incomplete");

expectPatterns("src/views/OperationReportPage.tsx", [
  { pattern: /EvidencePackMetadataBlock/, detail: "OperationReportPage must reference EvidencePackMetadataBlock for evidence download/checksum state." },
  { pattern: /OperationSpatialExecutionPanel/, detail: "Operation report must render a spatial execution panel." },
  { pattern: /asApplied|as_applied/, detail: "Operation report must keep as-applied display logic." },
  { pattern: /plannedGeoJson/, detail: "Operation spatial panel must support planned geometry." },
  { pattern: /coverageGeoJson/, detail: "Operation spatial panel must support actual coverage geometry." },
  { pattern: /trajectorySegments/, detail: "Operation spatial panel must support execution trajectory." },
  { pattern: /计划-实际偏差待补充证据来源/, detail: "Operation spatial deviation must not be treated as evidence without evidence_ref." },
  { pattern: /WeatherInterferencePanel/, detail: "OperationReportPage must reference WeatherInterferencePanel." },
  { pattern: /FieldMemoryPanel/, detail: "OperationReportPage must reference FieldMemoryPanel." },
  { pattern: /fetchOperationEnvironmentContext/, detail: "Operation report must read operation environment context through the adapter." },
  { pattern: /operation-skill-trace/, detail: "Operation report must expose a skill trace technical anchor." },
], "operation-closure-ui-incomplete");

expectPatterns("src/views/FieldReportPage.tsx", [
  { pattern: /FieldGisMap/, detail: "FieldReportPage must reference FieldGisMap." },
  { pattern: /plannedGeoJson=\{vm\.mapLayers\.plannedGeoJson\}/, detail: "Field report must pass operation planned layer to the map from VM adapter." },
  { pattern: /coverageGeoJson=\{vm\.mapLayers\.coverageGeoJson\}/, detail: "Field report must pass as-applied coverage layer to the map from VM adapter." },
  { pattern: /markers=\{vm\.mapLayers\.deviceMarkers\}/, detail: "Field report must pass device markers from VM adapter." },
  { pattern: /trajectorySegments=\{vm\.mapLayers\.trajectorySegments\}/, detail: "Field report must pass trajectory segments from VM adapter." },
  { pattern: /acceptancePoints=\{vm\.mapLayers\.acceptancePoints\}/, detail: "Field report must pass acceptance points from VM adapter." },
  { pattern: /FieldWeatherSummaryCard/, detail: "Field report must render a weather summary card." },
], "field-closure-ui-incomplete");

expectNotPattern("src/views/FieldReportPage.tsx", /plannedGeoJson=\{null\}|coverageGeoJson=\{null\}|markers=\{\[\]\}|trajectorySegments=\{\[\]\}|acceptancePoints=\{\[\]\}/, "field-map-fixed-empty-layer", "FieldReportPage must not pass fixed empty planned/coverage/device/trajectory/acceptance layers to FieldGisMap.");

expectPatterns("src/api/weather.ts", [
  { pattern: /fetchWeatherHistory/, detail: "Weather API client must expose fetchWeatherHistory." },
  { pattern: /fetchWeatherForecast/, detail: "Weather API client must expose fetchWeatherForecast." },
  { pattern: /fetchOperationEnvironmentContext/, detail: "Weather API client must expose operation environment context." },
  { pattern: /unavailable/, detail: "Weather adapter must preserve unavailable as a formal state." },
], "weather-api-client-incomplete");

expectPatterns("src/components/customer/WeatherInterferencePanel.tsx", [
  { pattern: /天气用于辅助解释和学习排除/, detail: "Weather panel must state its decision boundary." },
  { pattern: /不直接替代验收结论/, detail: "Weather panel must not let weather override acceptance." },
  { pattern: /降雨/, detail: "Weather panel must explain rainfall interference." },
], "weather-ui-boundary-incomplete");

expectPatterns("src/api/operatorSkillTrace.ts", [
  { pattern: /\/api\/v1\/operator\/skill-traces/, detail: "Skill trace adapter must use official operator skill-traces API." },
  { pattern: /\/api\/v1\/operator\/skill-performance/, detail: "Skill performance adapter must use official operator skill-performance API." },
  { pattern: /skill trace 查询接口未接入。/, detail: "Skill trace adapter must return formal not-ready empty state." },
], "skill-trace-adapter-incomplete");

expectPatterns("src/components/operator/LearningClosurePanel.tsx", [
  { pattern: /作业结果 → 证据 → 验收 → ROI → Field Memory → Skill \/ Rule Performance/, detail: "Learning closure panel must show the full closure chain." },
  { pattern: /operatorLearningClosureActions/, detail: "Learning closure panel must render cross-links." },
], "learning-closure-panel-incomplete");

expectPatterns("src/viewmodels/operatorLearningClosureVm.ts", [
  { pattern: /因降雨干扰，本次结果未进入灌溉效果学习。/, detail: "Learning closure VM must explain rainfall-based learning exclusion." },
  { pattern: /learningEffectiveText/, detail: "Learning closure VM must expose learning effectiveness." },
  { pattern: /performanceText/, detail: "Learning closure VM must expose Skill\/Rule Performance text." },
], "learning-closure-vm-incomplete");

expectPatterns("src/views/operator/OperatorFieldMemoryPage.tsx", [
  { pattern: /LearningClosurePanel/, detail: "Field Memory page must render LearningClosurePanel." },
  { pattern: /fetchOperatorSkillTraces/, detail: "Field Memory page must connect Skill Trace for operation-level closure." },
  { pattern: /fetchOperatorRoiLedger/, detail: "Field Memory page must link back to ROI." },
], "field-memory-learning-closure-incomplete");

expectPatterns("src/views/operator/OperatorRoiLedgerPage.tsx", [
  { pattern: /LearningClosurePanel/, detail: "ROI page must render LearningClosurePanel." },
  { pattern: /fetchOperatorFieldMemory/, detail: "ROI page must link back to Field Memory." },
  { pattern: /fetchOperatorSkillPerformance/, detail: "ROI page must connect Skill\/Rule Performance." },
], "roi-learning-closure-incomplete");

expectPatterns("src/components/operator/PermissionGate.tsx", [
  { pattern: /permissionKey/, detail: "PermissionGate must carry a permission key." },
  { pattern: /allowed/, detail: "PermissionGate must support allowed." },
  { pattern: /loading/, detail: "PermissionGate must support loading." },
  { pattern: /disabledReason/, detail: "PermissionGate must support disabledReason." },
  { pattern: /fallback/, detail: "PermissionGate must support fallback." },
], "permission-gate-incomplete");

const permissionPages = [
  { file: "src/views/operator/OperatorApprovalsPage.tsx", key: "approve", label: "operator_approve" },
  { file: "src/views/operator/OperatorDispatchPage.tsx", key: "dispatch", label: "operator_dispatch" },
  { file: "src/views/operator/OperatorAcceptancePage.tsx", key: "acceptance", label: "operator_acceptance" },
  { file: "src/views/operator/OperatorEvidencePage.tsx", key: "export_evidence", label: "operator_evidence_export" },
  { file: "src/views/operator/OperatorDevicesAlertsPage.tsx", key: "ack", label: "operator_alert_ack_close" },
  { file: "src/views/operator/OperatorDevicesAlertsPage.tsx", key: "close_alert", label: "operator_alert_ack_close" },
];

for (const page of permissionPages) expectPermissionGate(page);

expectPatterns("src/views/operator/OperatorDevicesAlertsPage.tsx", [
  { pattern: /revoke_device_credential/, detail: "Device credential revoke must be gated by revoke_device_credential." },
  { pattern: /revoke 默认只读或管理员可见/, detail: "Normal operator must not see clickable revoke action." },
], "device-alerts-permission-incomplete");

expectPatterns("src/components/customer/CustomerExportBlocks.tsx", [
  { pattern: /buildCustomerFieldReportMainVisualVm/, detail: "Field export must derive report-backed rows from CustomerReportMainVisualVm." },
  { pattern: /buildCustomerOperationReportMainVisualVm/, detail: "Operation export must derive report-backed rows from CustomerReportMainVisualVm." },
  { pattern: /mainVisual\.rows\.map/, detail: "Report-backed exports must render CustomerReportMainVisualVm.rows." },
], "customer-export-same-source-incomplete");

expectPatterns("src/views/CustomerReportExportPage.tsx", [
  { pattern: /fetchFieldReport\(fieldId\)/, detail: "Unified export page must fetch field report from customer report API." },
  { pattern: /fetchOperationReport\(operationId\)/, detail: "Unified export page must fetch operation report from customer report API." },
  { pattern: /<FieldExportBlocks vm=\{vm\} report=\{report\} \/>/, detail: "Unified export page must pass same field report payload into FieldExportBlocks." },
  { pattern: /<OperationExportBlocks vm=\{vm\} report=\{report\} \/>/, detail: "Unified export page must pass same operation report payload into OperationExportBlocks." },
], "customer-export-page-not-same-source");

expectPatterns("scripts/check-customer-export-same-source.mjs", [
  { pattern: /fetchOperatorEvidence/, detail: "Same-source check must ban operator evidence API calls in export pages." },
  { pattern: /fetchOperatorSkillTraces/, detail: "Same-source check must ban operator skill trace API calls in export pages." },
  { pattern: /fetchWeatherHistory/, detail: "Same-source check must ban direct weather API calls in export pages." },
  { pattern: /buildCustomerOperationReportMainVisualVm/, detail: "Same-source check must require operation CustomerReportMainVisualVm." },
  { pattern: /buildCustomerFieldReportMainVisualVm/, detail: "Same-source check must require field CustomerReportMainVisualVm." },
  { pattern: /customerC8FormalReportVm/, detail: "Same-source check must ban C8-only VM dependency from export blocks." },
], "same-source-check-incomplete");

expectPatterns("package.json", [
  { pattern: /"check:customer-export-same-source"/, detail: "Package scripts must expose customer export same-source check." },
  { pattern: /"check:p2-full-closure-ui"/, detail: "Package scripts must expose check:p2-full-closure-ui." },
], "package-script-incomplete");

const exportFiles = [
  "src/views/CustomerReportExportPage.tsx",
  "src/views/FieldReportExportPage.tsx",
  "src/views/CustomerDashboardExportPage.tsx",
  "src/components/customer/CustomerExportBlocks.tsx",
];

for (const file of exportFiles) {
  expectNotPattern(file, /\.\.\/api\/weather|\.\.\/api\/operatorEvidence|\.\.\/api\/operatorSkillTrace|\.\.\/api\/admin|\.\.\/api\/debug|legacy\/control|raw_telemetry/, "export-forbidden-api", `${file} must not import weather/operator/debug/admin/legacy APIs.`);
  expectNotPattern(file, /FieldGisMap/, "export-must-not-render-map", `${file} must not render maps in export mode; it should render same-source status text only.`);
  expectNotPattern(file, /type:\s*["']FeatureCollection["']/, "export-must-not-fabricate-geojson", `${file} must not fabricate GeoJSON.`);
}

runNestedCheck("customer export same-source", "check-customer-export-same-source.mjs");

if (failures.length > 0) {
  console.error("❌ P2 full closure UI gate failed:");
  for (const failure of failures) console.error(` - ${failure.file} [${failure.rule}] ${failure.detail}`);
  process.exit(1);
}

console.log("✅ P2 full closure UI gate passed.");
