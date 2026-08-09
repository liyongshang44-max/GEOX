// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5B3_EXTERNAL_RUNTIME_CONFIG_RESOLVER.ts
// Purpose: prove the Amendment-05 External canonical Runtime Config is honest and deterministic and may resolve only to a non-canonical CAP04 compatibility execution view.
// Boundary: deterministic in-memory qualification only; fixture authority values below are NOT Formal geometry/source facts and are never persisted. No DB, provider network, scheduler, writer, A0 canonical execution, CAP04 canonical execution, or O00.

import assert from "node:assert/strict";
import { validateCanonicalObjectV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { ExternalFormalCap04ExecutionConfigResolverV1 } from "../../apps/server/src/domain/twin_runtime/external_formal_cap04_execution_config_resolver_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_CONFIG_PURPOSE_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
  compileExternalFormalRuntimeConfigV1,
  validateExternalFormalRuntimeConfigPayloadV1,
  type CompileExternalFormalRuntimeConfigInputV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  validateCap04RuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import {
  DirectCap04ExecutionConfigResolverV1,
  EXTERNAL_FORMAL_CAP04_COMPATIBILITY_RESOLUTION_POLICY_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.js";
import { buildCap04S6SingleTickFixtureV1 } from "./mcft_cap_04_single_tick_fixture_v1.js";

let pass = 0;
function ok(message: string): void {
  pass += 1;
  console.log(`PASS ${message}`);
}

const A0_TIME = "2026-08-10T00:00:00.000Z";
const O00_TIME = "2026-08-10T01:00:00.000Z";
const CREATED_AT = "2026-08-09T23:55:00.000Z";
const CONFIG_MATRIX_REF = "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json";
const CONFIG_MATRIX_HASH = "sha256:381ef166454c7b698c6641fadc5d08019fecff127e9529a4c58a1f09d9e1fef5";

const formalAuthorities: CompileExternalFormalRuntimeConfigInputV1["formal_authorities"] = {
  site: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SITE-AUTHORITY-V1.json",
    hash: "eb9eb1880e01eb16430c177be6e2ef2dc36b3ca8",
  },
  reality: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1.json",
    hash: "dedc8db6e2e3c902066ed94b0d3322a69775b7b6",
  },
  source_binding_matrix: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json",
    hash: "30b7910a1bd27882b80eb56041924d0f6252ae02",
  },
  crop_context: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json",
    hash: "b5de9d29189cb654444b3f57d00df290eefe16d3",
  },
  recovery: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json",
    hash: "1174940a6908e545e70d87cb65be5b3a41db33cf",
  },
  fresh_database: {
    ref: "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V1.json",
    hash: "f3a57413d78633685cbc5be7d94f39d9fdc5c62b",
  },
};

function baseInput(role: "A0_BOOTSTRAP" | "HOURLY_CAP04"): CompileExternalFormalRuntimeConfigInputV1 {
  return {
    scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    config_role: role,
    effective_logical_time: role === "A0_BOOTSTRAP" ? A0_TIME : O00_TIME,
    created_at: CREATED_AT,
    parent_runtime_config_ref: null,
    parent_runtime_config_hash: null,
    reality_binding_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-REALITY-BINDING-V1",
    reality_binding_hash: "sha256:ea5b3-qualification-reality-binding",
    source_matrix_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1",
    source_matrix_hash: "sha256:ea5b3-qualification-source-matrix",
    configuration_matrix_ref: CONFIG_MATRIX_REF,
    configuration_matrix_hash: CONFIG_MATRIX_HASH,
    // Qualification-only explicit input: this is deliberately not claimed as the Formal geometry hash.
    geometry_semantic_hash: "sha256:ea5b3-qualification-explicit-geometry-input",
    formal_authorities: structuredClone(formalAuthorities),
    crop_stage_context_authority: {
      context_ref: "GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1",
      context_hash: "sha256:ea5b3-qualification-crop-context",
      configuration_matrix_ref: CONFIG_MATRIX_REF,
      configuration_matrix_hash: CONFIG_MATRIX_HASH,
    },
    model_prior: {
      source_ref: CONFIG_MATRIX_REF,
      source_hash: CONFIG_MATRIX_HASH,
    },
  };
}

