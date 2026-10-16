'use strict';
// CAP-09 run-scoped evidence inventory tool is distributed as a host-side attachment.
// Contract/review manifest (non-executable, not authorization).
module.exports=Object.freeze({
 run_id:'da9db7129607', subject_sha:'91835fa0997730c85c5f3869dd530f4c9a3ca82d',
 expected_resources:{postgres_port:55445,minio_endpoint:'http://127.0.0.1:59005'},
 historical_requirements:['first_failed_receipt','first_started','audit_v1','audit_v2','postflight_v4','artifact_closure_v5'],
 real_time_requirements:['fresh_readback','adoption_signature','provider_causal_visibility','measured_stage_budget'],
 retry_adjudication:'REVIEW_REQUIRED_NOT_AUTO_APPROVED',
 test_only_admission:'HOLD',production_admission:'HOLD',
});
