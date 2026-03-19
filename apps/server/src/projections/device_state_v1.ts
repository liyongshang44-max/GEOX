import type { OperationStateV1 } from "./operation_state_v1";

export type DeviceStateV1 = {
  device_id: string;
  active_operation_count: number;
  active_task_id: string | null;
  last_receipt_ts: number | null;
  fault_flags: string[];
  last_operation_ts: number;
  last_final_status: string;
};

function computeFaultFlags(op: OperationStateV1): string[] {
  const flags: string[] = [];
  const dispatch = String(op.dispatch_status ?? "").toUpperCase();
  const receipt = String(op.receipt_status ?? "").toUpperCase();
  const finalStatus = String(op.final_status ?? "").toUpperCase();

  if (finalStatus === "FAILED") flags.push("OPERATION_FAILED");
  if (receipt.includes("FAIL") || receipt.includes("NOT_EXEC")) flags.push("RECEIPT_FAILED");
  if (dispatch.includes("FAILED")) flags.push("DISPATCH_FAILED");
  if (dispatch.includes("DISPATCHED") && !op.task_id) flags.push("MISSING_TASK_LINK");

  return Array.from(new Set(flags));
}

export function projectDeviceStateV1(operations: OperationStateV1[]): DeviceStateV1[] {
  const map = new Map<string, DeviceStateV1>();
  for (const op of operations) {
    const device_id = String(op.device_id ?? "").trim();
    if (!device_id) continue;
    const prev = map.get(device_id);
    const isActive = !["SUCCESS", "FAILED"].includes(op.final_status);
    const opFaultFlags = computeFaultFlags(op);
    let receiptTs: number | null = null;
    for (let i = op.timeline.length - 1; i >= 0; i -= 1) {
      if (op.timeline[i]?.type === "DEVICE_ACK") { receiptTs = op.timeline[i].ts; break; }
    }

    if (!prev) {
      map.set(device_id, {
        device_id,
        active_operation_count: isActive ? 1 : 0,
        active_task_id: isActive ? (op.task_id ?? null) : null,
        last_receipt_ts: receiptTs,
        fault_flags: opFaultFlags,
        last_operation_ts: op.last_event_ts,
        last_final_status: op.final_status
      });
      continue;
    }

    prev.active_operation_count += isActive ? 1 : 0;
    prev.fault_flags = Array.from(new Set([...prev.fault_flags, ...opFaultFlags]));
    if (receiptTs != null && (prev.last_receipt_ts == null || receiptTs > prev.last_receipt_ts)) prev.last_receipt_ts = receiptTs;

    if (op.last_event_ts > prev.last_operation_ts) {
      prev.last_operation_ts = op.last_event_ts;
      prev.last_final_status = op.final_status;
      prev.active_task_id = isActive ? (op.task_id ?? null) : prev.active_task_id;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.last_operation_ts - a.last_operation_ts);
}
