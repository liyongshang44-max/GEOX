# FERTILIZATION DOMAIN CONTRACT V1

## 0. Position

P2-B Fertilization is a capability package, not a single SkillRun that directly completes the business chain.

The contract boundary is:

```text
Fertilization Skill Pack
→ Fertilization Domain
→ GEOX Main Chain
```

Skill Pack may produce diagnostic signals, recommendation candidates, confidence, missing inputs, evidence refs, acceptance signals, device payload candidates, and technical trace.

Fertilization Domain owns formal business facts. GEOX Main Chain owns Recommendation / Prescription / Approval / AO-ACT Task / Receipt / Acceptance / Guarded Report.

## 1. Fact types

- `nitrogen_need_assessment_v1`
- `fertilization_recommendation_v1`
- `fertilization_prescription_v1`
- `fertilization_acceptance_v1`

## 2. Minimal field requirements

### nitrogen_need_assessment_v1

```ts
{
  assessment_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id?: string | null;
  crop_code?: string | null;

  trigger_source:
    | "SAMPLING_LAB"
    | "SENSING_RISK"
    | "MANUAL_AGRONOMIST"
    | "CROP_STAGE_WINDOW";

  evidence_tier:
    | "FORMAL"
    | "WARNING"
    | "MANUAL_REVIEW";

  sample_id?: string | null;
  lab_import_id?: string | null;

  skill_signal_refs?: Array<{
    skill_id: string;
    skill_run_id?: string | null;
    skill_trace_id?: string | null;
    signal_type: string;
  }>;

  sensing_state_refs?: Array<{
    state_type: "fertility_state" | "salinity_risk_state" | "canopy_stress_state" | string;
    ref_id: string;
  }>;

  sample_type?: "SOIL" | "TISSUE" | null;

  metrics: {
    nitrate_n_mg_kg?: number | null;
    ammonium_n_mg_kg?: number | null;
    total_n_percent?: number | null;
    organic_matter_percent?: number | null;
    tissue_n_percent?: number | null;
    ec_ds_m?: number | null;
    canopy_temp_c?: number | null;
  };

  status:
    | "SUFFICIENT"
    | "LOW_N_RISK"
    | "NEEDS_REVIEW"
    | "INVALID";

  reasons: string[];
  evidence_refs: Array<{ kind: string; ref_id: string }>;
  created_at_ts: number;
}
```

### fertilization_recommendation_v1

```ts
{
  fertilization_recommendation_id: string;
  assessment_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;

  recommendation_type: "NITROGEN";
  suggested_total_n_kg_ha: number | null;

  zone_rates: Array<{
    zone_id: string;
    n_kg_ha: number;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    reason: string;
  }>;

  risk_flags: string[];
  customer_visible_eligible: boolean;
  evidence_refs: Array<{ kind: string; ref_id: string }>;

  source_skill_refs?: Array<{
    skill_id: string;
    skill_run_id?: string | null;
    output_ref?: string | null;
  }>;

  created_at_ts: number;
}
```

### fertilization_prescription_v1

```ts
{
  fertilization_prescription_id: string;
  fertilization_recommendation_id: string;
  assessment_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  nutrient: "N";
  material_type?: string | null;
  zone_rates: Array<{
    zone_id: string;
    planned_n_kg_ha: number;
    max_n_kg_ha?: number | null;
    unit: "kgN/ha";
    required: boolean;
    reason?: string | null;
  }>;
  manual_approval_required: boolean;
  customer_visible_eligible: boolean;
  status: "DRAFT" | "READY_FOR_APPROVAL" | "SUBMITTED_FOR_APPROVAL" | "APPROVED" | "REJECTED";
  evidence_refs: Array<{ kind: string; ref_id: string }>;
  created_at_ts: number;
}
```

### fertilization_acceptance_v1

```ts
{
  fertilization_acceptance_id: string;
  fertilization_prescription_id: string;
  fertilization_prescription_fact_id: string;
  variable_prescription_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  operation_plan_id: string;
  act_task_id: string;
  receipt_fact_id: string;
  receipt_id: string;
  as_executed_id: string;
  as_applied_id: string;
  acceptance_result_fact_id: string;
  acceptance_status: "PASS" | "FAIL" | "NEEDS_REVIEW" | "MISSING";
  zone_results: Array<{
    zone_id: string;
    planned_n_kg_ha: number;
    actual_n_kg_ha: number | null;
    coverage_percent: number | null;
    deviation_percent: number | null;
    result: "PASS" | "FAIL" | "NEEDS_REVIEW";
    reasons: string[];
  }>;
  operation_rollup_policy: "ALL_REQUIRED_ZONES_PASS" | "NEEDS_REVIEW_ON_MISSING_ZONE";
  reasons: string[];
  evidence_refs: Array<{ kind: string; ref_id: string }>;
  evaluated_at_ts: number;
}
```

