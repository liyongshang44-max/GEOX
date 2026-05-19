# PEST DISEASE INSPECTION DOMAIN CONTRACT V1

## 0. Position

P2-C Pest & Disease Inspection is an inspection evidence capability package. It creates a trusted scouting and diagnostic evidence chain before any later spot-spray or treatment workflow.

The contract boundary is:

```text
AO-SENSE / Manual Scout / Drone / Fixed Trap
→ Inspection Domain
→ GEOX Main Chain / Guarded Report
```

AO-SENSE may request an inspection task and receive an execution receipt. Pest/disease-specific media, GPS, scout note, device profile, pest count, trap count, incidence, severity, affected area, and evidence quality belong in `pest_disease_observation_v1`, not in the AO-SENSE receipt body. The AO-SENSE receipt should reference the observation by `fact_id`.

Inspection Domain owns formal inspection request, observation, signal, assessment, review, and inspection evidence acceptance facts. Skill output may produce a technical signal only; it is not the formal business conclusion.

## 1. Fact types

- `pest_disease_inspection_request_v1`
- `pest_disease_observation_v1`
- `pest_disease_signal_v1`
- `pest_disease_inspection_assessment_v1`
- `pest_disease_inspection_review_v1`
- `pest_disease_inspection_acceptance_v1`

## 2. Minimal field requirements

### pest_disease_inspection_request_v1

```ts
{
  inspection_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id?: string | null;

  trigger_source:
    | "AO_SENSE"
    | "MANUAL_SCOUT"
    | "DRONE_IMAGE"
    | "FIXED_TRAP"
    | "SENSING_RISK"
    | "CUSTOMER_REQUEST"
    | "CROP_STAGE_WINDOW";

  requested_target:
    | "PEST"
    | "DISEASE"
    | "WEED"
    | "UNKNOWN_STRESS";

  crop_code?: string | null;
  crop_stage?: string | null;

  requested_at_ts: number;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";

  evidence_refs: Array<{ kind: string; ref_id: string }>;
  reasons: string[];
}
```

### pest_disease_observation_v1

This is the critical P2-C field evidence fact.

```ts
{
  observation_id: string;
  inspection_id: string;

  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id?: string | null;

  captured_at_ts: number;

  geo_point?: {
    lat: number;
    lng: number;
  } | null;

  device_profile?: {
    device_id?: string | null;
    device_model:
      | "PHONE_CAMERA"
      | "DJI_MAVIC_3E"
      | "DJI_MAVIC_3M"
      | "DJI_MAVIC_3T"
      | "SENTERA_6X"
      | "MICASENSE_REDEDGE_P"
      | "FIXED_PEST_TRAP_GENERIC"
      | "TRAPVIEW_TRAP"
      | "MANUAL_SCOUT"
      | "OTHER";
    device_type:
      | "PHONE"
      | "UAV_RGB"
      | "UAV_MULTISPECTRAL"
      | "UAV_THERMAL"
      | "FIXED_TRAP"
      | "SCOUTING_APP"
      | "MANUAL";
    capabilities: string[];
  } | null;

  media_refs: Array<{
    kind:
      | "IMAGE"
      | "VIDEO"
      | "MULTISPECTRAL_MAP"
      | "THERMAL_IMAGE"
      | "TRAP_IMAGE";
    ref_id: string;
    checksum?: string | null;
  }>;

  scout_note?: string | null;
  crop_stage?: string | null;

  plant_part:
    | "LEAF"
    | "STEM"
    | "ROOT"
    | "FRUIT"
    | "CANOPY"
    | "TRAP"
    | "UNKNOWN";

  target_type:
    | "PEST"
    | "DISEASE"
    | "WEED"
    | "UNKNOWN_STRESS";

  suspected_issue_code?: string | null;

  pest_count?: number | null;
  trap_count?: number | null;
  incidence_percent?: number | null;
  severity_percent?: number | null;
  affected_area_percent?: number | null;

  evidence_quality:
    | "COMPLETE"
    | "PARTIAL"
    | "MISSING_GEO"
    | "MISSING_MEDIA"
    | "LOW_QUALITY_IMAGE";

  evidence_refs: Array<{ kind: string; ref_id: string }>;
  created_at_ts: number;
}
```

### pest_disease_signal_v1

This is a Skill output signal, not a formal conclusion.

```ts
{
  signal_id: string;
  inspection_id: string;
  observation_id?: string | null;

  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id?: string | null;

  skill_id: string;
  skill_run_id?: string | null;
  skill_trace_id?: string | null;

  signal_type:
    | "PEST_SIGNAL"
    | "DISEASE_SIGNAL"
    | "WEED_SIGNAL"
    | "CROP_STRESS_SIGNAL";

  candidate_issue_code?: string | null;

  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason_codes: string[];
  missing_inputs: string[];
  uncertainty_notes: string[];

  evidence_refs: Array<{ kind: string; ref_id: string }>;
  created_at_ts: number;
}
```

