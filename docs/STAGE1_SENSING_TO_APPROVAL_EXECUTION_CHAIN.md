# GEOX Stage-1 Sensing → Approval → Execution 主链冻结文件

## 1. 文档目的

本文件用于冻结当前仓库中由 Stage-1 sensing 进入 approval / execution 主链的现实链路口径。

本文件只描述当前 GitHub main 已实现的 recommendation → approval → execution 边界事实，不扩展到未来流程设计，也不重写 control-plane 其他文档。

本文件关注的是：

- Stage-1 sensing 与 recommendation 的当前连接方式
- recommendation 与 approval 的当前边界
- approval 与 execution 的当前边界
- 哪些对象不能直接越过 approval 进入 execution
- 当前仓库里 execute 接口的禁止路径是什么

---

## 2. 当前主链结构

截至当前仓库状态，Stage-1 sensing 进入控制链的现实主链为：

`stage1_sensing_summary`
→ `recommendation generate`
→ `submit-approval`
→ `approval_request / operation_plan / approved task`
→ `execution`
→ `receipt`
→ `acceptance`

当前 recommendation 不是 execution 请求本身。
当前 recommendation 必须先经过 approval 链，才能进入 execution 链。

其中：

- `submit-approval` 会把 recommendation 接入 approval 链
- approval 链中会形成 `approval_request`
- recommendation 进入控制面后会形成 `operation_plan`
- execution 侧真正接收的是 approved task 路径，而不是 recommendation / approval_request / operation_plan 直执行

---

## 3. Stage-1 sensing → recommendation 当前边界

当前 recommendation formal trigger 的上游来源为：

- `stage1_sensing_summary`

当前 recommendation formal trigger 不由以下对象直接形成：

- `field_sensing_overview_v1`
- `field_fertility_state_v1`
- internal mixed read-model route
- compatibility-only state

也就是说，当前 recommendation 主链的正式起点，是 Stage-1 summary 的 formal trigger signal，而不是 internal overview。

---

## 4. recommendation → approval 当前边界

当前仓库 recommendation 进入 approval 前，存在 formal provenance 边界。

当前行为为：

- recommendation 若具备 formal trigger provenance，可进入 `submit-approval`
- recommendation 若缺失 formal trigger provenance，不进入 approval 链

当前 recommendation submit-approval 失败时，相关错误语义为：

- `FORMAL_TRIGGER_PROVENANCE_REQUIRED`

这意味着当前 recommendation 与 approval 的边界已经明确为：

- formal trigger recommendation：可进入 approval
- 非 formal trigger recommendation：不得直接进入 approval

---

## 5. approval → execution 当前边界

截至当前仓库状态，execution 侧不接受 recommendation / approval / operation plan 直接执行。

当前 execute 链的现实边界为：

- execution 必须基于 approved task 路径进入
- recommendation 不能直接执行
- approval request 不能直接执行
- operation plan 不能直接执行

也就是说，当前 execution 链的入口不是 recommendation，也不是 approval request，而是经过 approval 后形成的 approved task / executor 路径。

---

## 6. 当前 execute 禁止路径

当前仓库 execute 侧已存在明确禁止路径。

以下对象不得直接进入：

### 6.1 recommendation 直执行

禁止对象：

- `recommendation_id`

当前错误语义为：

- `RECOMMENDATION_ID_NOT_ALLOWED`

### 6.2 approval request 直执行

禁止对象：

- `approval_request_id`

当前错误语义为：

- `APPROVAL_REQUEST_ID_NOT_ALLOWED`

### 6.3 operation plan 直执行

禁止对象：

- `operation_plan_id`

当前错误语义为：

- `OPERATION_PLAN_ID_NOT_ALLOWED`

---

## 7. 当前主链冻结结论

截至当前仓库状态，Stage-1 sensing 进入 execution 的正式链路冻结如下：

### recommendation 起点

- recommendation 从 `stage1_sensing_summary` formal trigger 进入主链

### approval 边界

- 只有具备 formal trigger provenance 的 recommendation 才能进入 approval

### execution 边界

- execution 不接受 recommendation / approval / operation plan 直执行
- execution 通过 approved task 路径进入

---

## 8. 当前测试约束口径

截至本文件冻结时，第二组 recommendation → approval → execution 边界已有对应测试约束；具体测试文件与覆盖范围以后续仓库核实结果为准。

---

## 9. 文档定位

本文件只陈述当前仓库 Stage-1 sensing → approval → execution 主链的已实现事实。

本文件不声明高于仓库现实的上位政策，也不将 future approval successor、future executor model、future routing 视为当前已冻结能力。

后续如 recommendation / approval / execution 主链边界发生变更，应先更新实现与测试，再更新本文件。
