// .cap04-s6/patch_interfaces.cjs
// Purpose: apply bounded S6 compatibility edits before diagnostic Typecheck.
// Temporary file; removed before final candidate.

'use strict';

const fs = require('node:fs');

function replaceOnce(file, oldText, newText) {
  let text = fs.readFileSync(file, 'utf8');
  if (text.includes(newText)) return false;
  if (!text.includes(oldText)) throw new Error(`PATCH_MARKER_NOT_FOUND:${file}`);
  text = text.replace(oldText, newText);
  fs.writeFileSync(file, text, 'utf8');
  return true;
}

let changed = false;

changed = replaceOnce(
  'apps/server/src/runtime/twin_runtime/ports.ts',
  '  latest_successful_forecast_ref: null;',
  '  latest_successful_forecast_ref: string | null;',
) || changed;

changed = replaceOnce(
  'apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts',
  `    if (checkpoint.payload.successful_forecast_ref !== null) {\n      throw new Error("SUCCESSFUL_FORECAST_POINTER_UNEXPECTED");\n    }\n\n    return {`,
  `    const latestSuccessfulForecastRaw = checkpoint.payload.successful_forecast_ref;\n    if (latestSuccessfulForecastRaw !== null\n      && (typeof latestSuccessfulForecastRaw !== "string" || !latestSuccessfulForecastRaw.trim())) {\n      throw new Error("SUCCESSFUL_FORECAST_POINTER_INVALID");\n    }\n    const latestSuccessfulForecastRef = latestSuccessfulForecastRaw as string | null;\n    if (latestSuccessfulForecastRef !== null\n      && latestSuccessfulForecastRef !== previousForecastResultRef) {\n      throw new Error("SUCCESSFUL_FORECAST_POINTER_RESULT_MISMATCH");\n    }\n\n    return {`,
) || changed;

changed = replaceOnce(
  'apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.ts',
  '      latest_successful_forecast_ref: null,',
  '      latest_successful_forecast_ref: latestSuccessfulForecastRef,',
) || changed;

changed = replaceOnce(
  'apps/server/src/runtime/twin_runtime/forecast_scenario_persistence_ports_v1.ts',
  `  readScenarioSet(scenarioSetId: string): Promise<Cap04ScenarioSetRecordV1 | null>;\n\n  detectPendingScenario`,
  `  readScenarioSet(scenarioSetId: string): Promise<Cap04ScenarioSetRecordV1 | null>;\n\n  readScenarioSetBySourceForecast(\n    sourceForecastRef: string,\n    sourceForecastHash: string,\n  ): Promise<Cap04ScenarioSetRecordV1 | null>;\n\n  detectPendingScenario`,
) || changed;

changed = replaceOnce(
  'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts',
  `  async readScenarioSet(scenarioSetId: string): Promise<Cap04ScenarioSetRecordV1 | null> {\n    const client = await this.pool.connect();\n    try {\n      return await this.readScenarioSetWithClientV1(client, scenarioSetId);\n    } finally {\n      client.release();\n    }\n  }\n\n  async commitScenarioSet(`,
  `  async readScenarioSet(scenarioSetId: string): Promise<Cap04ScenarioSetRecordV1 | null> {\n    const client = await this.pool.connect();\n    try {\n      return await this.readScenarioSetWithClientV1(client, scenarioSetId);\n    } finally {\n      client.release();\n    }\n  }\n\n  async readScenarioSetBySourceForecast(\n    sourceForecastRef: string,\n    sourceForecastHash: string,\n  ): Promise<Cap04ScenarioSetRecordV1 | null> {\n    const result = await this.pool.query(\n      \`SELECT scenario_set_id FROM twin_scenario_set_uniqueness_v1\n       WHERE source_forecast_ref=$1 AND source_forecast_hash=$2 LIMIT 2\`,\n      [sourceForecastRef, sourceForecastHash],\n    );\n    if (result.rows.length === 0) return null;\n    if (result.rows.length !== 1) throw new Error("CAP04_B_SOURCE_FORECAST_UNIQUENESS_CORRUPT");\n    return this.readScenarioSet(String(result.rows[0].scenario_set_id));\n  }\n\n  async commitScenarioSet(`,
) || changed;

const service = 'apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts';
changed = replaceOnce(
  service,
  'import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";',
  'import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";\nimport { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";',
) || changed;

changed = replaceOnce(
  service,
  `  crop_stage_context: ContinuationCropStageConfigurationContextV1;\n}): Cap04RuntimeConfigPayloadV1 {`,
  `  crop_stage_context: ContinuationCropStageConfigurationContextV1;\n  require_parent_match: boolean;\n}): Cap04RuntimeConfigPayloadV1 {`,
) || changed;

