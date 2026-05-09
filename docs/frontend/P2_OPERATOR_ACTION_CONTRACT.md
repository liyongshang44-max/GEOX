# P2 Operator Action Contract

## 1. Purpose

P2-C upgrades the current Operator read-only facade into a permissioned, audited, state-writing action loop.

This document freezes the write-action contract before any Operator button is enabled. It does not implement write routes or frontend buttons.

Current read-side entry points under `/api/v1/operator/*` remain valid. Future write actions must use the response shape, error codes, and frontend button state defined here.

## 2. Scope

In scope:

- approval approve / reject
- task dispatch / retry dispatch
- alert acknowledge / close
- acceptance review / confirm
- evidence issue resolution
- device credential revoke
- workflow owner assignment

Out of scope for C0:

- backend write route implementation
- database migration
- frontend button enablement
- OpenAPI update

## 3. Standard response

All Operator write endpoints must return this shape.

```ts
export type OperatorActionResponseV1 = {
  ok: boolean;
  action_id: string;
  audit_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  status_before: string | null;
  status_after: string | null;
  permission: {
    allowed: boolean;
    role: string | null;
    reason: string | null;
  };
  message: string;
  error_code?: OperatorActionErrorCodeV1;
  updated_at: string;
};
```

Success example:

```json
{
  "ok": true,
  "action_id": "act_operator_001",
  "audit_id": "audit_001",
  "action_type": "ALERT_ACK",
  "target_type": "ALERT",
  "target_id": "alert_123",
  "status_before": "OPEN",
  "status_after": "ACKED",
  "permission": {
    "allowed": true,
    "role": "operator",
    "reason": null
  },
  "message": "告警已确认。",
  "updated_at": "2026-05-09T17:00:00.000Z"
}
```

Denied example:

```json
{
  "ok": false,
  "action_id": "act_operator_002",
  "audit_id": "audit_002",
  "action_type": "APPROVAL_APPROVE",
  "target_type": "APPROVAL_REQUEST",
  "target_id": "approval_req_123",
  "status_before": "PENDING",
  "status_after": "PENDING",
  "permission": {
    "allowed": false,
    "role": "viewer",
    "reason": "当前角色无权审批。"
  },
  "message": "当前角色无权执行该操作。",
  "error_code": "FORBIDDEN",
  "updated_at": "2026-05-09T17:00:00.000Z"
}
```

## 4. Required error codes

```ts
export type OperatorActionErrorCodeV1 =
  | "AUTH_MISSING"
  | "FORBIDDEN"
  | "ACTION_NOT_READY"
  | "INVALID_STATE"
  | "SELF_APPROVAL_BLOCKED"
  | "TARGET_NOT_FOUND"
  | "EVIDENCE_INSUFFICIENT"
  | "AUDIT_WRITE_FAILED"
  | "STATE_WRITE_FAILED";
```

Meaning:

| Code | Meaning |
| --- | --- |
| `AUTH_MISSING` | No valid Operator auth context. |
| `FORBIDDEN` | Auth exists, but role or scope is not allowed. |
| `ACTION_NOT_READY` | Target exists, but prerequisites are incomplete. |
| `INVALID_STATE` | Target state does not allow the transition. |
| `SELF_APPROVAL_BLOCKED` | Actor is not allowed to approve their own request. |
| `TARGET_NOT_FOUND` | Target does not exist or is outside caller scope. |
| `EVIDENCE_INSUFFICIENT` | Required evidence is missing or insufficient. |
| `AUDIT_WRITE_FAILED` | Audit record could not be persisted. |
| `STATE_WRITE_FAILED` | State or command write failed. |

No additional P2-C error code is allowed unless this document is updated first.

## 5. HTTP status mapping

| HTTP status | Expected code |
| --- | --- |
| 200 | success, `ok: true` |
| 400 | `ACTION_NOT_READY` or `INVALID_STATE` |
| 401 | `AUTH_MISSING` |
| 403 | `FORBIDDEN` or `SELF_APPROVAL_BLOCKED` |
| 404 | `TARGET_NOT_FOUND` |
| 409 | `INVALID_STATE` |
| 422 | `EVIDENCE_INSUFFICIENT` |
| 500 | `AUDIT_WRITE_FAILED` or `STATE_WRITE_FAILED` |

