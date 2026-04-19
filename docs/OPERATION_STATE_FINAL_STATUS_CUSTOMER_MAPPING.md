# OPERATION STATE FINAL STATUS → CUSTOMER MAPPING (v1)

## 唯一来源

- operation 客户态唯一来源：`operation_state_v1.final_status` + customer-facing mapping helper。
- 前端禁止再用 `receipt_status + acceptance + evidence flags` 自行拼最终状态。

## 冻结客户态集合

- `PENDING_APPROVAL`
- `IN_PROGRESS`
- `PENDING_RECEIPT`
- `PENDING_ACCEPTANCE`
- `COMPLETED`
- `INVALID_EXECUTION`

## 冻结映射规则

1. 无 approval / 无 task → `PENDING_APPROVAL`
2. 有 task 无 receipt → `PENDING_RECEIPT`
3. 有 receipt（且无 acceptance/未终态）→ `PENDING_ACCEPTANCE`
4. success terminal（`SUCCEEDED/SUCCESS/DONE/EXECUTED`）或有 acceptance → `COMPLETED`
5. `invalid_execution` 优先级最高 → `INVALID_EXECUTION`

## INVALID_EXECUTION 客户含义（固定）

- “本次作业未被系统认定为有效执行”
- “需重新执行或补充证据”

该文案由后端 customer-facing mapping helper 提供，前端不得重写语义。
