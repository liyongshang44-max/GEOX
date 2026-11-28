// Customer soil observation admission. Read existing MQTT raw/DeviceObservation facts;
// produce an in-memory canonical replay envelope and use the existing native ingress.
// No new fact writer, scheduler, model configuration, or production activation.
import type { Pool } from "pg";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import { evaluateStage1PhysicalQcConsumptionV1 } from "../../evidence/stage1_physical_qc_consumption_guard_v1.js";
import {
  DATABASE_EVIDENCE_INGRESS_CONFIG_V1,
  PRODUCTION_EQUIVALENT_SIMULATION_EVIDENCE_INGRESS_CONFIG_V1,
  PostgresEvidenceIngressAdapterV1,
  type EvidenceRowsSourceV1,
} from "./postgres_evidence_ingress_adapter_v1.js";
import type { CanonicalReplayEvidenceRecordV1, ShadowOnlineBoundaryV1, TwinScopeKeyV1 } from "./ports.js";

// Server-supplied installation metadata, not a device assertion. I1 does not
// implement a binding management API. One metric per device is supported.
export type CustomerSoilMeasurementBindingV1 = {
  scope: TwinScopeKeyV1;
  device_id: string;
  binding_id: string;
  dataset_id: string;
  installation_ref: string;
  field_bound_ts_ms: number;
  effective_from: string;
  effective_until: string;
  measurement_depth_mm: number;
  location_ref: string;
  test_only: boolean;
};
const scopeKeys = ["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const;
function scopeMatches(a: TwinScopeKeyV1, b: TwinScopeKeyV1) {
  return scopeKeys.every(k => typeof a[k] === "string" && a[k].length > 0 && a[k] === b[k]);
}
function canonicalTime(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
type Rejection = { raw_fact_id: string; observation_fact_id: string | null; reason: string; physical_qc: unknown };
export async function freezeCustomerSoilEvidenceV1(input: {
  pool: Pick<Pool,"connect">;
  boundary: ShadowOnlineBoundaryV1;
  bindings: readonly CustomerSoilMeasurementBindingV1[];
  test_only: boolean;
}) {
  const bindings = new Map<string, CustomerSoilMeasurementBindingV1>();
  for (const b of input.bindings) {
    if (!scopeMatches(b.scope,input.boundary.scope) || b.test_only !== input.test_only ||
        ![b.device_id,b.binding_id,b.dataset_id,b.installation_ref,b.location_ref].every(x=>typeof x==="string" && x.trim().length>0) ||
        !Number.isSafeInteger(b.field_bound_ts_ms) || b.field_bound_ts_ms<=0 ||
        !canonicalTime(b.effective_from) || !canonicalTime(b.effective_until) ||
        Date.parse(b.effective_until)<=Date.parse(b.effective_from) ||
        !Number.isFinite(b.measurement_depth_mm) || b.measurement_depth_mm<=0 ||
        bindings.has(b.device_id)) throw new Error("CUSTOMER_MEASUREMENT_BINDING_INVALID");
    bindings.set(b.device_id, b);
  }
  const records = new Map<string,CanonicalReplayEvidenceRecordV1 & Record<string,unknown>>();
  const rejected: Rejection[] = [];
  const source: EvidenceRowsSourceV1 = async (client,scope,start,end,limit) => {
    // Scope comes from the authenticated worker binding snapshot, not the MQTT message.
    // Raw-only rows are retained and reportable; they never become numeric evidence.
    const result = await client.query(
      `SELECT r.fact_id AS raw_id,r.occurred_at,r.record_json AS raw_json,
              o.fact_id AS observation_id,o.record_json AS observation_json
         FROM facts r
         LEFT JOIN facts o ON o.record_json->>'type'='device_observation_v1'
              AND o.record_json#>>'{payload,source_fact_id}'=r.fact_id
              AND o.record_json#>>'{entity,tenant_id}'=$1
        WHERE r.record_json->>'type'='raw_telemetry_v1'
          AND r.source='device_telemetry'
          AND r.record_json#>>'{entity,tenant_id}'=$1
          AND r.record_json#>>'{payload,field_binding,project_id}'=$2
          AND r.record_json#>>'{payload,field_binding,group_id}'=$3
          AND r.record_json#>>'{payload,field_binding,field_id}'=$4
          AND r.record_json#>>'{payload,ingress_physical_qc,physical_qc,canonical_metric}'='soil_moisture'
          AND r.occurred_at>$5::timestamptz AND r.occurred_at<=$6::timestamptz
        ORDER BY r.occurred_at,r.fact_id,o.fact_id LIMIT $7`,
      [scope.tenant_id,scope.project_id,scope.group_id,scope.field_id,start,end,limit]
    );
    if (result.rows.length>=limit) throw new Error("EVIDENCE_CANDIDATE_LIMIT_REACHED");
    const out=[];
    const seen = new Set<string>();
    for (const row of result.rows) {
      if (seen.has(row.raw_id)) throw new Error("CUSTOMER_RAW_OBSERVATION_CARDINALITY");
      seen.add(row.raw_id);
      const raw=row.raw_json?.payload;
      const obs=row.observation_json?.payload;
      const entity=row.observation_json?.entity;
      const snapshot=raw?.ingress_physical_qc;
      const qc=snapshot?.physical_qc;
      const reject=(reason:string)=>rejected.push({raw_fact_id:row.raw_id,observation_fact_id:row.observation_id??null,reason,physical_qc:qc??null});
      if (!obs) { reject(qc?.reason_codes?.join("|")||"DEVICE_OBSERVATION_MISSING"); continue; }
      const guard=evaluateStage1PhysicalQcConsumptionV1(obs);
      if (!guard.eligible || guard.mode!=="QUALIFIED") { reject(obs.ingress_physical_qc?.physical_qc?.reason_codes?.join("|")||guard.reason_code); continue; }
      if (obs.is_simulated!==false || obs.formal_eligible!==true || obs.source_lane!=="FORMAL_OPERATION" ||
          !scopeKeys.slice(0,4).every(k=>entity?.[k]===scope[k]) ||
          entity.device_id!==row.raw_json.entity.device_id ||
          semanticHashV1(obs.ingress_physical_qc)!==semanticHashV1(snapshot) ||
          snapshot.source_fact_id!==row.raw_id || obs.metric!=="soil_moisture" ||
          obs.unit!=="%VWC" || obs.value!==qc.numeric_value ||
          obs.observed_at_ts_ms!==raw.ts_ms) { reject("CUSTOMER_OBSERVATION_SOURCE_MISMATCH"); continue; }
      const b=bindings.get(entity.device_id);
      const observedAt=new Date(row.occurred_at).toISOString();
      const ingestedAt=obs.contract?.ingested_at;
      if (!b || raw.field_binding.bound_ts_ms!==b.field_bound_ts_ms ||
          Date.parse(observedAt)<Date.parse(b.effective_from) ||
          Date.parse(observedAt)>=Date.parse(b.effective_until)) { reject("CUSTOMER_MEASUREMENT_SUPPORT_UNBOUND"); continue; }
      if (!canonicalTime(ingestedAt) || !canonicalTime(raw.ingested_at) ||
          Date.parse(ingestedAt)<Date.parse(observedAt) || Date.parse(ingestedAt)<Date.parse(raw.ingested_at) ||
          !Number.isFinite(obs.value) || obs.value<0 || obs.value>100) { reject("CUSTOMER_OBSERVATION_TIME_OR_VALUE_INVALID"); continue; }
      // Existing QC establishes numeric %VWC. This unit conversion is not a root-zone mapping.
      const sourcePayload={raw_fact_id:row.raw_id,device_observation_fact_id:row.observation_id,
        metric:snapshot.source_metric,value:snapshot.source_value,unit:snapshot.source_unit,
        physical_qc:snapshot.physical_qc,installation_ref:b.installation_ref,measurement_binding:b};
      const canonicalPayload={quantity_kind:"VOLUMETRIC_WATER_CONTENT",unit:"fraction",value:obs.value/100,
        measurement_depth_mm:b.measurement_depth_mm,spatial_support:"POINT_SUPPORT",location_ref:b.location_ref,
        direct_root_zone_equivalence:false};
      const record:CanonicalReplayEvidenceRecordV1 & Record<string,unknown>={...scope,
        dataset_id:b.dataset_id,source_record_id:row.observation_id,
        source_record_hash:semanticHashV1({sourcePayload,canonicalPayload,observedAt,ingestedAt}),
        record_type:"soil_moisture_observation_v1",binding_id:b.binding_id,
        origin_source_kind:"CUSTOMER_DEVICE_OBSERVATION",origin_source_id:entity.device_id,
        epistemic_class:"OBSERVED",available_to_runtime_at:ingestedAt,
        role_time:{observed_at:observedAt,ingested_at:ingestedAt},
        quality:{status:"LIMITED",physical_qc:qc},source_payload:sourcePayload,canonical_payload:canonicalPayload,
        source_unit:snapshot.source_unit,canonical_unit:"fraction",
        conversion_rule:{rule_id:"PERCENT_VWC_TO_FRACTION_V1",version:"1"},
        limitations:["POINT_SUPPORT_ONLY","NO_ROOT_ZONE_EQUIVALENCE","NO_MODEL_OR_SCIENTIFIC_PROMOTION"],
        ...(input.test_only?{formal_eligible:false,is_simulated:true,evidence_level:"SIMULATION",source_lane:"PRODUCTION_EQUIVALENT_SHADOW_SIMULATION"}:{formal_eligible:true,is_simulated:false})};
      records.set(record.source_record_id,record);
      out.push({fact_id:row.observation_id,occurred_at:row.occurred_at,record_json:{type:record.record_type,payload:record}});
    }
    return out;
  };
  const ingress=new PostgresEvidenceIngressAdapterV1(input.pool,
    input.test_only?PRODUCTION_EQUIVALENT_SIMULATION_EVIDENCE_INGRESS_CONFIG_V1:DATABASE_EVIDENCE_INGRESS_CONFIG_V1,source);
  const frozen=await ingress.freezeEligibleEvidence({boundary:input.boundary});
  return {frozen,records:frozen.selected.map(x=>records.get(x.evidence_ref)!),rejected};
}
