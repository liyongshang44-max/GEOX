# GEOX Commercial Evidence Demo v1 — 商业证据发布清单

Status: **PAID-PILOT SALES EVIDENCE RELEASE CANDIDATE — CONDITIONAL ON EXACT-HEAD MACHINE ACCEPTANCE**

Commercial gate:

`PASS_FOR_PAID_PILOT_SALES_CONDITIONAL_ON_MACHINE_PROOF`

本文件只属于 Commercial Evidence Demo 独立分支，不是 MCFT authority，不得合并、重绑定或借用 protected `main` 当前正在运行的真实时间链资格。

## 1. 发布原则

GEOX 商业 Demo 的每一句“已证明”都必须能够沿以下路径被核验：

`Demo Claim → Repo / Runtime implementation → Machine evidence → Evidence class → Status`

“已证明”只在对应证据等级内成立。以下五种证据不得互相冒充：

1. `REAL_MACHINE_EXECUTION` — 当前 checkout 的真实仓库代码在请求时实际执行，不是浏览器 hardcode。
2. `PERSISTED_ENGINEERING_QUALIFICATION` — 真实 Runtime 工程资格运行已经持久化的只读证据，不等于 production live 或最终 Formal closure。
3. `DEMO_SCENARIO_INPUT` — 为客户解释而显式设置的场景输入，不是农艺 authority。
4. `CUSTOMER_INPUT` — 必须由客户提供的费率、产量、品质和其他商业参数。
5. `FORMAL_PRODUCTION_EVIDENCE` — 独立 MCFT/Formal 真实时间链或生产部署证据，只有对应 authority 完成后才能声明。

## 2. Commercial Demo Release Gate

### 2.1 可复现启动

```powershell
cd C:\Users\mylr1\GEOX
pnpm exec tsx tools/commercial-evidence-demo/server.ts
```

浏览器：

`http://127.0.0.1:4177`

### 2.2 Exact commit SHA

页面顶部与 `GET /api/demo` 的 `runtime_context.subject_sha` 必须来自当前 checkout 的 `git rev-parse HEAD`。

不得把文档中的旧 SHA 当作当前 release authority。

### 2.3 当前展示案例的真实机器证据

`GET /api/demo`

四个交互案例每次点击都会重新请求该 endpoint，并直接调用：

`apps/server/src/runtime/twin_runtime/external_formal_current_interval_forcing_selector_v1.ts`

案例：

- 正常：`healthy_exact_provider_pair`
- 数据晚到：`provider_late`
- 来源冲突：`source_conflict`
- 证据缺失：`missing_evidence`

### 2.4 真实持久化 Runtime 工程资格证据

`GET /api/mcft-runtime-evidence`

只允许读取历史白名单数据库：

`geox_mcft_cap09_s6_accel24t_am19_v3`

证据等级：

`PERSISTED_ENGINEERING_QUALIFICATION`

明确不等于：

- production live data
- final Formal O00–O23 closure
- final MCFT-CAP-09 completion
- production-qualified agronomic recommendation

### 2.5 Claim-by-claim mapping

