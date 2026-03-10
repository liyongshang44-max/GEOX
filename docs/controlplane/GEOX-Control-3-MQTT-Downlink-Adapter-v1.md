# GEOX Control-3 · MQTT Downlink Adapter v1

Control-3 upgrades Control-2 from `dispatch outbox exists` to `dispatch outbox can be drained by a real MQTT adapter`.

This is **not** a scheduler.
It is an explicit adapter runtime that drains the queue once and exits.

## What changed

### Dispatch queue payload
`POST /api/v1/ao-act/tasks/:act_task_id/dispatch` now accepts and stores:

- `device_id`
- `downlink_topic`
- `qos`
- `retain`
- `adapter_hint`

The outbox fact remains append-only:

- `ao_act_dispatch_outbox_v1`

### New publish audit fact
After a successful MQTT publish, the adapter writes:

- `ao_act_downlink_published_v1`

This fact records:

- tenant triple
- `act_task_id`
- `outbox_fact_id`
- `device_id`
- `topic`
- `qos`
- `retain`
- adapter runtime id
- command payload sha256

### New v1 endpoints

- `POST /api/v1/ao-act/downlinks/published`
- `GET /api/v1/ao-act/downlinks`

### New executor command

```powershell
pnpm -C .\apps\executor dispatch-mqtt-once -- --limit 1
```

Environment:

- `GEOX_BASE_URL`
- `GEOX_AO_ACT_TOKEN`
- `GEOX_MQTT_URL`

Default broker URL:

- `mqtt://127.0.0.1:1883`

## Command payload shape

The adapter publishes a minimal command payload:

```json
{
  "command_id": "<act_task_id>",
  "tenant_id": "tenantA",
  "project_id": "projectA",
  "group_id": "groupA",
  "device_id": "dev_mqtt_001",
  "action_type": "IRRIGATE",
  "params": { "duration_min": 15 },
  "constraints": {},
  "issued_at_ts": 1772800000000
}
```

Default topic:

```text
downlink/{tenant_id}/{device_id}
```

## Safety boundary

- no auto-scheduler
- no infinite polling loop
- one explicit drain command per run
- queue item disappears only after receipt exists
- downlink publish is auditable before receipt append

Adapter selection rule:

- when `--act_task_id` is provided, the runtime drains only that task
- otherwise it drains only queue items that already contain both `device_id` and `downlink_topic`
- queue items created before Control-3 (without MQTT addressing metadata) are ignored by the MQTT adapter
