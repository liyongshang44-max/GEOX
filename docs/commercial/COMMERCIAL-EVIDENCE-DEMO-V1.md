# GEOX Commercial Evidence Demo v1

Status: **OFF-MAIN COMMERCIAL DEMO — NOT PRODUCTION AUTHORITY**

Commercial gate: **PASS_FOR_PAID_PILOT_SALES_CONDITIONAL_ON_MACHINE_PROOF**

Paid-pilot scope: **DECISION_ASSURANCE_PAID_PILOT**

本文件描述 Commercial Evidence Demo v1 的客户演示路径、机器证据和工程边界。它不属于 MCFT-CAP-09 authority，不修改 protected `main`，也不继承独立 Formal 时间链尚未完成的 claim。

更严格的逐条 release authority 见：

`docs/commercial/COMMERCIAL-EVIDENCE-RELEASE-MANIFEST-V1.md`

## CEO default presentation path

客户默认路径保持四步，不从抽象术语开场：

```text
1. 真实灌溉决策场景
   Field A / 19:00
   planned irrigation 20 mm          ASSUMPTION
   tomorrow-rain forecast 25 mm      ASSUMPTION
   question: IRRIGATE / DELAY / ABSTAIN?
   GEOX 先问：这份 forecast 在 19:00 当时是否真实可知？

2. 两个看起来一样的答案
   Case A: same 25 mm forecast, available_at 18:43 -> ELIGIBLE
   Case B: same 25 mm forecast, available_at 19:17 -> INELIGIBLE at 19:00

3. 真实 Runtime / 持久化工程资格证据
   Evidence -> State -> Forecast -> Scenario -> Runtime qualification boundary

4. 风险、经济暴露、证据等级和能力边界
   CONTINUE / DEGRADE + CONTINUE / FAIL CLOSED / APPEND FORWARD
```

20 mm、25 mm 和 Field A 都是**业务说明场景输入**，不是生产农艺 authority。真正的灌溉建议仍需要经授权的根区耗水、作物阶段、降雨时机/雨量、系统能力和其他适用农艺输入。

## A/B 核心解释

```text
Decision time: 19:00
Forecast content: tomorrow rain 25 mm

CASE A
available_at = 18:43
-> 19:00 时已经可知
-> ELIGIBLE

CASE B
available_at = 19:17
-> 19:00 knowledge state 中不存在
-> INELIGIBLE as a 19:00-known fact
-> later truth cannot be retroactively relabeled as knowledge available at decision time
```

页面中的 25 mm 是业务解释输入。机器可核验的 canonical A/B 实验与它严格分离，不把说明场景包装成农艺 authority。

## 四个交互 Runtime 案例

```text
NORMAL
PROVIDER LATE
SOURCE CONFLICT
MISSING EVIDENCE
```

每次点击都会重新请求 `GET /api/demo?...`。服务端重新构造 `buildCommercialEvidencePacketV1()` 并直接执行仓库已有：

`apps/server/src/runtime/twin_runtime/external_formal_current_interval_forcing_selector_v1.ts`

确定性行为：

```text
NORMAL
-> HEALTHY
-> CONTINUE

PROVIDER LATE
-> prior causal pair exists
-> PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
-> DEGRADED
-> DEGRADE_AND_CONTINUE
-> no provider wait
-> no retroactive tick rewrite

SOURCE CONFLICT
-> FAIL_CLOSED
-> no qualified State/Scenario output

MISSING EVIDENCE
-> FAIL_CLOSED
-> no invented current-interval forcing
```

页面“查看本次机器证据”展示 exact subject SHA、canonical selector identity、case input、selector outcome、`selection_hash` 或 error code，以及 zero-side-effect boundary。

## Machine-verifiable proof

主机器证明：

```text
GET http://127.0.0.1:4177/api/demo
```

重要字段：

```text
runtime_context.subject_sha
runtime_context.canonical_selector_source
canonical_selector_contract_id
canonical_selection_policy_id
cases[].input
cases[].outcome
cases[].outcome.selection_hash / error_code
evidence_release_manifest
side_effects
```

该接口的受控 canonical selector 证明保持：

```text
provider_request_count = 0
database_read_count = 0
database_write_count = 0
scheduler_write_count = 0
canonical_runtime_write_count = 0
recommendation_write_count = 0
approval_write_count = 0
action_write_count = 0
dispatch_write_count = 0
model_activation_write_count = 0
```

本地 selftest：

```powershell
pnpm exec tsx tools/commercial-evidence-demo/selftest.ts
```

完整 Commercial acceptance：

```powershell
node scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_DEMO_V1.cjs
node scripts/commercial_evidence/ACCEPTANCE_COMMERCIAL_EVIDENCE_RELEASE_GATE_V1.cjs
```

