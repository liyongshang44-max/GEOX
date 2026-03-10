# GEOX Control-4 · MQTT Receipt Uplink v1

Goal: complete the minimal device-confirmed control loop without adding a scheduler.

Added:
- `POST /api/v1/ao-act/receipts/uplink`
- `GET /api/v1/ao-act/device-acks`
- `ao_act_device_ack_received_v1`
- `apps/executor/src/run_mqtt_device_sim_once.ts`
- `apps/executor/src/run_mqtt_receipt_uplink_once.ts`
- `dispatch-mqtt-once -- --skipReceipt true`

Flow:
1. `/api/v1/ao-act/tasks/:id/dispatch` writes outbox
2. `dispatch-mqtt-once -- --skipReceipt true` publishes MQTT downlink and audits publish
3. device receives downlink on `downlink/{tenant}/{device}`
4. device publishes receipt on `receipt/{tenant}/{device}`
5. receipt uplink bridge POSTs to `/api/v1/ao-act/receipts/uplink`
6. server writes `ao_act_device_ack_received_v1`
7. server delegates to stable receipt runtime and persists receipt

Non-goals:
- no infinite polling
- no auto-scheduler
- no hidden retries
- no replacement of existing AO-ACT receipt runtime
