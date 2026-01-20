// Hard boundary: no action/operator/event fields in raw protocols
export const FORBIDDEN_FIELDS: string[] = [
  "action",
  "operator",
  "operator_id",
  "event",
  "event_type",
  "task",
  "recommendation",
  "suggestion",
  "decision",
];
