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
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  operation_plan_id?: string | null;
  act_task_id?: string | null;
  receipt_id?: string | null;
  as_applied_id?: string | null;
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

`SENSING_RISK` may reference `fertility_state`, `salinity_risk_state`, `canopy_stress_state`, or Skill signals, but it may only produce `status = NEEDS_REVIEW` with `evidence_tier = WARNING`.

`MANUAL_AGRONOMIST` requires explicit evidence refs and defaults to non-customer-visible review until a later approval chain validates it.

## 4. Skill boundary note

`AcceptanceSkill skill_id=fertilization_acceptance_v1` is only an acceptance-signal producer and is not the formal `fertilization_acceptance_v1` fact writer.

AcceptanceSkill skill_id=fertilization_acceptance_v1 is only an acceptance_signal producer and is not the formal fertilization_acceptance_v1 fact writer.

Fertilization AGRONOMY Skill output may be `diagnosis_signal` or `recommendation_candidate`, but it must pass through Fertilization Domain and Main Chain before customer-visible recommendation, prescription, approval, AO-ACT task, receipt, acceptance, ROI, or Field Memory.

Fertilization AGRONOMY Skill output may be diagnosis_signal or recommendation_candidate before domain promotion; it is not a customer-visible recommendation, prescription, approval, AO-ACT task, receipt, acceptance, ROI, or Field Memory.

## 5. Hard rules

- SkillRun SUCCESS ≠ nitrogen_need_assessment LOW_N_RISK
- lab_result_imported ≠ nitrogen need confirmed
- fertility_state LOW ≠ formal fertilization recommendation
- nitrogen_need_assessment LOW_N_RISK ≠ fertilization recommendation approved
- fertilization_recommendation ≠ fertilization prescription
- fertilization_prescription ≠ approved operation
- receipt success ≠ fertilization acceptance PASS
- operation-level average 不得掩盖 zone-level over/under application
- fertilization acceptance PASS 不得直接写 ROI / Field Memory / customer success