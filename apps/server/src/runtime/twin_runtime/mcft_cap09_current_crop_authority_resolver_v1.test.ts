import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  deriveExternalFormalA18CropContextIdentityHashV4,
} from "./external_formal_a18_crop_context_v4.js";
import type {
  McftCap09CurrentCropAuthorityResolverPortV1,
} from "./mcft_cap09_current_crop_authority_resolver_v1.js";
import {
  materializeMcftCap09TwinCropContextV2,
} from "./mcft_cap09_twin_runtime_composition_v2.js";

const cropAuthority = JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json",
  "utf8",
));
const configurationMatrix = JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json",
  "utf8",
));
const architectureEffectiveness = {
  schema_version: "geox_dt02_biological_stage_authority_effectiveness_v1",
  amendment_id: "DT02-AMENDMENT-03",
  status: "EFFECTIVE",
  effective: true,
};

function currentCrop(authorityAsOf: string, digestChar: string) {
  return {
    schema_version: "geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1",
    status: "PASS",
    qualification_outcome: "CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
    architecture_effective: true,
    runtime_consumption_authorized: true,
    scope: {
      tenant_id: "tenant_mcft_external",
      project_id: "project_mcft_cap09",
      group_id: "group_public_research",
      site_id: "KBS_MCSE_T4R1",
      field_id: "field_kbs_mcse_t4r1",
      season_id: "season_2026_corn",
      zone_id: "zone_kbs_mcse_t4r1_crop_formal_v1",
      crop: "corn",
      hybrid_product_code: "43-96P",
    },
    lifecycle: {
      domain_state: "ACTIVE",
      authority_status: "RESOLVED",
      authority_validity: "VALID",
      authority_mode: "GOVERNED_PERSISTENT_STATE",
      active_consumable_candidate: true,
    },
    biological_stage: {
      epistemic_class: "THERMAL_MODEL_DERIVED",
      resolved_biological_stage: "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
      observed_biological_stage_claimed: false,
      authority_as_of: authorityAsOf,
      forward_stability_hours: 30,
    },
    crop_water_use_stage: "LATE",
    crop_model_parameter: {
      parameter: "Kc",
      stage_code: "LATE",
      value: 0.6,
      configuration_source_id: "mcft_crop_water_use_corn_v1",
      configuration_semantic_hash:
        "sha256:56ac92e34148bd81fe20f2925e1079cb1a3ed647ffefd1471caf1302df70ee4c",
      production_effective: false,
    },
    evidence_digest: `sha256:${digestChar.repeat(64)}`,
  };
}

function expectedIdentity(logicalTime: string, evidenceDigest: string) {
  return deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time: logicalTime,
    crop_stage_code: "LATE",
    current_crop_authority_evidence_digest: evidenceDigest,
  });
}

test("Twin V2 resolves current-crop authority independently for each logical hour", () => {
  const first = currentCrop("2026-09-03T04:00:00.000Z", "a");
  const second = currentCrop("2026-09-04T04:00:00.000Z", "b");
  const calls: string[] = [];
  const resolver: McftCap09CurrentCropAuthorityResolverPortV1 = {
    resolve({ logical_time }) {
      calls.push(logical_time);
      return logical_time < "2026-09-04T04:00:00.000Z" ? first : second;
    },
  };

  const firstLogical = "2026-09-03T05:00:00.000Z";
  const firstResult = materializeMcftCap09TwinCropContextV2(
    {
      crop_authority: cropAuthority,
      configuration_matrix: configurationMatrix,
      biological_stage_architecture_effectiveness: architectureEffectiveness,
      current_crop_authority_resolver: resolver,
    },
    {
      logical_time: firstLogical,
      expected_identity_hash: expectedIdentity(firstLogical, first.evidence_digest),
    },
  );

  const secondLogical = "2026-09-04T05:00:00.000Z";
  const secondResult = materializeMcftCap09TwinCropContextV2(
    {
      crop_authority: cropAuthority,
      configuration_matrix: configurationMatrix,
      biological_stage_architecture_effectiveness: architectureEffectiveness,
      current_crop_authority_resolver: resolver,
    },
    {
      logical_time: secondLogical,
      expected_identity_hash: expectedIdentity(secondLogical, second.evidence_digest),
    },
  );

  assert.deepEqual(calls, [firstLogical, secondLogical]);
  assert.equal(firstResult.current_crop_authority_evidence_digest, first.evidence_digest);
  assert.equal(secondResult.current_crop_authority_evidence_digest, second.evidence_digest);
  assert.notEqual(firstResult.context_identity_hash, secondResult.context_identity_hash);
  assert.equal(firstResult.production_effective, true);
  assert.equal(secondResult.production_effective, true);
});

test("Twin V2 rolling resolver still fails closed when selected authority is stale", () => {
  const stale = currentCrop("2026-09-03T04:00:00.000Z", "c");
  const resolver: McftCap09CurrentCropAuthorityResolverPortV1 = {
    resolve() {
      return stale;
    },
  };
  const logicalTime = "2026-09-04T11:00:00.000Z";

  assert.throws(
    () => materializeMcftCap09TwinCropContextV2(
      {
        crop_authority: cropAuthority,
        configuration_matrix: configurationMatrix,
        biological_stage_architecture_effectiveness: architectureEffectiveness,
        current_crop_authority_resolver: resolver,
      },
      {
        logical_time: logicalTime,
        expected_identity_hash: expectedIdentity(logicalTime, stale.evidence_digest),
      },
    ),
    /EXTERNAL_FORMAL_A18_V4_STAGE_AUTHORITY_FORWARD_WINDOW_EXCEEDED/,
  );
});
