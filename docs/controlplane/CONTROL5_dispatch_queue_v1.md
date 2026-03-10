# GEOX · Sprint Control-5 · Industrial Dispatch Queue v1

## Goal

Replace the demo-style "queue = facts query" approach with a production-grade runtime queue while preserving the append-only facts ledger as the source of truth for audit.

## Design boundary

- `facts` remains append-only and audit-complete.
- `dispatch_queue_v1` is mutable runtime state only.
- No scheduler is introduced.
- Executors still run explicitly and bounded.

## Runtime states

- `READY`: created and available for claim.
- `LEASED`: atomically claimed by one executor.
- `PUBLISHED`: downlink publish audit fact written.
- `ACKED`: device ack fact written.
- `RECEIPTED`: final receipt recorded.
- `DEAD`: terminal runtime failure / operator intervention.

## Flow

1. `POST /api/v1/ao-act/tasks/:id/dispatch`
   - append `ao_act_task_dispatched_v1`
   - append `ao_act_dispatch_outbox_v1`
   - upsert one `dispatch_queue_v1` row in `READY`

2. `POST /api/v1/ao-act/dispatches/claim`
   - atomically lease READY rows with `FOR UPDATE SKIP LOCKED`
   - writes runtime lease metadata only

3. executor publishes MQTT
   - `POST /api/v1/ao-act/downlinks/published`
   - append `ao_act_downlink_published_v1`
   - mark queue row `PUBLISHED`

4. device ack uplink
   - `POST /api/v1/ao-act/receipts/uplink`
   - append `ao_act_device_ack_received_v1`
   - mark queue row `ACKED`

5. final receipt
   - `POST /api/v1/ao-act/receipts`
   - append receipt facts
   - mark queue row `RECEIPTED`

## Why this is production-safe

- atomic claim prevents duplicate consumption
- lease allows crash recovery
- mutable queue state is separated from immutable ledger facts
- facts still provide replay and audit
- queue listing is no longer inferred by fragile joins over ledger facts

## Compatibility

- existing Commercial v1 facts remain unchanged
- existing REST wrapper paths remain intact
- executor runtime updated to claim queue items atomically
