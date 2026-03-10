# GEOX Control-Gov / Hardening v1

This sprint does not expand the control feature surface.
It hardens the existing Control-4 runtime by adding two categories of capability:

1. Minimal read models for control-plane objects
- `approval_request_index_v1`
- `ao_act_task_index_v1`
- `ao_act_dispatch_index_v1`
- `ao_act_downlink_index_v1`
- `ao_act_device_ack_index_v1`
- `ao_act_receipt_index_v1`

2. Negative governance checks
- duplicate dispatch returns the existing queue item
- duplicate publish returns the existing publish fact
- receipt uplink before publish is rejected
- receipt uplink with the wrong device id is rejected
- duplicate receipt uplink is rejected
- invalid token requests stay unauthorized
- cross-tenant detail reads stay 404 / non-enumerable

Design rules:
- facts remain the only append-only source of truth
- projections are mutable read models only
- dispatch / publish / ack / receipt semantics remain explicit and auditable
- no scheduler / no hidden execution was added in this sprint
