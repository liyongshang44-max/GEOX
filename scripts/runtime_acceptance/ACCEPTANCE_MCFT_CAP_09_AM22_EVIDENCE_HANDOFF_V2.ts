import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runMcftCap09EvidenceNonOwnerStandbyV2, runMcftCap09EvidencePreFormalOwnerRuntimeV2 } from "../../apps/server/src/runtime/mcft_cap09_evidence_preformal_owner_runtime_v2.js";

import {
  evaluateProductionGfsTargetDueV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_production_gfs_target_due_policy_v1.js";
import {
  MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_ID_V2,
  MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_SCHEMA_V2,
  MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_EPOCH_SELECTION_MODE_V2,
  parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV2,
} from "../../apps/server/src/runtime/mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v2.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_V1_RESULT.json");
const SUBJECT = "a".repeat(40);
const DIGEST = "sha256:" + "b".repeat(64);
const SCOPE = {
  tenant_id: "tenant_mcft_external",
  project_id: "project_mcft_cap09",
  group_id: "group_public_research",
  field_id: "field_kbs_mcse_t4r1",
  season_id: "season_2026_corn",
  zone_id: "zone_kbs_mcse_t4r1_crop_formal_v1",
};

function fixture(): Record<string, unknown> {
  return {
    schema_version: MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_SCHEMA_V2,
    authority_id: MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_ID_V2,
    status: "AUTHORIZED",
    armed: true,
    authority_ref: "local-operator://host/mcft-cap09/formal-v5/evidence-epoch-candidate",
    deployment_subject_sha: SUBJECT,
    scope: { ...SCOPE },
    activation_fence_time: "2026-10-08T05:40:00.000Z",
    formal_a0_logical_time: "2026-10-08T06:00:00.000Z",
    formal_o00_logical_time: "2026-10-08T07:00:00.000Z",
    formal_o23_logical_time: "2026-10-09T06:00:00.000Z",
    readiness_deadline: "2026-10-08T06:00:00.000Z",
    lifecycle_horizon_end_utc: "2026-11-24T03:59:59.999Z",
    fixed_governance_lead_retired: true,
    complete_pre_a0_budget_ms: 720000,
    complete_pre_a0_qualified_envelope_sha256: DIGEST,
    start_readiness_evidence_sha256: DIGEST,
    retired_arm_receipt_sha256: "sha256:fcd39ed82ad8d471a4348b52451d12547a5d4d8a51e39b156e69567a67032167",
    selected_current_crop_authority_ref: "docs/unit-fixture.json",
    selected_current_crop_authority_sha256: DIGEST,
    epoch_selection_mode: MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_EPOCH_SELECTION_MODE_V2,
    stage_authority_refresh_clock_eligibility: {
      eligible: true,
      time_zone: "America/Detroit",
      local_date: "2026-10-08",
      snapshot_boundary_utc: "2026-10-08T04:00:00.000Z",
      snapshot_valid_until_utc: "2026-10-09T10:00:00.000Z",
      snapshot_boundary_strictly_before_a0: true,
      snapshot_validity_covers_o23: true,
      stage_value_consulted: true,
      future_authority_identity_frozen: false,
    },
    base_runtime_start_authority_ref: "local-operator://host/mcft-cap09/runtime-start",
    base_runtime_start_authority_sha256: DIGEST,
    lineage_current_crop_authority_ref: "docs/example-current-crop.json",
    lineage_current_crop_authority_sha256: "sha256:" + "e".repeat(64),
    formal_v5_arm_match_required: true,
    evidence_runtime_planning_handoff_authorized: true,
    runtime_process_start_authorized: false,
    twin_runtime_start_authorized: false,
    production_owner_activation_authorized: false,
    formal_v5_arm_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
    stage_authority_required_for_evidence_acquisition: false,
    future_stage_pins_frozen: false,
    current_crop_authority_promoted: false,
    formal_database_mutation_authorized: false,
    formal_raw_write_authorized: false,
    runtime_config_write_authorized: false,
    scheduler_write_authorized: false,
  };
}


function parse(value: Record<string,unknown>) {
 return parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV2(value,{deployment_subject_sha:SUBJECT,scope:SCOPE,base_runtime_start_authority_sha256:DIGEST,admission_time_utc:"2026-10-08T05:41:00.000Z"});
}
let cases=0;
function negative(change:(x:Record<string,any>)=>void, pattern:RegExp) {
 const x=fixture();change(x);assert.throws(()=>parse(x),pattern);cases++;
}
const value=parse(fixture());assert.equal(value.formal_a0_logical_time,"2026-10-08T06:00:00.000Z");cases++;
negative(x=>x.schema_version="geox_mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v1",/NOT_AUTHORIZED/);
negative(x=>x.scope={...SCOPE,field_id:"other"},/SCOPE/);
negative(x=>x.base_runtime_start_authority_sha256="sha256:"+"f".repeat(64),/BASE_DIGEST/);
negative(x=>x.complete_pre_a0_budget_ms=3600000,/MEASURED_PREPARATION/);
negative(x=>delete x.complete_pre_a0_qualified_envelope_sha256,/PREPARATION_PROOF/);
negative(x=>delete x.start_readiness_evidence_sha256,/START_READINESS_PROOF/);
negative(x=>x.retired_arm_receipt_sha256="sha256:"+"f".repeat(64),/EXACT_RETIRED_ARM/);
negative(x=>x.readiness_deadline="2026-10-07T19:00:00.000Z",/READINESS_RELATION/);
negative(x=>x.fixed_governance_lead_retired=false,/FIXED_LEAD_NOT_RETIRED/);
negative(x=>x.a0_authorized=true,/SCOPE_DRIFT/);
negative(x=>x.formal_database_mutation_authorized=true,/SCOPE_DRIFT/);
negative(x=>(x.stage_authority_refresh_clock_eligibility as any).future_authority_identity_frozen=true,/STAGE_CADENCE/);
negative(x=>x.selected_current_crop_authority_sha256="bad",/CURRENT_STAGE_DIGEST/);
Promise.all([
  assert.rejects(runMcftCap09EvidenceNonOwnerStandbyV2(),/AM22_EFFECTIVE_PRODUCTION_QUALIFICATION_REQUIRED/),
  assert.rejects(runMcftCap09EvidencePreFormalOwnerRuntimeV2(),/AM22_EFFECTIVE_PRODUCTION_QUALIFICATION_REQUIRED/),
]).then(()=>console.log(JSON.stringify({status:"PASS",cases:cases+2,unit_fixtures_only:true,direct_owner_exports_fail_closed:true,evidence_producer_semantics_changed:false,production_start_authorized:false}))).catch(error=>{console.error(error);process.exitCode=1;});
