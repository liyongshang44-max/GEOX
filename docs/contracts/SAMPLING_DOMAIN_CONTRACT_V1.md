# SAMPLING DOMAIN CONTRACT V1

## Fact types

- `sampling_plan_v1`
- `sample_receipt_v1`
- `lab_result_import_v1`
- `sampling_acceptance_v1`

## Minimal field requirements

### sampling_plan_v1

```ts
{
  plan_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id?: string | null;
  reason: "LOW_CONFIDENCE" | "NUTRIENT_CHECK" | "SOIL_MOISTURE_VALIDATION" | "MODEL_GAP" | "MANUAL_REQUEST";
  sample_type: "SOIL" | "TISSUE" | "WATER";
  required_depth_cm?: number | null;
  required_points: number;
  created_at_ts: number;
  evidence_refs: Array<{ kind: string; ref_id: string }>;
}
```

### sample_receipt_v1

```ts
{
  sample_id: string;
  plan_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_id?: string | null;
  collected_at_ts: number;
  collector_actor_id: string;
  sample_type: "SOIL" | "TISSUE" | "WATER";
  depth_cm?: number | null;
  location_ref?: string | null;
  barcode?: string | null;
  evidence_refs: Array<{ kind: "raw_sample_v1" | "marker_v1" | "import_run_v1" | "fact_id"; ref_id: string }>;
  chain_of_custody_status: "RECORDED" | "MISSING" | "BROKEN";
}
```

### lab_result_import_v1

```ts
{
  import_id: string;
  sample_id: string;
  imported_at_ts: number;
  lab_name?: string | null;
  metrics: Record<string, number | string | null>;
  units: Record<string, string>;
  evidence_refs: Array<{ kind: string; ref_id: string }>;
  quality_status: "PASS" | "NEEDS_REVIEW" | "INVALID";
}
```

## Hard rules

- sample_receipt created ≠ lab result valid
- lab_result_imported ≠ agronomy recommendation
- sampling_acceptance PASS ≠ operation success
- manual sample data 不得直接写 ProblemState conclusion
- lab result 不得直接写 ROI / Field Memory / customer success
