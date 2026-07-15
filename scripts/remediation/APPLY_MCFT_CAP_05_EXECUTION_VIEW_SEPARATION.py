# scripts/remediation/APPLY_MCFT_CAP_05_EXECUTION_VIEW_SEPARATION.py
# Purpose: generate the exact source diff for the approved CAP-05 post-closure execution-view separation remediation inside an isolated CI checkout.
# Boundary: deterministic text transformation only; no repository push, network write, database access, Runtime execution, canonical object write, active binding, model activation, calibration, or CAP-06 authority.

from pathlib import Path
import subprocess


def replace_once(path_text: str, old: str, new: str) -> None:
    path = Path(path_text)
    text = path.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"PATCH_MARKER_NOT_FOUND:{path_text}")
    path.write_text(text.replace(old, new, 1))


forecast = "apps/server/src/runtime/twin_runtime/forecast_scenario_single_tick_service_v1.ts"
replace_once(
    forecast,
    'import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";',
    'import { validateCanonicalObjectV1, type CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";',
)
replace_once(
    forecast,
    '''import {
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";''',
    '''import type { Cap04RuntimeConfigPayloadV1 } from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import {
  DirectCap04ExecutionConfigResolverV1,
  type Cap04ExecutionConfigResolverPortV1,
  type ResolvedCap04ExecutionConfigV1,
} from "../../domain/twin_runtime/runtime_config_execution_view_v1.js";''',
)
replace_once(
    forecast,
    '''function assertConfigV1(input: {
  config: CanonicalObjectEnvelopeV1;
  expected_ref: string;
  expected_hash: string;
  scope: TwinScopeKeyV1;
  logical_time: string;
  handoff: PreparedNextTickInputV1;
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  require_parent_match: boolean;
}): Cap04RuntimeConfigPayloadV1 {
  if (input.config.object_id !== input.expected_ref) throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_REF_PIN_MISMATCH");
  if (input.config.determinism_hash !== input.expected_hash) throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_HASH_PIN_MISMATCH");
  if (input.config.object_type !== "twin_runtime_config_v1") throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  exactScopeV1(input.config, input.scope, "CAP04_SINGLE_TICK_RUNTIME_CONFIG_SCOPE_MISMATCH");
  validateCap04RuntimeConfigPayloadV1(input.config.payload);
  const payload = input.config.payload as unknown as Cap04RuntimeConfigPayloadV1;
  if (payload.effective_logical_time !== input.logical_time) throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_EFFECTIVE_TIME_MISMATCH");
  if (input.require_parent_match
    && (payload.parent_runtime_config_ref !== input.handoff.previous_state_runtime_config_ref
      || payload.parent_runtime_config_hash !== input.handoff.previous_state_runtime_config_hash)) {
    throw new Error("CAP04_SINGLE_TICK_PARENT_RUNTIME_CONFIG_MISMATCH");
  }
  if (payload.reality_binding_ref !== input.handoff.reality_binding_ref
    || payload.reality_binding_hash !== input.handoff.reality_binding_hash) {
    throw new Error("CAP04_SINGLE_TICK_REALITY_BINDING_MISMATCH");
  }
  if (input.crop_stage_context.configuration_matrix_hash !== payload.configuration_matrix_hash) {
    throw new Error("CAP04_SINGLE_TICK_CROP_STAGE_CONFIGURATION_MATRIX_MISMATCH");
  }
  return payload;
}''',
    '''function assertCanonicalConfigEnvelopeV1(input: {
  config: CanonicalObjectEnvelopeV1;
  expected_ref: string;
  expected_hash: string;
  scope: TwinScopeKeyV1;
}): void {
  validateCanonicalObjectV1(input.config);
  if (input.config.object_id !== input.expected_ref) throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_REF_PIN_MISMATCH");
  if (input.config.determinism_hash !== input.expected_hash) throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_HASH_PIN_MISMATCH");
  if (input.config.object_type !== "twin_runtime_config_v1") throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  exactScopeV1(input.config, input.scope, "CAP04_SINGLE_TICK_RUNTIME_CONFIG_SCOPE_MISMATCH");
}

function assertResolvedConfigV1(input: {
  canonical_config: CanonicalObjectEnvelopeV1;
  resolved: ResolvedCap04ExecutionConfigV1;
  logical_time: string;
  handoff: PreparedNextTickInputV1;
  crop_stage_context: ContinuationCropStageConfigurationContextV1;
  require_parent_match: boolean;
}): Cap04RuntimeConfigPayloadV1 {
  if (input.resolved.source_config_ref !== input.canonical_config.object_id) {
    throw new Error("CAP04_SINGLE_TICK_EXECUTION_CONFIG_SOURCE_REF_MISMATCH");
  }
  if (input.resolved.source_config_hash !== input.canonical_config.determinism_hash) {
    throw new Error("CAP04_SINGLE_TICK_EXECUTION_CONFIG_SOURCE_HASH_MISMATCH");
  }
  const payload = input.resolved.payload;
  if (payload.effective_logical_time !== input.logical_time) throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_EFFECTIVE_TIME_MISMATCH");
  if (input.require_parent_match
    && (payload.parent_runtime_config_ref !== input.handoff.previous_state_runtime_config_ref
      || payload.parent_runtime_config_hash !== input.handoff.previous_state_runtime_config_hash)) {
    throw new Error("CAP04_SINGLE_TICK_PARENT_RUNTIME_CONFIG_MISMATCH");
  }
  if (payload.reality_binding_ref !== input.handoff.reality_binding_ref
    || payload.reality_binding_hash !== input.handoff.reality_binding_hash) {
    throw new Error("CAP04_SINGLE_TICK_REALITY_BINDING_MISMATCH");
  }
  if (input.crop_stage_context.configuration_matrix_hash !== payload.configuration_matrix_hash) {
    throw new Error("CAP04_SINGLE_TICK_CROP_STAGE_CONFIGURATION_MATRIX_MISMATCH");
  }
  return payload;
}''',
)
replace_once(
    forecast,
    '''    private readonly runtimeConfigRepository: RuntimeConfigRepositoryPortV1,
    private readonly persistence: Cap04SingleTickPersistencePortV1,
  ) {}''',
    '''    private readonly runtimeConfigRepository: RuntimeConfigRepositoryPortV1,
    private readonly persistence: Cap04SingleTickPersistencePortV1,
    private readonly executionConfigResolver: Cap04ExecutionConfigResolverPortV1 = new DirectCap04ExecutionConfigResolverV1(),
  ) {}''',
)
replace_once(
    forecast,
    '''    const runtimeConfig = await this.runtimeConfigRepository.readRuntimeConfig(runtimeConfigRef);
    if (!runtimeConfig) throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_NOT_FOUND");
    const config = assertConfigV1({
      config: runtimeConfig,
      expected_ref: runtimeConfigRef,
      expected_hash: runtimeConfigHash,
      scope: input.scope,
      logical_time: logicalTime,
      handoff: aRecordSet ? await this.handoffService.prepareNextTickInput(input.scope) : initialHandoff,
      crop_stage_context: input.crop_stage_context,
      require_parent_match: !aRecordSet,
    });''',
    '''    const runtimeConfig = await this.runtimeConfigRepository.readRuntimeConfig(runtimeConfigRef);
    if (!runtimeConfig) throw new Error("CAP04_SINGLE_TICK_RUNTIME_CONFIG_NOT_FOUND");
    assertCanonicalConfigEnvelopeV1({
      config: runtimeConfig,
      expected_ref: runtimeConfigRef,
      expected_hash: runtimeConfigHash,
      scope: input.scope,
    });
    const resolvedConfig = this.executionConfigResolver.resolveExecutionConfig(runtimeConfig);
    const config = assertResolvedConfigV1({
      canonical_config: runtimeConfig,
      resolved: resolvedConfig,
      logical_time: logicalTime,
      handoff: aRecordSet ? await this.handoffService.prepareNextTickInput(input.scope) : initialHandoff,
      crop_stage_context: input.crop_stage_context,
      require_parent_match: !aRecordSet,
    });''',
)

