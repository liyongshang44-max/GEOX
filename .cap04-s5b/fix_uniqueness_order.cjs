// .cap04-s5b/fix_uniqueness_order.cjs
// Purpose: make cross-variant terminal uniqueness precede stale predecessor CAS and enable the existing B record validator, then self-delete.

'use strict';

const fs = require('node:fs');
const file = 'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts';
let text = fs.readFileSync(file, 'utf8');

const oldImport = 'import { validateCap04ARecordSetV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";';
const newImport = `import {
  validateCap04ARecordSetV1,
  validateCap04ScenarioSetRecordV1,
} from "../../domain/twin_runtime/forecast_scenario_record_set_validator_v1.js";`;
if (!text.includes(oldImport)) throw new Error('S5B_VALIDATOR_IMPORT_MARKER_NOT_FOUND');
text = text.replace(oldImport, newImport);

const oldOrder = `      await this.verifyLeaseV1(client, input.scope, input.lease);
      await this.verifyAExpectedPointersV1(client, input.scope, input.expected, input.record_set);
      const terminal = await client.query(
        \`SELECT record_set_id,aggregate_determinism_hash FROM twin_terminal_tick_uniqueness_v1
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
           AND lineage_id=$7 AND revision_id=$8 AND logical_time=$9::timestamptz FOR UPDATE\`,
        [...scopeValuesV1(input.scope), input.record_set.operation_key.lineage_id, input.record_set.operation_key.revision_id, input.record_set.operation_key.logical_time],
      );
      if (terminal.rows.length !== 0) throw new Error("TERMINAL_TICK_VARIANT_CONFLICT");`;
const newOrder = `      await this.verifyLeaseV1(client, input.scope, input.lease);
      const terminal = await client.query(
        \`SELECT record_set_id,aggregate_determinism_hash FROM twin_terminal_tick_uniqueness_v1
         WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6
           AND lineage_id=$7 AND revision_id=$8 AND logical_time=$9::timestamptz FOR UPDATE\`,
        [...scopeValuesV1(input.scope), input.record_set.operation_key.lineage_id, input.record_set.operation_key.revision_id, input.record_set.operation_key.logical_time],
      );
      if (terminal.rows.length !== 0) throw new Error("TERMINAL_TICK_VARIANT_CONFLICT");
      await this.verifyAExpectedPointersV1(client, input.scope, input.expected, input.record_set);`;
if (!text.includes(oldOrder)) throw new Error('S5B_TERMINAL_ORDER_MARKER_NOT_FOUND');
text = text.replace(oldOrder, newOrder);

const oldBValidation = `      const sourcePayload = sourceForecast.payload as unknown as Cap04ForecastRunPayloadV1;
      if (sourcePayload.status !== "COMPLETED" || sourcePayload.scenario_eligible !== true) throw new Error("CAP04_B_COMPLETED_FORECAST_REQUIRED");
      validateCap04ScenarioSetPayloadV1(scenario.payload, sourcePayload);
      await this.verifyRuntimeConfigV1(client, scenario.payload.runtime_config_ref, scenario.payload.runtime_config_hash);`;
const newBValidation = `      const sourcePayload = sourceForecast.payload as unknown as Cap04ForecastRunPayloadV1;
      if (sourcePayload.status !== "COMPLETED" || sourcePayload.scenario_eligible !== true) throw new Error("CAP04_B_COMPLETED_FORECAST_REQUIRED");
      validateCap04ScenarioSetRecordV1(input.record, sourceForecast);
      validateCap04ScenarioSetPayloadV1(scenario.payload, sourcePayload);
      await this.verifyRuntimeConfigV1(client, scenario.payload.runtime_config_ref, scenario.payload.runtime_config_hash);`;
if (!text.includes(oldBValidation)) throw new Error('S5B_B_VALIDATION_MARKER_NOT_FOUND');
text = text.replace(oldBValidation, newBValidation);

fs.writeFileSync(file, text, 'utf8');
fs.unlinkSync(__filename);
console.log('applied S5B uniqueness-order and B-validator fixes');