Frontend must read `error_code` from the response body when present and must not rely only on HTTP status.

## 6. Frontend button state

All Operator write buttons must use this local state shape.

```ts
export type OperatorActionButtonStateV1 = {
  canAction: boolean;
  disabledReason: string | null;
  pending: boolean;
  lastError: string | null;
};
```

Rules:

- `canAction` is true only when the backend says the action is allowed and ready.
- `disabledReason` is null when `canAction` is true.
- `pending` is true only while a request is in flight.
- `lastError` is a safe message derived from `message`, `permission.reason`, or an allowed `error_code` mapping.
- A button must not become enabled only because a row visually looks actionable.
- The frontend must refresh the relevant Operator read model after success.

## 7. Action type guidance

Recommended action codes:

```ts
export type OperatorActionTypeV1 =
  | "APPROVAL_APPROVE"
  | "APPROVAL_REJECT"
  | "TASK_DISPATCH"
  | "TASK_RETRY_DISPATCH"
  | "ALERT_ACK"
  | "ALERT_CLOSE"
  | "ACCEPTANCE_REQUEST_REVIEW"
  | "ACCEPTANCE_CONFIRM"
  | "EVIDENCE_MARK_RESOLVED"
  | "DEVICE_CREDENTIAL_REVOKE"
  | "WORKFLOW_ASSIGN_OWNER";
```

Recommended target types:

```ts
export type OperatorActionTargetTypeV1 =
  | "APPROVAL_REQUEST"
  | "OPERATION"
  | "TASK"
  | "RECEIPT"
  | "ACCEPTANCE"
  | "EVIDENCE_PACK"
  | "ALERT"
  | "DEVICE"
  | "WORKFLOW";
```

New values must be documented before frontend use.

## 8. Backend requirements

Every write endpoint must enforce:

- auth exists
- tenant / project / group scope matches
- role is allowed
- target exists in scope
- current state allows the transition
- action prerequisites are complete
- self-approval guard where applicable
- audit write succeeds before state mutation
- state or command write succeeds before returning `ok: true`

A successful response must reflect the actual persisted `status_after`.

If audit write fails, the action must not mutate state and must return `AUDIT_WRITE_FAILED`.

If state write fails, the response must return `STATE_WRITE_FAILED`, and the audit record must show failure.

## 9. Row-level action hints

Future Operator read models should expose action hints before buttons are enabled.

```ts
export type OperatorActionHintV1 = {
  action_type: OperatorActionTypeV1;
  can_action: boolean;
  disabled_reason: string | null;
  target_type: OperatorActionTargetTypeV1;
  target_id: string;
};
```

Until row-level hints exist, write buttons must remain disabled by default.

## 10. Safety rules

Operator UI may display:

- `message`
- `permission.reason`
- mapped `error_code`
- `status_before`
- `status_after`
- `updated_at`

Operator UI must not display raw internal diagnostics, internal storage paths, sensitive access material, or raw debug JSON.

Backend responses must also keep `message` and `permission.reason` safe for direct UI display.

## 11. Endpoint naming guidance

Preferred domain-specific paths:

```txt
POST /api/v1/operator/alerts/:alertId/ack
POST /api/v1/operator/alerts/:alertId/close
POST /api/v1/operator/approvals/:approvalRequestId/approve
POST /api/v1/operator/approvals/:approvalRequestId/reject
POST /api/v1/operator/tasks/:taskId/dispatch
POST /api/v1/operator/acceptance/:operationId/request-review
POST /api/v1/operator/devices/:deviceId/credentials/revoke
```

Whichever path is chosen, the response must use `OperatorActionResponseV1`.

## 12. C0 acceptance

C0 is complete when this document exists and defines:

- standard response shape
- standard error code enum
- frontend button state shape
- permission semantics
- audit requirement
- state-write requirement
- safe-display rules

C0 does not require route implementation, frontend button enablement, migrations, or OpenAPI changes.