changed = replaceOnce(
  service,
  `  if (payload.parent_runtime_config_ref !== input.handoff.previous_state_runtime_config_ref\n    || payload.parent_runtime_config_hash !== input.handoff.previous_state_runtime_config_hash) {\n    throw new Error("CAP04_SINGLE_TICK_PARENT_RUNTIME_CONFIG_MISMATCH");\n  }`,
  `  if (input.require_parent_match\n    && (payload.parent_runtime_config_ref !== input.handoff.previous_state_runtime_config_ref\n      || payload.parent_runtime_config_hash !== input.handoff.previous_state_runtime_config_hash)) {\n    throw new Error("CAP04_SINGLE_TICK_PARENT_RUNTIME_CONFIG_MISMATCH");\n  }`,
) || changed;

changed = replaceOnce(
  service,
  `function assertNextHandoffV1(input: {`,
  `function resolveCropStageV1(\n  context: ContinuationCropStageConfigurationContextV1,\n  logicalTime: string,\n): { stage_code: string; kc: number } {\n  const match = context.crop_stage_schedule.filter((entry) =>\n    entry.effective_from <= logicalTime && logicalTime < entry.effective_to\n  );\n  if (match.length !== 1) throw new Error("CAP04_SINGLE_TICK_CROP_STAGE_CARDINALITY");\n  return { stage_code: match[0].stage_code, kc: match[0].kc };\n}\n\nfunction assertNextHandoffV1(input: {`,
) || changed;

changed = replaceOnce(
  service,
  `    let aRecordSet = await this.persistence.lookupARecordSet(requestedIdentity.idempotency_key);\n    if (aRecordSet) {`,
  `    let aRecordSet = await this.persistence.lookupARecordSet(requestedIdentity.idempotency_key);\n    const aExistedInitially = aRecordSet !== null;\n    if (aRecordSet) {`,
) || changed;

changed = replaceOnce(
  service,
  `      handoff: aRecordSet ? await this.handoffService.prepareNextTickInput(input.scope) : initialHandoff,\n      crop_stage_context: input.crop_stage_context,\n    });`,
  `      handoff: aRecordSet ? await this.handoffService.prepareNextTickInput(input.scope) : initialHandoff,\n      crop_stage_context: input.crop_stage_context,\n      require_parent_match: !aRecordSet,\n    });`,
) || changed;

changed = replaceOnce(
  service,
  `      const forcing = selectCap04FutureForcingWindowV1({\n        scope: input.scope,\n        logical_time: logicalTime,\n        candidate_records: candidateRecords,\n        authorized_binding_ids: input.authorized_future_forcing_binding_ids,\n        crop_stage_context: {\n          ref: config.crop_stage_context.context_ref,\n          hash: config.crop_stage_context.context_hash,\n          crop_stage_code: input.crop_stage_context.stage_code,\n          kc: input.crop_stage_context.kc,\n        },`,
  `      const recoveredCropStage = resolveCropStageV1(input.crop_stage_context, logicalTime);\n      const forcing = selectCap04FutureForcingWindowV1({\n        scope: input.scope,\n        logical_time: logicalTime,\n        candidate_records: candidateRecords,\n        authorized_binding_ids: input.authorized_future_forcing_binding_ids,\n        crop_stage_context: {\n          ref: config.crop_stage_context.context_ref,\n          hash: config.crop_stage_context.context_hash,\n          crop_stage_code: recoveredCropStage.stage_code,\n          kc: recoveredCropStage.kc,\n        },`,
) || changed;

changed = replaceOnce(
  service,
  `      if (JSON.stringify(forecastMath.forecast_payload) !== JSON.stringify(existingForecast.payload)) {`,
  `      if (canonicalJsonV1(forecastMath.forecast_payload) !== canonicalJsonV1(existingForecast.payload)) {`,
) || changed;

changed = replaceOnce(
  service,
  `    let bRecord = await this.persistence.lookupScenarioSet(scenarioCandidate.idempotency_key);\n    let recoveredPendingScenario = Boolean(aRecordSet && !bRecord && initialHandoff.next_logical_tick_time !== logicalTime);`,
  `    let bRecord = await this.persistence.lookupScenarioSet(scenarioCandidate.idempotency_key);\n    const recoveredPendingScenario = aExistedInitially && bRecord === null;`,
) || changed;

console.log(changed ? 'patched S6 interfaces' : 'S6 interfaces already patched');