| Demo 声明 | Repo / Runtime implementation | Machine evidence | Evidence class | Status |
| --- | --- | --- | --- | --- |
| 证据时序 / as-of 资格边界 | Amendment-11 provider availability watermark authority + `external_formal_current_interval_forcing_selector_v1.ts` | `GET /api/demo` + A/B availability chronology + selection hash / error code | `REAL_MACHINE_EXECUTION` | `PROVEN` |
| 数据晚到时降级继续 | `external_formal_current_interval_forcing_selector_v1.ts` | `GET /api/demo?case=provider_late` | `REAL_MACHINE_EXECUTION` | `PROVEN` |
| 来源冲突 fail closed | `external_formal_current_interval_forcing_selector_v1.ts` | `GET /api/demo?case=source_conflict` | `REAL_MACHINE_EXECUTION` | `PROVEN` |
| 证据缺失 fail closed | `external_formal_current_interval_forcing_selector_v1.ts` | `GET /api/demo?case=missing_evidence` | `REAL_MACHINE_EXECUTION` | `PROVEN` |
| State propagation | `external_formal_v3_amendment19_persistent_tick_service_v1.ts` + `twin_state_estimate_v1` | `GET /api/mcft-runtime-evidence` → `state` | `PERSISTED_ENGINEERING_QUALIFICATION` | `PROVEN` |
| Forecast | `twin_forecast_run_v1` | `GET /api/mcft-runtime-evidence` → `forecast` | `PERSISTED_ENGINEERING_QUALIFICATION` | `PROVEN` |
| Scenario | `twin_scenario_set_v1` | `GET /api/mcft-runtime-evidence` → `scenario` | `PERSISTED_ENGINEERING_QUALIFICATION` | `PROVEN` |
| Runtime qualification boundary | `twin_runtime_health_v1` + `twin_runtime_checkpoint_v1` + State `use_eligibility` | `GET /api/mcft-runtime-evidence` | `PERSISTED_ENGINEERING_QUALIFICATION` | `PROVEN` |
| Provenance / trace | PostgreSQL `facts` + Operator Twin Trace readback | `GET /api/mcft-runtime-evidence` / `GET /api/twin-trace?...` | `PERSISTED_ENGINEERING_QUALIFICATION` | `PROVEN` |
| 20 mm 灌溉 / 25 mm 降雨场景 | Commercial Demo 页面 | 明确页面标签 | `DEMO_SCENARIO_INPUT` | `DISCLOSED_INPUT` |
| 客户经济暴露 | Commercial Demo 客户费率输入 | customer-entered rate card fields | `CUSTOMER_INPUT` | `CUSTOMER_DATA_REQUIRED` |
| 真实 24h Stage 1B / Formal O00–O23 | 独立 MCFT-CAP-09 Formal authority | 不从本 Demo 获取；以 protected `main` 最新 authority 为准 | `FORMAL_PRODUCTION_EVIDENCE` | **`NOT_CLAIMED`** |
| 自动灌溉 / 无人值守执行 | future governed stage | 当前 verified Demo core 无此机器证据 | `FORMAL_PRODUCTION_EVIDENCE` | **`NOT_CLAIMED`** |
| 已证明客户 ROI | 需要客户 rate card + yield / quality validation | 当前没有客户 ROI authority | `CUSTOMER_INPUT` | **`NOT_CLAIMED`** |

同一份结构化映射同时存在于：

`GET /api/demo` → `evidence_release_manifest`

因此页面表格不是独立营销副本，而是从机器可读 manifest 渲染。

## 3. “当前已证明”的解释

页面“当前已证明”不得解释为“GEOX 已生产资格化完成”。

它的唯一合法解释是：

> 某项行为已经在表格所标注的 evidence class 内获得可核验机器证据。

例如：

- `provider_late` 的 degrade 行为可以是 `REAL_MACHINE_EXECUTION / PROVEN`；
- State / Forecast / Scenario 可以是 `PERSISTED_ENGINEERING_QUALIFICATION / PROVEN`；
- 这仍然不能推出 `FORMAL_PRODUCTION_EVIDENCE / PROVEN`。

## 4. 永久禁止提前声明

Commercial Demo v1 不得出现以下无 authority 声明：

- `Stage 1B complete`
- `24h production-qualified`
- `continuous shadow-online proven`
- `Final Formal O00–O23 complete`
- “GEOX 已经安全自动控制灌溉”
- “GEOX 已经证明客户 ROI”

即使 protected `main` 后续完成新的 MCFT/Formal authority，本 frozen Commercial Demo 也不会自动继承该 claim。必须重新进行 evidence mapping 和 exact-head acceptance 后，才允许升级。

## 5. Off-main 边界

本 release manifest 不授权：

- merge Commercial Demo into `main`
- rebase Demo onto current `main`
- runtime/source rebind
- scheduler arm
- provider collector invocation
- R2 write
- Formal database write
- production route registration
- autonomous recommendation / approval / dispatch

Commercial Demo 继续保持：

`off-main / read-only / standalone / non-authoritative`

## 6. Release decision

满足以下条件后，CEO/CTO 可将 exact Demo head 标记为：

`COMMERCIAL EVIDENCE DEMO v1 — RELEASED FOR PAID PILOT SALES`

条件：

1. Commercial Evidence Demo exact-head acceptance = SUCCESS
2. Generic CI exact-head = SUCCESS
3. PR 仍为 Draft / unmerged
4. 页面、`GET /api/demo` 与本 manifest 的 evidence classification 一致
5. protected `main` 未因本 Demo 发生任何写入或 authority drift

该 release 只授权销售受限范围的 Decision Assurance paid pilot；不授权生产自动执行或最终 Formal completion claim。
