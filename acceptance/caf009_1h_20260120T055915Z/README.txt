GEOX 路 Judge Acceptance (Frozen v1)

Result: FAIL
OutputDir: acceptance\caf009_1h_20260120T055915Z

Truth (frozen):
  projectId=P_DEFAULT
  groupId=G_CAF
  sensor_id=CAF009

Window:
  maxTs=1430298000000
  startTs=1430294400000
  endTs=1430298000000
  hours=1

SSOT:
  expected_interval_ms (from config/judge/default.json): 60000

Data checks:
  points_present=2
  expected_points=60
  min_points_required=54 (ceil(expected_points*0.9))
  metrics_present=10 (expected=10)
  metrics_missing=<none>
  metrics_extra=<none>

Judge call:
  POST /api/judge/run
  run_id=e7f74cb8-5bd8-4104-9be4-c9fea5cbed53
  determinism_hash=50c44c5ebfd1cbd501ef2498f0baa116a1b9f6f8ce9379ee9bcec3162cb9b222
  effective_config_hash=sha256:989c37f2187afa7adeed3046bb0fbd4848c30f9013f36f68ce8150e74b48ca2b

Assertions:
  If points_present >= min_points_required: uncertainty_sources MUST NOT contain SAMPLING_DENSITY
  sampling: input_fact_ids sorted lexicographically; take N=3; each line: fact_id | occurred_at | record_json[0..219]

Failure reasons:
  - points_present(2) < min_points_required(54)

Artifacts:
  - run.json (HTTP raw response body bytes)
  - summary.json (flat schema; includes sensor_id; list fields arrays deduped)
  - window.json (flat schema; includes sensor_id and maxTs)
  - facts_sample.txt
  - README.txt