## PERSISTED ENGINEERING QUALIFICATION — Neon

`GET /api/mcft-runtime-evidence` 只允许读取白名单历史数据库：

```text
geox_mcft_cap09_s6_accel24t_am19_v3
```

服务端配置：

```text
COMMERCIAL_EVIDENCE_MCFT_READ_URL=<protected historical-v3 Neon URL>
```

连接串不会发送到浏览器。服务端要求精确数据库名，执行 `BEGIN READ ONLY`、固定 SELECT、短 statement timeout，并在关闭前 `ROLLBACK`。

这个 surface 的证据等级是：

`PERSISTED_ENGINEERING_QUALIFICATION`

它可以证明真实持久化的 chronology、State、Forecast、Scenario、Health 和 Checkpoint 工程行为，但该历史库包含 accelerated engineering fixture，因此不得描述为：

- production live evidence
- final Formal closure
- final MCFT-CAP-09 completion
- production-qualified agronomic recommendation

明确 nonclaims：

```text
NOT_PRODUCTION_LIVE_DATA
NOT_FORMAL_EXTERNAL_EVIDENCE_AS_A_WHOLE
NOT_FINAL_MCFT_CAP09_FORMAL_O00_O23_CLOSURE
ENGINEERING_FIXTURE_PRESENT_IN_ACCELERATED_QUALIFICATION
```

Commercial Demo 不得读取或写入当前 fresh/Formal qualification database。

## 客户经济暴露，不是 ROI

默认解释值：

```text
Field area: 120 ha              ASSUMPTION
Planned irrigation: 20 mm       ASSUMPTION
```

客户货币参数：

```text
pumping $/mm/ha                 CUSTOMER_RATE_CARD
energy                          CUSTOMER_RATE_CARD
labor                           CUSTOMER_RATE_CARD
equipment                       CUSTOMER_RATE_CARD
```

来源词汇：

```text
MEASURED
CUSTOMER_RATE_CARD
AGRONOMIC_MODEL
EXTERNAL_BENCHMARK
ASSUMPTION
```

Yield / quality exposure 保持：

`CUSTOMER DATA REQUIRED`

商业结论保持：

`NOT_PROVEN_CUSTOMER_ROI`

Paid pilot 可以销售，并不意味着客户 ROI 已被证明。ROI 仍必须由客户特定 rate card、yield、quality 和实际运营数据建立。

## 证据等级

页面“当前已证明”只允许解释为：**在对应 evidence class 内已经有可核验机器证据**。

五种 evidence class：

```text
REAL_MACHINE_EXECUTION
PERSISTED_ENGINEERING_QUALIFICATION
DEMO_SCENARIO_INPUT
CUSTOMER_INPUT
FORMAL_PRODUCTION_EVIDENCE
```

它们不得互相冒充。

尤其：

```text
REAL_MACHINE_EXECUTION / PROVEN
!= FINAL FORMAL PRODUCTION AUTHORITY

PERSISTED_ENGINEERING_QUALIFICATION / PROVEN
!= FINAL FORMAL PRODUCTION AUTHORITY
```

真实 24 小时 Stage 1B / Formal O00–O23 只能由独立 MCFT/Formal authority 证明。本 frozen Demo 不自动继承未来 main 上的新 authority。

## 能力边界

### 当前可以证明

- Evidence chronology / as-of boundary
- State propagation
- Forecast
- Scenario
- Runtime qualification boundary
- provenance / trace
- degrade / fail-closed behavior

### 当前不作商业声明

- autonomous irrigation
- unattended field actuation
- production-qualified crop recommendation
- proven customer ROI
- Stage 1B / Formal O00–O23 complete

当前 MCFT/shadow-online engineering qualification 是后续治理动作的前提，不是现场 actuator 的授权。

## Page → repo/runtime component mapping

当前 verified path：

```text
Provider / Sensor
-> Raw / Canonical Evidence
-> As-of / Authority Boundary
-> Current-interval Forcing Selector
-> Canonical Runtime Core
-> State
-> Forecast
-> Scenario
-> Runtime qualification boundary
```

verified architecture 在 `Runtime qualification boundary` 停止。

`Human Approval / controlled execution` 单独标记为：

```text
FUTURE GOVERNED STAGE
Human Approval -> controlled execution
NOT CURRENT VERIFIED CORE
NOT YET A COMMERCIAL CLAIM
```

没有经 repo 验证的 Human Approval component path，就不为了把图画完整而虚构。

