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
  receipt_id: string;
  sample_id: string;
  plan_id: string;
  sampling_plan_fact_id: string;
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
  sample_receipt_fact_id: string;
  sampling_plan_fact_id: string;
  plan_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  imported_at_ts: number;
  lab_name?: string | null;
  metrics: Record<string, number | string | null>;
  units: Record<string, string>;
  evidence_refs: Array<{ kind: string; ref_id: string }>;
  quality_status: "PASS" | "NEEDS_REVIEW" | "INVALID";
}
```

### sampling_acceptance_v1

```ts
{
  acceptance_id: string;
  plan_id: string;
  sample_id: string;
  import_id?: string | null;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  sampling_plan_fact_id: string;
  sample_receipt_fact_id?: string | null;
  lab_result_fact_id?: string | null;
  verdict: "PASS" | "FAIL" | "INSUFFICIENT_EVIDENCE";
  reasons: string[];
  evaluated_at_ts: number;
  evidence_refs: Array<{ kind: string; ref_id: string }>;
}
```

## Exact identity rule

Formal Sampling must bind the exact fact chain:

```text
sampling_plan_v1 fact
-> sample_receipt_v1 fact
-> lab_result_import_v1 fact
-> sampling_acceptance_v1 fact
```

Business identifiers such as `sample_id` or `import_id` may locate an exact fact only when identity is unique and verified. `sample_id` is not declared globally unique: receipt identity is scoped by the exact Sampling Plan, and the same sample_id may exist under a different plan. Lab import may bind an explicit `sample_receipt_fact_id`; sample_id-only compatibility lookup is permitted only when exactly one receipt matches. If multiple candidate facts exist, the path must fail closed rather than select the latest timestamp.

Re-evaluating the same exact plan/receipt/lab source chain is idempotent. It must return the existing `sampling_acceptance_v1` identity. If the same exact chain would now produce a different verdict/reason set, the service must fail closed rather than silently create a second Acceptance.

## Hard rules

- sample_receipt created ≠ lab result valid
- lab_result_imported ≠ agronomy recommendation
- sampling_acceptance PASS ≠ operation success
- manual sample data 不得直接写 ProblemState conclusion
- lab result 不得直接写 ROI / Field Memory / customer success
- legacy `sample_receipt_v1` without `sampling_plan_fact_id` still blocks duplicate receipt creation for the same tenant/project/group + plan_id + sample_id; migration absence must not reopen latest-wins or duplicate writer authority
- legacy `lab_result_import_v1` without exact `sample_receipt_fact_id` / `sampling_plan_fact_id` / scope refs is not Formal Sampling authority and must not be auto-bound by `sample_id` / `import_id`; formal use requires a newly established exact chain
- Sampling formal chain 不得使用 latest-wins source selection；包括不得使用 `ORDER BY occurred_at DESC LIMIT 1` 作为 authority selector
- ambiguous receipt/lab/acceptance identity 必须 fail closed