async function main(): Promise<void> {
  const a0Input = baseInput("A0_BOOTSTRAP");
  const a0 = compileExternalFormalRuntimeConfigV1(a0Input);
  validateCanonicalObjectV1(a0);
  validateExternalFormalRuntimeConfigPayloadV1(a0.payload);
  assert.equal(a0.payload.runtime_mode, MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_MODE_V1);
  assert.equal(a0.payload.config_purpose, MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_CONFIG_PURPOSE_V1);
  assert.equal(a0.payload.parent_runtime_config_ref, null);
  assert.equal(a0.payload.parent_runtime_config_hash, null);
  assert.equal((a0.payload.evidence_binding_profile as Record<string, unknown>).soil_moisture_binding_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
  assert.equal((a0.payload.evidence_binding_profile as Record<string, unknown>).soil_observation_operator_id, MCFT_CAP09_EXTERNAL_FORMAL_SOIL_OBSERVATION_OPERATOR_ID_V1);
  const canonicalText = JSON.stringify(a0);
  assert.ok(!canonicalText.includes("CONTROLLED_SYNTHETIC_REPLAY_PROXY"));
  assert.ok(!canonicalText.includes('"runtime_mode":"REPLAY"'));
  assert.ok(!canonicalText.includes('"authority_class":"CONTROLLED_SYNTHETIC"'));
  ok("External A0 canonical Runtime Config is honest, External-scoped, binding-frozen, and free of Replay truth claims");

  const a0Again = compileExternalFormalRuntimeConfigV1(structuredClone(a0Input));
  assert.equal(a0Again.object_id, a0.object_id);
  assert.equal(a0Again.determinism_hash, a0.determinism_hash);
  assert.equal(a0Again.idempotency_key, a0.idempotency_key);
  ok("External canonical Runtime Config compilation is deterministic");

  const hourlyInput = baseInput("HOURLY_CAP04");
  hourlyInput.parent_runtime_config_ref = a0.object_id;
  hourlyInput.parent_runtime_config_hash = a0.determinism_hash;
  const hourly = compileExternalFormalRuntimeConfigV1(hourlyInput);
  validateCanonicalObjectV1(hourly);
  validateExternalFormalRuntimeConfigPayloadV1(hourly.payload);
  assert.equal(hourly.payload.parent_runtime_config_ref, a0.object_id);
  assert.equal(hourly.payload.parent_runtime_config_hash, a0.determinism_hash);
  const changedParentInput = structuredClone(hourlyInput);
  changedParentInput.parent_runtime_config_hash = "sha256:ea5b3-different-parent";
  const changedParent = compileExternalFormalRuntimeConfigV1(changedParentInput);
  assert.notEqual(changedParent.object_id, hourly.object_id);
  assert.notEqual(changedParent.determinism_hash, hourly.determinism_hash);
  ok("Hourly External config freezes exact parent authority and parent drift changes canonical identity");

  const resolver = new ExternalFormalCap04ExecutionConfigResolverV1();
  const resolved = resolver.resolveExecutionConfig(hourly);
  validateCap04RuntimeConfigPayloadV1(resolved.payload);
  assert.equal(resolved.source_config_ref, hourly.object_id);
  assert.equal(resolved.source_config_hash, hourly.determinism_hash);
  assert.equal(resolved.source_config_purpose, MCFT_CAP09_EXTERNAL_FORMAL_RUNTIME_CONFIG_PURPOSE_V1);
  assert.equal(resolved.resolution_policy_id, EXTERNAL_FORMAL_CAP04_COMPATIBILITY_RESOLUTION_POLICY_ID_V1);
  assert.equal(resolved.payload.reality_binding_ref, hourly.payload.reality_binding_ref);
  assert.equal(resolved.payload.reality_binding_hash, hourly.payload.reality_binding_hash);
  assert.equal(resolved.payload.source_matrix_hash, hourly.payload.source_matrix_hash);
  assert.equal(resolved.payload.configuration_matrix_hash, hourly.payload.configuration_matrix_hash);
  assert.equal(resolved.payload.geometry_semantic_hash, hourly.payload.geometry_semantic_hash);
  assert.equal(resolved.payload.parent_runtime_config_ref, hourly.payload.parent_runtime_config_ref);
  assert.equal(resolved.payload.parent_runtime_config_hash, hourly.payload.parent_runtime_config_hash);
  ok("External canonical config resolves to CAP04 compatibility math payload while retaining External source ref/hash authority");

  const compatibilityText = JSON.stringify(resolved.payload);
  assert.ok(compatibilityText.includes("CONTROLLED_SYNTHETIC"));
  assert.ok(!JSON.stringify(hourly).includes('"parameter_class":"CONTROLLED_SYNTHETIC"'));
  assert.equal((hourly.payload.compatibility_execution_view as Record<string, unknown>).canonical_persistence_authorized, false);
  assert.equal((hourly.payload.compatibility_execution_view as Record<string, unknown>).may_relabel_external_evidence, false);
  ok("Replay-era compatibility markers remain non-canonical and cannot relabel External authority");

  assert.throws(
    () => resolver.resolveExecutionConfig(a0),
    /EXTERNAL_FORMAL_CAP04_HOURLY_CONFIG_REQUIRED/,
  );
  ok("CAP04 compatibility resolver rejects External A0 bootstrap configs");

  const replayScopeInput = baseInput("A0_BOOTSTRAP") as unknown as Record<string, unknown>;
  replayScopeInput.scope = {
    tenant_id: "tenantA",
    project_id: "projectA",
    group_id: "groupA",
    field_id: "field_c8_demo",
    season_id: "season_demo",
    zone_id: "zone_c8_demo",
  };
  assert.throws(
    () => compileExternalFormalRuntimeConfigV1(replayScopeInput as unknown as CompileExternalFormalRuntimeConfigInputV1),
    /EXTERNAL_FORMAL_RUNTIME_CONFIG_SCOPE_MISMATCH/,
  );
  const cropMismatch = baseInput("A0_BOOTSTRAP");
  cropMismatch.crop_stage_context_authority.configuration_matrix_hash = "sha256:wrong";
  assert.throws(
    () => compileExternalFormalRuntimeConfigV1(cropMismatch),
    /EXTERNAL_FORMAL_CROP_CONTEXT_CONFIGURATION_MATRIX_MISMATCH/,
  );
  const blankAuthority = baseInput("A0_BOOTSTRAP");
  blankAuthority.formal_authorities.site.ref = " ";
  assert.throws(
    () => compileExternalFormalRuntimeConfigV1(blankAuthority),
    /EXTERNAL_FORMAL_SITE_AUTHORITY_REF_REQUIRED/,
  );
  ok("External compiler rejects Replay scope, crop authority mismatch, and blank authority refs fail-closed");

  const historicalFixture = buildCap04S6SingleTickFixtureV1();
  const direct = new DirectCap04ExecutionConfigResolverV1().resolveExecutionConfig(historicalFixture.runtime_config);
  validateCap04RuntimeConfigPayloadV1(direct.payload);
  assert.equal(direct.source_config_ref, historicalFixture.runtime_config.object_id);
  assert.equal(direct.source_config_hash, historicalFixture.runtime_config.determinism_hash);
  ok("Historical Direct CAP04 resolver remains unchanged and valid");

  assert.equal(pass, 8);
  console.log(`MCFT-CAP-09 EA5B3 External Runtime Config/Resolver: ${pass} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
