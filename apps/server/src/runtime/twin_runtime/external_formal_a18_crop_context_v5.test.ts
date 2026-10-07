import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  deriveExternalFormalA18CropContextIdentityHashV4,
  materializeExternalFormalA18CropContextV4,
} from "./external_formal_a18_crop_context_v4.js";
import {
  deriveExternalFormalA18CropContextIdentityHashV5,
  materializeExternalFormalA18CropContextV5,
} from "./external_formal_a18_crop_context_v5.js";

const cropAuthority=JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json","utf8"
));
const matrix=JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json","utf8"
));
const architecture=JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json","utf8"
));
const r5=JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-09-20T04Z-V1.json","utf8"
));
const r6=JSON.parse(fs.readFileSync(
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-06T04Z-V1.json","utf8"
));

function expected(logicalTime:string,current:any){
  return deriveExternalFormalA18CropContextIdentityHashV5({
    logical_time:logicalTime,
    crop_stage_code:"LATE",
    current_crop_authority_evidence_digest:current.evidence_digest,
  });
}

test("A18 V5 preserves exact R5 materialization semantics from V4",()=>{
  const logical="2026-09-20T05:00:00.000Z";
  const hashV4=deriveExternalFormalA18CropContextIdentityHashV4({
    logical_time:logical,
    crop_stage_code:"LATE",
    current_crop_authority_evidence_digest:r5.evidence_digest,
  });
  const hashV5=expected(logical,r5);
  assert.equal(hashV5,hashV4);

  const input={
    logical_time:logical,
    expected_identity_hash:hashV4,
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:r5,
    biological_stage_architecture_effectiveness:architecture,
    activation_mode:"PRODUCTION_EFFECTIVE" as const,
  };
  const historical=materializeExternalFormalA18CropContextV4(input);
  const successor=materializeExternalFormalA18CropContextV5(input);
  assert.deepEqual(successor,historical);
  assert.equal(successor.stage_code,"LATE");
  assert.equal(successor.kc,0.6);
});

test("A18 V5 admits real Oct-06 R6 authority without changing water-use semantics",()=>{
  assert.equal(r6.biological_stage.resolved_biological_stage,"R6_OR_LATER_MODEL_ESTIMATE");
  assert.equal(r6.biological_stage.observed_biological_stage_claimed,false);
  assert.equal(r6.lifecycle.domain_state,"ACTIVE");
  assert.equal(r6.crop_water_use_stage,"LATE");
  assert.equal(r6.crop_model_parameter.value,0.6);

  const logical="2026-10-06T05:00:00.000Z";
  const input={
    logical_time:logical,
    expected_identity_hash:expected(logical,r6),
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:r6,
    biological_stage_architecture_effectiveness:architecture,
    activation_mode:"PRODUCTION_EFFECTIVE" as const,
  };

  assert.throws(
    ()=>materializeExternalFormalA18CropContextV4(input),
    /EXTERNAL_FORMAL_A18_V4_BIOLOGICAL_STAGE_AUTHORITY_MISMATCH/,
  );
  const result=materializeExternalFormalA18CropContextV5(input);
  assert.equal(result.stage_code,"LATE");
  assert.equal(result.kc,0.6);
  assert.equal(result.production_effective,true);
  assert.equal(result.lifecycle_requires_separate_validation,true);
  assert.equal(result.water_use_stage_forward_stable_under_thermal_progression,true);
});

test("A18 V5 still fails closed when R6 lifecycle is not independently ACTIVE",()=>{
  const bad=structuredClone(r6);
  bad.lifecycle.domain_state="TERMINATED";
  const logical="2026-10-06T05:00:00.000Z";
  assert.throws(
    ()=>materializeExternalFormalA18CropContextV5({
      logical_time:logical,
      expected_identity_hash:expected(logical,bad),
      crop_authority:cropAuthority,
      configuration_matrix:matrix,
      current_crop_authority:bad,
      biological_stage_architecture_effectiveness:architecture,
      activation_mode:"PRODUCTION_EFFECTIVE",
    }),
    /EXTERNAL_FORMAL_A18_V5_LIFECYCLE_NOT_CONSUMABLE/,
  );
});

test("A18 V5 does not admit PRE_R5 as a singleton Formal-v5 late-stage authority",()=>{
  const bad=structuredClone(r6);
  bad.biological_stage.resolved_biological_stage="PRE_R5_MODEL_ESTIMATE";
  const logical="2026-10-06T05:00:00.000Z";
  assert.throws(
    ()=>materializeExternalFormalA18CropContextV5({
      logical_time:logical,
      expected_identity_hash:expected(logical,bad),
      crop_authority:cropAuthority,
      configuration_matrix:matrix,
      current_crop_authority:bad,
      biological_stage_architecture_effectiveness:architecture,
      activation_mode:"PRODUCTION_EFFECTIVE",
    }),
    /EXTERNAL_FORMAL_A18_V5_BIOLOGICAL_STAGE_AUTHORITY_MISMATCH/,
  );
});