| Page / architecture node | Repository/runtime component | Evidence role |
| --- | --- | --- |
| Reality / Provider / Sensor → Evidence | canonical facts + external evidence bindings | chronology, source identity, quality |
| As-of / Authority Boundary | `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md` | real availability / ingress chronology |
| Current-interval Forcing Selector | `apps/server/src/runtime/twin_runtime/external_formal_current_interval_forcing_selector_v1.ts` | directly executed by `/api/demo` |
| Canonical Runtime Core / persistence | `apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_persistent_tick_service_v1.ts` | persistent State / Forecast / Scenario / Health / Checkpoint path |
| Canonical store | PostgreSQL `facts` | append-only canonical fact store |
| State | `twin_state_estimate_v1` | persisted posterior state |
| Forecast | `twin_forecast_run_v1` | persisted forecast run |
| Scenario | `twin_scenario_set_v1` | persisted scenario set |
| Scheduler | `twin_shadow_online_scheduler_slot_v1` | qualification scheduler projection |
| Runtime qualification boundary | `twin_runtime_health_v1` + `twin_runtime_checkpoint_v1` + State `use_eligibility` | qualified / degraded / blocked and continuation boundary |
| Health / recovery | `twin_runtime_health_v1` + `twin_runtime_checkpoint_v1` | degradation reason codes / continuation checkpoint |
| Product Twin Trace | `apps/web/src/features/operator/pages/OperatorTwinTraceReadbackPage.tsx` | read-only operator trace |
| Human Approval / controlled execution | **NOT CURRENT VERIFIED CORE** / **NOT YET A COMMERCIAL CLAIM** | future governed stage |

Persistence、scheduler、health/recovery、trace/provenance 作为侧面治理能力展示。

Lease/fencing 只描述为当前 MCFT qualification governance，Commercial Demo 不调用、不修改；未独立核实 exact repo path 前，不在销售页面虚构路径。

## 五项 Commercial Demo Release Gate

### 1. 可复现启动

```powershell
cd C:\Users\mylr1\GEOX
pnpm exec tsx tools/commercial-evidence-demo/server.ts
```

浏览器：

`http://127.0.0.1:4177`

### 2. Exact commit SHA

```powershell
git rev-parse HEAD
```

页面与 `/api/demo` 的 `runtime_context.subject_sha` 必须匹配当前 checkout。

### 3. 当前案例真实 machine trace

`GET /api/demo`

### 4. 真实 persisted engineering trace

`GET /api/mcft-runtime-evidence`

### 5. Claim-by-claim evidence mapping

`GET /api/demo` → `evidence_release_manifest`

以及：

`docs/commercial/COMMERCIAL-EVIDENCE-RELEASE-MANIFEST-V1.md`

## Run

```powershell
cd C:\Users\mylr1\GEOX
pnpm exec tsx tools/commercial-evidence-demo/server.ts
```

Optional environment variables：

```text
COMMERCIAL_EVIDENCE_DEMO_PORT=4177
GEOX_BASE_URL=http://127.0.0.1:3001
GEOX_OPERATOR_BASE_URL=http://127.0.0.1:5173
COMMERCIAL_EVIDENCE_MCFT_READ_URL=<protected historical-v3 Neon URL>
```

## Repository boundary

该分支仍只允许：

```text
tools/commercial-evidence-demo/**
scripts/commercial_evidence/**
docs/commercial/**
.github/workflows/commercial-evidence-demo-v1.yml
```

不得修改：

```text
protected main
apps/server production route registration
apps/web Operator route registration
MCFT-CAP-09 authority documents
scheduler / lease / fencing
persistence schema
provider adapters
current fresh/Formal database state
final wall-clock time-chain qualification
```

## Hard nonclaims

```text
COMMERCIAL_DEMO_IS_NOT_PRODUCTION_RUNTIME_AUTHORITY
CONTROLLED_DEMO_INPUT_IS_NOT_FORMAL_EXTERNAL_EVIDENCE
CONTROLLED_RUNTIME_VALUE_TRACE_IS_NOT_PERSISTED_PRODUCTION_STATE
HISTORICAL_NEON_QUALIFICATION_IS_NOT_PRODUCTION_LIVE_DATA
HISTORICAL_NEON_QUALIFICATION_IS_NOT_FINAL_FORMAL_CLOSURE
NO_MCFT_CAP09_COMPLETION_CLAIM
NO_FORMAL_O00_O23_CLAIM
NO_AUTONOMOUS_RECOMMENDATION_OR_DISPATCH
NO_RETROACTIVE_TICK_REWRITE
NOT_PROVEN_CUSTOMER_ROI
```

满足 exact-head Commercial acceptance、exact-head generic CI、PR 仍 Draft/unmerged、页面/API/manifest 分类一致且 `main` 未被本 Demo 触碰后，才允许将该 exact head 标记为：

`COMMERCIAL EVIDENCE DEMO v1 — RELEASED FOR PAID PILOT SALES`

这个 release 只授权销售受限范围的 Decision Assurance paid pilot；不授权 production automation，也不声明 final MCFT/Formal closure。
