# Controlled Pilot Readiness Report

Status: FAIL

## Passed gates
- runtime_workers: pnpm run ci:runtime:workers
- device_anomaly_controlled_pilot: node scripts/agronomy_acceptance/ACCEPTANCE_DEVICE_ANOMALY_CONTROLLED_PILOT_V1.cjs
- customer_device_anomaly_report: node scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_DEVICE_ANOMALY_REPORT_V1.cjs
- server_typecheck: pnpm --filter @geox/server typecheck
- web_typecheck: pnpm --filter @geox/web typecheck

## Failed gates
- base_contract_p0: pnpm run ci:base-contract:p0 (exit=1)
- scenario_pest_disease_inspection: pnpm run ci:scenario:pest-disease-inspection (exit=1)
- scenario_formal_e2e: pnpm run ci:scenario:formal-e2e (exit=1)
- scenario_productization: pnpm run ci:scenario:productization (exit=1)

## Pilot eligible scenarios
- FORMAL_IRRIGATION
- FORMAL_PEST_DISEASE_INSPECTION
- DEVICE_ANOMALY

## Experimental scenarios
- FORMAL_FERTILIZATION

## Known limits
- FORMAL_FERTILIZATION = conditional_pending_ci_proof
- required_for_controlled_pilot = false

## Not for sale claims
- FORMAL_FERTILIZATION is NOT part of mandatory controlled pilot sales gate.

## Machine readable summary
```json
{
  "status": "FAIL",
  "required_gate_count": 9,
  "passed_gate_count": 5,
  "failed_gate_count": 4,
  "passed_gate_ids": [
    "runtime_workers",
    "device_anomaly_controlled_pilot",
    "customer_device_anomaly_report",
    "server_typecheck",
    "web_typecheck"
  ],
  "failed_gate_ids": [
    "base_contract_p0",
    "scenario_pest_disease_inspection",
    "scenario_formal_e2e",
    "scenario_productization"
  ],
  "pilot_eligible_scenarios": [
    "FORMAL_IRRIGATION",
    "FORMAL_PEST_DISEASE_INSPECTION",
    "DEVICE_ANOMALY"
  ],
  "experimental_scenarios": [
    "FORMAL_FERTILIZATION"
  ]
}
```