### pest_disease_inspection_assessment_v1

This is the formal Inspection Domain judgment fact.

```ts
{
  assessment_id: string;
  inspection_id: string;

  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id?: string | null;

  target_type:
    | "PEST"
    | "DISEASE"
    | "WEED"
    | "UNKNOWN_STRESS";

  suspected_issue_code?: string | null;

  assessment_status:
    | "CONFIRMED"
    | "SUSPECTED"
    | "RULED_OUT"
    | "NEEDS_REVIEW"
    | "INSUFFICIENT_EVIDENCE";

  severity:
    | "NONE"
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "NEEDS_REVIEW";

  confidence: "HIGH" | "MEDIUM" | "LOW";

  evidence_tier:
    | "FORMAL"
    | "TECHNICAL"
    | "WARNING"
    | "MANUAL_REVIEW";

  review_required: boolean;
  customer_visible_eligible: boolean;

  observation_refs: string[];
  skill_signal_refs: Array<{
    skill_id: string;
    skill_run_id?: string | null;
    signal_id?: string | null;
  }>;

  evidence_refs: Array<{ kind: string; ref_id: string }>;
  blocking_reasons: string[];
  reasons: string[];

  created_at_ts: number;
}
```

### pest_disease_inspection_review_v1

```ts
{
  review_id: string;
  inspection_id: string;
  assessment_id: string;

  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;

  review_status:
    | "NOT_REQUIRED"
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "ESCALATED";

  reviewer_actor_id?: string | null;
  reviewed_at_ts?: number | null;
  review_note?: string | null;

  evidence_refs: Array<{ kind: string; ref_id: string }>;
}
```

### pest_disease_inspection_acceptance_v1

This acceptance is inspection evidence acceptance. It is not a claim that a pest, disease, or weed necessarily exists.

```ts
{
  inspection_acceptance_id: string;
  inspection_id: string;
  assessment_id: string;

  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;

  verdict:
    | "PASS"
    | "FAIL"
    | "NEEDS_REVIEW"
    | "INSUFFICIENT_EVIDENCE";

  evidence_complete: boolean;
  geo_evidence_present: boolean;
  media_evidence_present: boolean;
  human_review_satisfied: boolean;

  reasons: string[];
  evidence_refs: Array<{ kind: string; ref_id: string }>;

  evaluated_at_ts: number;
}
```

## 3. AO-SENSE bridge rule

`/api/v1/sense/task` may be used as the generic task shell with `sense_kind = "pest_disease_inspection"` or equivalent future mapping. The inspection-specific fact writer must emit `pest_disease_inspection_request_v1` and `pest_disease_observation_v1`.

`/api/v1/sense/receipt` must not be expanded with pest/disease-specific fields. It may reference `pest_disease_observation_v1` via `evidence_refs: [{ kind: "fact_id", ref_id: "..." }]`.

## 4. Skill boundary note

Pest/Disease AGRONOMY or SENSING Skill output may produce `pest_disease_signal_v1` only; it is not a formal assessment, review, acceptance, recommendation, prescription, approval, AO-ACT task, ROI, or Field Memory.

Inspection Domain owns `pest_disease_inspection_assessment_v1` and `pest_disease_inspection_acceptance_v1`; Skills do not write the formal inspection acceptance fact.

AO-SENSE may request and receipt inspection tasks, but pest/disease media, GPS, scout note, device profile, counts, incidence, severity, and evidence quality belong in `pest_disease_observation_v1` and are referenced from AO-SENSE receipt by `fact_id`.

## 5. Hard rules

- pest_disease_inspection_acceptance PASS = 巡检证据链完整，可支撑 assessment
- pest_disease_inspection_acceptance PASS ≠ 病虫害一定存在
- pest_disease_inspection_acceptance PASS ≠ spray recommendation
- pest_disease_inspection_acceptance PASS ≠ spot spray prescription
- pest_disease_inspection_acceptance PASS ≠ AO-ACT spray task
- SkillRun SUCCESS ≠ pest_disease_inspection_assessment CONFIRMED
- pest_disease_observation_v1 ≠ formal pest/disease conclusion
- pest_disease_signal_v1 is a technical signal, not a formal assessment
- pest_disease_inspection_assessment_v1 ≠ spray recommendation / spot spray prescription / AO-ACT spray task

## 6. Non-goals for P2-C contract

This contract does not define a spray recommendation, spot spray prescription, pesticide/material plan, AO-ACT spray task, ROI ledger entry, or Field Memory write. Those belong to later stages after the inspection evidence chain is accepted and promoted through the main chain.
