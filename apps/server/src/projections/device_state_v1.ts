import type { OperationStateV1 } from "./operation_state_v1";

export type DeviceStateV1 = {
  device_id: string;
  active_operation_count: number;
  last_operation_ts: number;
  last_final_status: string;
};

export function projectDeviceStateV1(operations: OperationStateV1[]): DeviceStateV1[] {
  const map = new Map<string, DeviceStateV1>();
  for (const op of operations) {
    const device_id = String(op.device_id ?? "").trim();
    if (!device_id) continue;
    const prev = map.get(device_id);
    const isActive = !["SUCCESS", "FAILED"].includes(op.final_status);
    if (!prev) {
      map.set(device_id, {
        device_id,
        active_operation_count: isActive ? 1 : 0,
        last_operation_ts: op.last_event_ts,
        last_final_status: op.final_status
      });
      continue;
    }
    prev.active_operation_count += isActive ? 1 : 0;
    if (op.last_event_ts > prev.last_operation_ts) {
      prev.last_operation_ts = op.last_event_ts;
      prev.last_final_status = op.final_status;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.last_operation_ts - a.last_operation_ts);
}
