# GEOX Frontend Surface Contract v0.2

## 1. Purpose

GEOX frontend is not a single agricultural monitoring console.

GEOX frontend is a three-surface product system:

1. Customer Delivery Portal
2. Operator Twin Workbench
3. Admin Control Plane Console

All three surfaces share the same backend facts, evidence, estimates, forecasts, scenarios, recommendations, operations, receipts, acceptance records, ROI records, and field memory records.

Each surface presents a different semantic layer to a different user role.

The boundary sentence is:

???????????????????

## 2. Customer Delivery Portal

Path prefix:

`/customer/*`

Purpose:

Customer Delivery Portal is the default customer-facing delivery surface.

It explains what GEOX did, why it did it, what evidence supports it, whether the result was accepted, and what value was recorded.

Customer pages are read-only, summary-oriented, report-oriented, export-oriented, and evidence-oriented.

Allowed customer routes include:

- `/customer/dashboard`
- `/customer/fields`
- `/customer/fields/:fieldId`
- `/customer/fields/:fieldId/export`
- `/customer/operations`
- `/customer/operations/:operationId`
- `/customer/operations/:operationId/export`
- `/customer/reports`
- `/customer/export`

Customer pages may show:

- customer dashboard
- field record
- operation report
- report center
- evidence summary
- evidence export
- value records
- acceptance status
- confirmed recommendation summary
- confirmed field memory summary

Customer pages must not show or provide:

- run forecast
- edit scenario
- submit recommendation
- approve
- dispatch
- create AO-ACT task
- internal skill logs
- execution adapter internals
- raw debug stack
- unconfirmed model output as a customer-visible conclusion

Customer mental model:

?????????????????????????????????????????????

## 3. Operator Twin Workbench

Path prefix:

`/operator/*`

Purpose:

Operator Twin Workbench is the operator-facing digital twin forecasting and scenario analysis surface.

It helps agronomists, operators, and farm managers review current state, forecast risk, compare counterfactual scenarios, inspect evidence quality, identify uncertainty, and prepare recommendations.

Operator pages are analytical, comparative, confidence-aware, evidence-aware, and human-confirmation-oriented.

Planned operator routes include:

- `/operator/twin`
- `/operator/twin/fields/:fieldId`
- `/operator/twin/fields/:fieldId/forecast`
- `/operator/twin/fields/:fieldId/scenarios`
- `/operator/twin/fields/:fieldId/evidence`
- `/operator/twin/fields/:fieldId/calibration`

Operator pages may show:

- field state vector
- crop season state
- sensing coverage
- weather version
- forecast horizon
- no_action baseline
- scenario comparison
- confidence
- uncertainty
- failure conditions
- data gaps
- evidence refs
- prediction replay
- calibration state
- recommendation candidate
- human confirmation boundary

Operator pages must not:

- directly create AO-ACT task
- directly dispatch
- bypass approval
- treat forecast as fact
- treat scenario as task
- hide no_action baseline
- present unconfirmed scenario as an approved operation

Operator mental model:

?????????????????????????????????????????????????

## 4. Admin Control Plane Console

Path prefix:

`/admin/*`

Purpose:

Admin Control Plane Console is the governance, execution, evidence, skill, acceptance, and system health surface.

Admin pages manage the system. They are not the main agricultural forecasting workbench and are not the customer delivery portal.

Allowed admin routes include:

- `/admin/dashboard`
- `/admin/fields`
- `/admin/operations`
- `/admin/devices`
- `/admin/alerts`
- `/admin/evidence`
- `/admin/skills`
- `/admin/acceptance`
- `/admin/healthz`
- `/admin/import`

Admin pages may show:

- platform overview
- field administration
- device state
- operation queue
- alert state
- evidence center
- skill registry
- skill runs
- acceptance state
- import tools
- health checks
- runtime status

Admin pages must not:

- present device online status as crop health
- present skill run success as forecast correctness
- present receipt existence as operation effectiveness
- become the customer report portal
- become the operator digital twin workbench
- directly turn forecast or scenario into AO-ACT dispatch

Admin mental model:

??????????????????????????????????????

## 5. Shared backend, separate presentation surfaces

The backend semantic chain is shared.

Examples:

- `soil_moisture_sensing_window_v1`
- `weather_forecast_fact_v1`
- `irrigation_requirement_v1`
- `water_state_estimate_v1`
- `irrigation_scenario_set_v1`
- `decision_recommendation_v1`
- `approval_request_v1`
- `operation_plan_v1`
- `ao_act_task_v0`
- `ao_act_receipt_v1`
- `as_executed_record_v1`
- `acceptance_result_v1`
- `roi_ledger_v1`
- `field_memory_v1`

The three frontend surfaces must not create separate competing facts.

The surfaces only create different view models:

- CustomerDeliveryPortalVM
- OperatorTwinWorkbenchVM
- AdminControlPlaneVM

## 6. Boundary rules

Customer sees results.

Operator compares futures.

Admin governs execution.

Customer pages are read-only.

Operator pages are analytical and human-confirmation-oriented.

Admin pages are governance and execution-control-oriented.

Scenarios can only enter recommendation.

Recommendations can only enter approval.

Approval can enter operation plan.

Operation plan can enter AO-ACT.

AO-ACT requires receipt and evidence.

No frontend surface may bypass this chain.

## 7. Current implementation note

The current repository already contains a Customer Delivery Portal and an Admin Control Plane Console.

The Operator Twin Workbench is a planned product surface.

The absence of `/operator/*` routes is acceptable until the Operator Twin shell is implemented.

Any future `/operator/*` route must use an operator-specific shell or layout and must not be mounted under CustomerLayout or AdminLayout.