## 3. Formal trigger rules

`SAMPLING_LAB` is the only path allowed to produce a formal customer-visible nitrogen need assessment. The service implementation must require `sample_id`, `lab_import_id`, `lab_result_import_v1.quality_status = PASS`, `sampling_acceptance_v1 = PASS`, and nitrogen-related metrics before it may emit `status = LOW_N_RISK` with `evidence_tier = FORMAL`.

For `SAMPLING_LAB`, `sample_id` and `lab_import_id` are business continuity assertions, not source-selection authority. The consumed `sampling_acceptance_v1` must uniquely freeze an exact immutable `plan_fact_id -> receipt_fact_id -> lab_fact_id` chain, and the referenced Lab fact must be the exact `lab_import_id` source. Multiple Sampling Acceptance facts for the same `sample_id + lab_import_id` are ambiguous in the absence of a frozen supersession/current-version policy and must fail closed before verdict filtering; a PASS row may not be selected by recency or by pre-filtering away conflicting history.

`SENSING_RISK` may reference `fertility_state`, `salinity_risk_state`, `canopy_stress_state`, or Skill signals, but it may only produce `status = NEEDS_REVIEW` with `evidence_tier = WARNING`.

`MANUAL_AGRONOMIST` requires explicit evidence refs and defaults to non-customer-visible review until a later approval chain validates it.

## 4. Execution provenance rule

Formal Fertilization Acceptance consumes, but does not replace, the canonical execution chain.

Required request identities are:

```text
fertilization_prescription_id
receipt_fact_id
act_task_id
operation_plan_id
as_executed_id
as_applied_id
acceptance_result_fact_id
```

The exact Fertilization prescription must resolve its deterministic bridge successor `fert_bridge_<fertilization_prescription_id>` in `prescription_contract_v1`. Exact Receipt, AsExecuted, AsApplied, and canonical Acceptance must all match that bridge prescription, tenant/project/group, field, task, and operation.

`zone_applications` in request JSON are forbidden as acceptance evidence. Zone actuals are read only from `as_applied_map_v1.application.zone_applications`.

Fertilization `PASS` additionally requires the exact `acceptance_result_v1` to be `PASS` with `formal_acceptance=true`, `formal_evidence_passed=true`, `formal_execution_passed=true`, `source_lane=FORMAL_OPERATION`, and `customer_visible_eligible=true`.

`fields.write` and `prescription.write` are not Fertilization Acceptance authority. The route requires dedicated `acceptance.evaluate` scope.

## 5. Skill boundary note

`AcceptanceSkill skill_id=fertilization_acceptance_v1` is only an acceptance-signal producer and is not the formal `fertilization_acceptance_v1` fact writer.

AcceptanceSkill skill_id=fertilization_acceptance_v1 is only an acceptance_signal producer and is not the formal fertilization_acceptance_v1 fact writer.

Fertilization AGRONOMY Skill output may be `diagnosis_signal` or `recommendation_candidate`, but it must pass through Fertilization Domain and Main Chain before customer-visible recommendation, prescription, approval, AO-ACT task, receipt, acceptance, ROI, or Field Memory.

Fertilization AGRONOMY Skill output may be diagnosis_signal or recommendation_candidate before domain promotion; it is not a customer-visible recommendation, prescription, approval, AO-ACT task, receipt, acceptance, ROI, or Field Memory.

## 6. Hard rules

- SkillRun SUCCESS ≠ nitrogen_need_assessment LOW_N_RISK
- lab_result_imported ≠ nitrogen need confirmed
- fertility_state LOW ≠ formal fertilization recommendation
- nitrogen_need_assessment LOW_N_RISK ≠ fertilization recommendation approved
- fertilization_recommendation ≠ fertilization prescription
- fertilization_prescription ≠ approved operation
- receipt success ≠ fertilization acceptance PASS
- caller zone_applications ≠ canonical execution evidence
- fertilization acceptance PASS requires exact canonical acceptance_result_v1 formal PASS
- operation-level average 不得掩盖 zone-level over/under application
- fertilization acceptance PASS 不得直接写 ROI / Field Memory / customer success