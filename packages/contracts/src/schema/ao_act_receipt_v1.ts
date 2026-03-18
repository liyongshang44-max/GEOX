export type AoActReceiptStatusV1 = "ACKED" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type AoActReceiptV1 = {
  task_id: string;
  command_id: string;
  device_id: string;
  adapter_type: string;
  attempt_no: number;
  receipt_status: AoActReceiptStatusV1;
  receipt_code?: string;
  receipt_message?: string;
  raw_receipt_ref?: string;
  received_ts: number;
};