receipt = "apps/server/src/runtime/twin_runtime/receipt_consuming_forecast_scenario_tick_service_v1.ts"
replace_once(
    receipt,
    'import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";\n',
    "",
)
replace_once(
    receipt,
    '''  selectCap05ActionFeedbackForTickV1,
  validateCap05ReceiptConsumingRuntimePoliciesV1,
  type Cap05ActionFeedbackTickSelectionTraceV1,''',
    '''  selectCap05ActionFeedbackForTickV1,
  type Cap05ActionFeedbackTickSelectionTraceV1,''',
)
replace_once(
    receipt,
    'import { PrepareNextTickInputServiceV1 } from "./next_tick_input_service_v1.js";',
    'import { Cap05InheritedCap04ExecutionConfigResolverV1 } from "./cap05_inherited_cap04_execution_config_resolver_v1.js";\nimport { PrepareNextTickInputServiceV1 } from "./next_tick_input_service_v1.js";',
)
replace_once(
    receipt,
    '''class Cap05ReceiptConsumingRuntimeConfigRepositoryV1 implements RuntimeConfigRepositoryPortV1 {
  constructor(private readonly delegate: RuntimeConfigRepositoryPortV1) {}

  commitRuntimeConfig(config: CanonicalObjectEnvelopeV1): Promise<{
    status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
    object_id: string;
    fact_id: string;
  }> {
    return this.delegate.commitRuntimeConfig(config);
  }

  async readRuntimeConfig(objectId: string): Promise<CanonicalObjectEnvelopeV1 | null> {
    const config = await this.delegate.readRuntimeConfig(objectId);
    if (config) validateCap05ReceiptConsumingRuntimePoliciesV1(config.payload);
    return config;
  }
}

''',
    "",
)
replace_once(
    receipt,
    '''      new Cap05ReceiptConsumingRuntimeConfigRepositoryV1(runtimeConfigRepository),
      persistence,
    );''',
    '''      runtimeConfigRepository,
      persistence,
      new Cap05InheritedCap04ExecutionConfigResolverV1(),
    );''',
)

