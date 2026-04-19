# 第三组测试清单（路径与签收映射）

本文档用于收口第三组测试的**真实文件路径**、**覆盖边界**与**签收标准映射**，避免验收阶段依赖 PR 描述猜路径。

## A. 测试文件真实路径（可直接 fetch）

1. `apps/server/src/routes/control_ao_act_receipt_minimum_contract.test.ts`
2. `apps/server/src/domain/acceptance/irrigation_evidence_contract_v1.test.ts`
3. `apps/server/src/routes/decision_engine_control_plane_boundary.test.ts`
4. `apps/server/src/domain/operation_state/customer_status_mapping_v1.test.ts`
5. `apps/server/src/routes/acceptance_v1_verdict_semantics.test.ts`

## B. 每个测试覆盖的边界

| 测试文件路径 | 覆盖边界 |
| --- | --- |
| `apps/server/src/routes/control_ao_act_receipt_minimum_contract.test.ts` | receipt 最小合同（最小字段、合同形状与边界约束） |
| `apps/server/src/domain/acceptance/irrigation_evidence_contract_v1.test.ts` | irrigation evidence 的 formal / supporting / debug 分层与最小证据链边界 |
| `apps/server/src/routes/decision_engine_control_plane_boundary.test.ts` | unknown recommendation_type / unknown suggested_action.action_type 必须 reject，不允许静默 fallback |
| `apps/server/src/domain/operation_state/customer_status_mapping_v1.test.ts` | customer-facing 状态映射：PENDING_APPROVAL / PENDING_RECEIPT / PENDING_ACCEPTANCE / COMPLETED / INVALID_EXECUTION 及固定文案 |
| `apps/server/src/routes/acceptance_v1_verdict_semantics.test.ts` | acceptance_result_v1.verdict 的 PASS / FAIL / PARTIAL 语义冻结、写入稳定性，以及 verdict 不等于 final_status |

## C. 第三组签收标准映射（验收时一一对应）

| 第三组签收标准 | 对应测试文件 |
| --- | --- |
| TG-1：receipt 最小合同已自动化锁定 | `apps/server/src/routes/control_ao_act_receipt_minimum_contract.test.ts` |
| TG-2：irrigation evidence 分层边界已自动化锁定 | `apps/server/src/domain/acceptance/irrigation_evidence_contract_v1.test.ts` |
| TG-3：control-plane 对 unknown recommendation/action 的 reject 边界已锁定 | `apps/server/src/routes/decision_engine_control_plane_boundary.test.ts` |
| TG-4：customer-facing 状态映射边界与文案稳定性已锁定 | `apps/server/src/domain/operation_state/customer_status_mapping_v1.test.ts` |
| TG-5：acceptance verdict 正式语义（PASS/FAIL/PARTIAL）已被文档+测试锁定 | `apps/server/src/routes/acceptance_v1_verdict_semantics.test.ts` + `docs/ACCEPTANCE_RESULT_VERDICT_SEMANTICS.md` |

---

使用方式：验收人可按 A 节直接 fetch 文件，再按 B/C 节核对覆盖范围与签收条目，无需依赖 PR 描述推断路径。