pending = "apps/server/src/runtime/twin_runtime/pending_scenario_barrier_service_v1.ts"
replace_once(
    pending,
    'import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";',
    'import { validateCanonicalObjectV1, type CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";',
)
replace_once(
    pending,
    'import { validateCap04RuntimeConfigPayloadV1, type Cap04RuntimeConfigPayloadV1 } from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";',
    '''import type { Cap04RuntimeConfigPayloadV1 } from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import {
  DirectCap04ExecutionConfigResolverV1,
  type Cap04ExecutionConfigResolverPortV1,
} from "../../domain/twin_runtime/runtime_config_execution_view_v1.js";''',
)
replace_once(
    pending,
    '''    private readonly persistence: Cap04SingleTickPersistencePortV1,
    private readonly inner: Cap04ForecastScenarioSingleTickServiceV1,
  ) {}''',
    '''    private readonly persistence: Cap04SingleTickPersistencePortV1,
    private readonly inner: Cap04ForecastScenarioSingleTickServiceV1,
    private readonly executionConfigResolver: Cap04ExecutionConfigResolverPortV1 = new DirectCap04ExecutionConfigResolverV1(),
  ) {}''',
)
replace_once(
    pending,
    '''    if (runtimeConfig.object_id !== runtimeConfigRef || runtimeConfig.determinism_hash !== runtimeConfigHash) {
      throw new Error("CAP04_PENDING_B_RUNTIME_CONFIG_PIN_MISMATCH");
    }
    validateCap04RuntimeConfigPayloadV1(runtimeConfig.payload);
    const config = runtimeConfig.payload as unknown as Cap04RuntimeConfigPayloadV1;''',
    '''    validateCanonicalObjectV1(runtimeConfig);
    if (runtimeConfig.object_id !== runtimeConfigRef || runtimeConfig.determinism_hash !== runtimeConfigHash) {
      throw new Error("CAP04_PENDING_B_RUNTIME_CONFIG_PIN_MISMATCH");
    }
    const resolvedConfig = this.executionConfigResolver.resolveExecutionConfig(runtimeConfig);
    if (resolvedConfig.source_config_ref !== runtimeConfig.object_id
      || resolvedConfig.source_config_hash !== runtimeConfig.determinism_hash) {
      throw new Error("CAP04_PENDING_B_EXECUTION_CONFIG_SOURCE_PIN_MISMATCH");
    }
    const config = resolvedConfig.payload as Cap04RuntimeConfigPayloadV1;''',
)

runner = "apps/server/scripts/mcft/MCFT_CAP_05_HUMAN_DECISION_FEEDBACK_RUNNER.ts"
replace_once(
    runner,
    'import { Cap05FeedbackExecutionRuntimeConfigRepositoryV1 } from "../../src/runtime/twin_runtime/cap05_feedback_config_execution_view_v1.js";',
    'import { Cap05InheritedCap04ExecutionConfigResolverV1 } from "../../src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.js";',
)
replace_once(
    runner,
    '    const executionConfigRepository = new Cap05FeedbackExecutionRuntimeConfigRepositoryV1(runtimeRepository);\n',
    '    const executionConfigResolver = new Cap05InheritedCap04ExecutionConfigResolverV1();\n',
)
replace_once(
    runner,
    '''      executionConfigRepository,
      persistence,
    );''',
    '''      runtimeRepository,
      persistence,
      executionConfigResolver,
    );''',
)
replace_once(
    runner,
    '''      executionConfigRepository,
      persistence,
      baseTickService,
    );''',
    '''      runtimeRepository,
      persistence,
      baseTickService,
      executionConfigResolver,
    );''',
)
replace_once(
    runner,
    '''      new PostgresActionFeedbackTickSourceV1(pool),
      executionConfigRepository,
      persistence,
    );''',
    '''      new PostgresActionFeedbackTickSourceV1(pool),
      runtimeRepository,
      persistence,
    );''',
)

subprocess.run(
    [
        "git",
        "checkout",
        "origin/main",
        "--",
        "apps/server/src/adapters/twin_runtime/canonical_replay_file_source_v1.ts",
    ],
    check=True,
)
for obsolete in [
    "apps/server/src/runtime/twin_runtime/cap05_feedback_config_execution_view_v1.ts",
    "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FEEDBACK_CONFIG_EXECUTION_VIEW.ts",
]:
    path = Path(obsolete)
    if path.exists():
        path.unlink()
