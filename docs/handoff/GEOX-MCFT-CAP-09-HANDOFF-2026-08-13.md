# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-13

更新时间：2026-08-13 10:37（UTC+8）

> 本 handoff 用于恢复工程上下文，不制造新的 authority / effectiveness / activation / crop-stage / epoch / Formal write 权限。若本文与 current Taskbook、effective Amendments、protected `main`、exact PR head、workflow run 或 immutable artifact 冲突，以前述更高权威事实为准。

## 0. 当前快照

```text
repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
8b51945b64f765e8e7a819045a9fe75a1d105468

protected_main_latest_merge:
PR #3089 — feat(mcft-cap09): prepare daily KBS crop-window readiness observer

primary_authority_frontier:
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION

ea5e2_implementation_and_admission_hardening:
PRESENT_ON_PROTECTED_MAIN

ea5e2_operational_activation_effectiveness:
NOT_ESTABLISHED

soil_phase_viability:
PROVEN_COMPATIBLE_PHASE_AVAILABLE (:45 / T-15)

current_crop_authority_for_new_live_window:
EXPIRED / NO LEGAL 2026-08-13 TARGET UNDER FROZEN CURRENT-SEASON CONTEXT

kbs_raw_hourly_provider_operating_behavior:
CONFIRMED_DAILY_BATCH_BY_OPERATOR / APPROX_24_HOURLY_OBSERVATIONS_PER_RELEASE

kbs_raw_hourly_machine_auditable_chain_state_at_latest_verified_artifact:
1 REAL CHAINED TRANSITION / MACHINE CLASSIFICATION STILL INSUFFICIENT_TRANSITIONS

formal_execution:
0/24

mcft_cap09_complete:
false
```

### 0.1 2026-08-13 关键新确认：KBS Raw Hourly 是 daily batch

用户已明确确认 KBS Raw Hourly 的真实 provider operating behavior：

```text
publication cadence = once per day
publication shape = one batch per day
batch coverage = approximately 24 hourly observations
```

因此后续工程调度不再把 Raw Hourly 当成“可能 hourly / 可能 batch”的未知源。

但必须区分两个事实层级：

```text
Provider operating behavior:
CONFIRMED_DAILY_BATCH

Machine-auditable repository cadence evidence:
continues to accumulate chained publication transitions
```

仓库原先要求 `>=3` real chained transitions 才升级机器 cadence classification，这一规则仍可用于建立可审计的 publish-time / jitter / completeness evidence；它不再阻止工程调度按已确认的 daily-batch 行为工作。

同样，daily-batch 确认**不会自动修改**现有 production freshness authority：

```text
KBS Raw Hourly current-read age <= 6h
```

任何 production-authority 变更都必须走独立 amendment / authority adjudication，不能通过 scheduler heuristic 或工程模式暗改。

---

## 1. 我们在做什么

总任务：

```text
MCFT-CAP-09 — Shadow-Online Promotion
目标：STAGE_1B_SHADOW_ONLINE_CLOSURE
最终：真实 UTC O00–O23 24 小时 Formal closure
```

当前不是在写一个新 Twin kernel，而是在把已经完成的 Shadow-online runtime 推过真实 provider、真实时间和真实 authority 的 operational qualification。

当前必须分成两条线：

### A. Authority 主线

```text
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION
```

旧 `season_2026_corn / planting 2026-05-11` crop context 已经没有新的合法 EA5E2 target T。任何 2026-08-13 或更晚的完整 EA5E2 live qualification，都需要新的 lawful successor / requalified crop-context authority。

### B. Engineering / provider 主线

```text
KBS DAILY_BATCH temporal intelligence
+ EA5E2 admission / value-path qualification
```

目标：

1. 不再随机消耗约 7h 的 real-wall-clock live window；
2. 把测试窗口对齐 KBS daily batch 的真实发布时间；
3. batch 出现后立即完成 completeness / continuity / revision / freshness 判定；
4. 让 KBS 数据路径在 engineering mode 下可以快速验证，而不冒充 production authority。

---

## 2. 本对话的起点：EA5E2 live run 31584908899

本对话工程主线从 protected-main EA5E2 live run `31584908899` 的失败分析开始。

当时 subject：

```text
main@dc9b03a0197e94f64d0d06447999290057e722f2
```

该 run 在 pre-boundary 前通过：

```text
exact protected-main subject
private bindings
transient R2 smoke + cleanup
KBS Raw Hourly <=6h freshness
future target selection
crop consensus
```

KBS Raw Hourly precheck：

```text
checked around 2026-08-12T09:53Z
latest Raw Hourly = 2026-08-12T04:00:00Z
age ≈ 5.8915h
frozen <=6h gate = PASS
```

selected target：

```text
T = 2026-08-12T11:00:00Z
```

第一处 substantive failure：

```text
EA5E2_PREBOUNDARY_SOIL_OBSERVATION_NOT_IN_AUTHORIZED_T_WINDOW
```

失败约发生在 `10:54:33Z`，即 T-5 附近。

正确分类：

```text
Immediate provider truth:
no authorized endpoint-25 soil observation became visible early enough
inside frozen [T-15m,T] while preserving T-5m ingress margin

Readiness weakness exposed:
target/window admission did not model provider first-seen temporal behavior
```

这不是“15m authority 太严格”的证明，也不是可以通过放宽 authority 解决的问题。

失败 cleanup 正常，没有 Formal write / public raw-value artifact 泄漏。

---

## 3. #3070 已合并：EA5E2 admission-control hardening 已关闭实现侧主要缺口

PR #3070：

```text
MCFT-CAP-09: complete EA5E2 preflight before next live window
merged_at = 2026-08-12T18:11:36Z
merge = 1c27cf70f62503e89e37602a6f267141e0546bcf
```

#3070 已合并，不再是 Draft。

它完成：

1. expensive EA5E2 live workflow 改为 `workflow_dispatch` only；
2. live-window viability preflight 在 DB/R2/live activation side effects 前运行；
3. late exact-hour availability 改为 read-only same-source exact-T polling；
4. frozen T+390 / T+432 / T+437 不变；
5. soil endpoint 25 独立建模，不再和 Raw Hourly 混淆；
6. global soil p95/max 仅作为 diagnostic；
7. candidate-T soil admission 改为 exact-hour phase-conditioned SSOT；
8. deterministic selftest / dependency graph / full-chain / ordinary CI / release gates 已通过；
9. protected-main live workflow 仍明确保留 production Raw Hourly `<=6h` gate。

当前不应再把 EA5E2 blocker描述为“核心 runner implementation 缺失”。

---

## 4. Soil 问题已关闭，不再是当前 blocker

PR #3071：

```text
test(mcft-cap09): observe KBS soil publication lag
Draft / Open / Unmerged / Non-authoritative
```

关键 exact-row run：

```text
run = 31610093739
status = SUCCESS
artifact = 9149626292
digest = sha256:827f12977400afc43741254eaf7105e0cd63e2199c11d459690e8afa59428054
sampling = 75 minutes / 60 seconds
sample_count = 76
exact_row_first_seen_count = 16
```

Protected main 当前冻结 soil evidence：

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SOIL-FIRST-SEEN-EVIDENCE-V1.json
status = GLOBAL_DIAGNOSTIC_SUFFICIENT_PHASE_ADMISSION_PROVEN_COMPATIBLE
```

Exact-hour phase result：

```text
:45 / T-15
sample_count = 2
lags = [5.466m, 5.590m]
derived budget = 10m
status = PROVEN_COMPATIBLE

:50 / T-10
sample_count = 3
lags = [10.359m, 10.938m, 10.789m]
derived budget = 5m
status = PROVEN_INCOMPATIBLE

:55 / T-5
sample_count = 4
lags = [10.497m, 10.042m, 10.416m, 10.817m]
derived budget = 0m
status = PROVEN_INCOMPATIBLE
```

因此：

```text
proven_compatible_phase_count = 1
usable phase = :45 / T-15
```

以后禁止继续使用旧叙述：

```text
:45 only one sample
soil evidence insufficient
proven compatible count = 0
```

Global p95/max 仍只是 diagnostic，不得重新成为 universal candidate-T authority。

---

## 5. KBS Raw Hourly：已确认 daily batch，测试策略必须随之改变

Protected-main cadence workflow：

```text
.github/workflows/mcft-cap-09-kbs-publication-cadence-observer.yml
schedule = 17 * * * *
```

最新已核 artifact-level state：

```text
run = 31652795556 / run #28
subject = main@8b51945b64f765e8e7a819045a9fe75a1d105468
status = SUCCESS
artifact = 9163218764
digest = sha256:ba57103a8c47831451f0557d60bcc79fbcbba9e0428d75e664e86077aadfa8bf
polled_at = 2026-08-12T23:58:24.067Z
latest_event_time = 2026-08-12T04:00:00.000Z
publication_transition_count = 1
candidate_publication_class = INSUFFICIENT_TRANSITIONS
```

历史第一条真实 chained transition：

```text
first_seen around 2026-08-12T05:03:31Z
previous latest = 2026-08-11T05:00Z
new latest = 2026-08-12T04:00Z
forward events = 23
revisions = 2
shape = MIXED_FORWARD_AND_BACKFILL_OR_REVISION
```

用户随后明确确认 provider 实际机制就是：

```text
每天发布一次
一次发布约 24 小时 Raw Hourly 数据
```

因此后续 cadence intelligence 的目标从“判定 hourly 还是 batch”改为：

```text
1. 记录每天实际 batch publish time
2. 记录 publish-time jitter
3. 记录 batch coverage observation-time start/end
4. 检查约 24 条是否完整、连续
5. 检查 missing hour
6. 检查 revision / backfill
7. 记录 newest observation timestamp
8. 计算 batch 出现后的 production freshness window
```

### 5.1 机器 evidence 与 provider fact 的关系

以后使用：

```text
provider_expected_update_behavior = DAILY_BATCH
```

机器 observer 的 chained-transition count 仍然有价值，但作用变成：

```text
machine-auditable confirmation of publish-time distribution / jitter / completeness
```

而不是继续决定我们是否可以把工程 scheduler 按 daily batch 调度。

### 5.2 不要把 age >6h 错误解释成 provider outage

在 daily-batch 模式下，一天中天然会存在：

```text
provider operating normally
AND
latest observation age > 6h
```

因此新的状态语义必须分开：

```text
Provider health / cadence state:
DAILY_BATCH_NORMAL | BATCH_LATE | BATCH_MISSING | UNKNOWN

Production freshness authority:
PASS if age <=6h
FAIL if age >6h

Scheduler action:
RUN | WAIT_NEXT_BATCH | DEFER | FAIL
```

`WAIT_NEXT_BATCH / DEFER` 不能冒充 production PASS。

---

## 6. Full EA5E2 当前还有两个硬阻塞

旧 frozen crop context：

```text
season = season_2026_corn
planting = 2026-05-11
crop = corn
six FAO variants
backward guard = 6h
forward guard = 30h
```

#3070 已冻结：

```text
terminal legal target T = 2026-08-12T21:00:00Z
latest lawful dispatch = 2026-08-12T20:10:00Z
```

因此 2026-08-13 不能直接复用旧 crop context。

当前完整 EA5E2 的两个硬阻塞：

```text
A. lawful successor / requalified crop-context authority not yet established
B. Raw Hourly 必须在实际 dispatch 时落入现有 <=6h production freshness authority
```

Soil 已不再是 blocker。

这意味着：即便今天 daily batch 正常发布，也只有在新的 lawful crop authority 已成立时，才能把那个 fresh window 用于 full EA5E2。

---

## 7. #3089：新的 crop-window readiness observer

PR #3089 已合并：

```text
title = feat(mcft-cap09): prepare daily KBS crop-window readiness observer
merge = 8b51945b64f765e8e7a819045a9fe75a1d105468
```

新增：

```text
.github/workflows/mcft-cap-09-ea9b-current-main-window-observer.yml
scripts/runtime_acceptance/OBSERVER_MCFT_CAP_09_EA9B_CURRENT_MAIN_WINDOW_READINESS.mjs
```

Schedule：

```text
05:10Z
06:10Z
07:10Z
+ manual dispatch
```

作用：扫描 KBS Aglog，在 2026-05-11 anchor 后寻找新的 T1/T1R1 Planting candidate metadata。

它明确不能：

```text
create season
create crop authority
select successor epoch
select EA5E2 target T
write DB/R2/canonical state
start EA5E2/EA5E3/Formal
```

发现 candidate 后，仍需 separate EA9B authority adjudication / requalification 才能成为 live crop authority。

---

## 8. 今天怎么稳定通过 KBS 测试

必须把“通过 KBS 测试”拆成两类。

### 8.1 Engineering validation：今天可以稳定推进

Production authority 不改：

```text
Layer 1 — Production Freshness Authority
latest Raw Hourly age <=6h
```

新增/保留工程层：

```text
Layer 2 — Provider Cadence / Engineering Intelligence
provider_expected_update_behavior = DAILY_BATCH
engineering max age ceiling = 24h
```

Engineering mode 必须固定输出：

```text
authority_effect = false
formal_activation = false
ea5e2_effectiveness = false
```

用途仅是验证：

```text
KBS transport
parser
hourly event identities
rainfall / ET0 value path
coverage semantics
provider metadata
batch completeness
batch continuity
revision/backfill behavior
```

不能用于宣布 EA5E2 production qualification。

### 8.2 Production EA5E2：以后只在 daily batch 发布后的 fresh window 运行

不再全天盲试。

标准动作：

```text
watch expected daily batch publication window
↓
new batch detected
↓
freeze metadata-only batch proof
↓
validate:
  expected approximately 24 hourly rows
  continuous observation-time coverage
  no missing hours (or explicit classification)
  revisions/backfills recorded
  newest observation timestamp
↓
compute latest age
↓
if age <=6h:
  production freshness PASS
else:
  production freshness FAIL / WAIT_NEXT_BATCH
↓
intersect with:
  lawful crop authority
  :45/T-15 soil viability
  legal exact-hour T
  pre-boundary lead
  exact protected-main gates
↓
only then explicit EA5E2 workflow_dispatch
```

此前第一条真实 transition 在约 `05:03Z` 出现，所以 `~05:00Z` 可以作为当前 scheduler heuristic；不能把这个单点写死为永久发布时间。

后续 cadence intelligence 应学习实际 publish-time distribution，而不是继续每小时期待新 Raw Hourly observation。

---

## 9. Provider cadence intelligence 的正确后续设计

原先讨论的结构保留，但针对 confirmed daily batch 简化为：

```text
Layer 1 — Freshness authority
<=6h

Layer 2 — Provider cadence intelligence
DAILY_BATCH expected behavior
```

建议 profile：

```json
{
  "provider": "KBS_RAW_HOURLY",
  "provider_expected_update_behavior": "DAILY_BATCH",
  "expected_batch_size_hours": 24,
  "observed_batch_count": 0,
  "median_publish_time_utc": null,
  "p95_publish_time_utc": null,
  "publish_time_jitter_minutes": null,
  "last_batch_observation_start": null,
  "last_batch_observation_end": null,
  "last_batch_hour_count": null,
  "last_batch_contiguous": null,
  "last_batch_revision_count": null
}
```

随着 observer 累积，填充：

```text
median publish time
p95 publish time
max delay / jitter
batch size distribution
coverage continuity
revision/backfill frequency
```

新的 decision 语义：

```text
if latest age <=6h:
    freshness_authority = PASS
    scheduler = RUN_IF_OTHER_GATES_PASS

else if expected daily batch has not yet arrived but still within learned normal publish window:
    freshness_authority = FAIL
    provider_state = DAILY_BATCH_NORMAL_WAITING
    scheduler = WAIT_NEXT_BATCH / DEFER

else if batch is materially later than learned cadence:
    freshness_authority = FAIL
    provider_state = BATCH_LATE
    scheduler = DEFER / FAIL
```

注意：cadence intelligence 永远不能把 `freshness_authority=FAIL` 改写成 production PASS。

---

## 10. 旧 cadence-intelligence 分支处理原则

旧分支：

```text
agent/mcft-cap09-provider-cadence-intelligence
```

该分支已经和 current main 分叉；其中虽然已有：

```text
cadence intelligence concept
non-authoritative KBS value path
engineering workflow
24h engineering freshness boundary
```

但不能直接 merge 或 force-rebase 覆盖当前 #3070 / #3089 facts。

正确动作：

```text
fresh branch from current protected main
↓
selectively port only:
  cadence-intelligence logic
  engineering <=24h mode
  non-authoritative KBS value-path test
↓
rewrite cadence model around CONFIRMED_DAILY_BATCH
↓
preserve current #3070 soil / viability semantics
preserve #3089 EA9B observer
```

---

## 11. 已经踩过的坑，下一对话必须避免

### 11.1 不要为了快而修改 production authority

禁止直接：

```text
6h -> 24h
```

来让 EA5E2 production 通过。

允许：

```text
engineering <=24h
authority_effect=false
```

### 11.2 不要混淆两个 KBS stream

```text
KBS Raw Hourly:
DAILY_BATCH / production freshness / historical hourly weather

KBS Current Weather variate 25 soil:
~5-minute source rows / T-15 soil boundary
```

Raw Hourly daily batch 不能用于推导 soil first-seen 行为；soil 5-minute cadence 也不能用于推导 Raw Hourly freshness。

### 11.3 不要混淆时间语义

始终分别保留：

```text
Event / observation time
Availability / first-seen time
Retrieved time
Retained time
Ingested time
Runtime knowledge time
```

### 11.4 不要恢复旧 crop window

旧 current-season terminal T 已过期。

禁止：

```text
延长旧 crop window
重标时间
因为 KBS 新 batch 到了就复用旧 epoch
```

### 11.5 不要再把 soil 当 blocker

当前：

```text
:45 / T-15 = PROVEN_COMPATIBLE
```

不要继续补无必要的 soil samples 来替代真正的 crop / Raw Hourly blocker。

### 11.6 不要只看 workflow conclusion

所有关键 live / observer 结果必须读取 actual artifact / logs：

```text
SUCCESS workflow != authority established
SUCCESS observer != crop authority created
```

### 11.7 不要直接合并旧 cadence 分支

旧分支已和 main 分叉，必须从 current main 新开 carrier 并选择性移植。

### 11.8 不要弱化可信 invariant

必须保持：

```text
EA3 retrieved_at <= retained_at
soil [T-15m,T] inclusive
T-5 minimum ingress margin
no Formal writes during readiness
actual UTC / no accelerated formal clock
exact-head evidence binding
no source/time/cross-cycle substitution
```

---

## 12. 下一步计划

### Step 1 — 先读取今天真实 KBS batch

下一对话首先检查：

```text
latest KBS Raw Hourly cadence observer run/artifact
```

判断今天 daily batch 是否已经出现，并记录：

```text
actual publish first-seen time
observation-time coverage start/end
hour count
continuity
revision/backfill
latest event time
freshness age
```

### Step 2 — 检查 EA9B observer

读取：

```text
mcft-cap-09-ea9b-current-main-window-observer
```

判断是否发现新的 T1/T1R1 planting candidate。

若无 candidate：

```text
full EA5E2 today remains authority-blocked
```

但 engineering KBS validation 继续。

若有 candidate：进入 separate EA9B authority adjudication / crop-context requalification。

### Step 3 — 从 current main 新开 cadence-intelligence carrier

不要复用旧 diverged branch。

目标实现：

```text
provider_expected_update_behavior = DAILY_BATCH
batch completeness / continuity / revision metrics
production freshness <=6h
engineering validation <=24h
authority_effect=false for engineering mode
scheduler action = RUN / WAIT_NEXT_BATCH / DEFER / FAIL
```

### Step 4 — 先跑 engineering KBS value path

目标：尽快证明 KBS transport/parser/rainfall/ET0/value-path 在 daily-batch reality 下稳定。

不等待 full EA5E2 authority intersection。

### Step 5 — 只在所有 production gates 相交时跑一次 full EA5E2

必须同时满足：

```text
lawful requalified crop authority
AND Raw Hourly age <=6h
AND soil :45/T-15 viability
AND legal target T
AND sufficient pre-boundary lead
AND current protected-main exact-head gates
```

然后只做一次 explicit protected-main `workflow_dispatch`。

---

## 13. 下一对话恢复 checklist

```text
1. protected main exact SHA
2. current Taskbook / effective Amendments / Delivery Policy
3. latest Raw Hourly daily-batch observer artifact
4. today batch actual first-seen time + 24h completeness/continuity
5. latest EA9B observer artifact
6. current crop authority status
7. #3071 still diagnostic-only/unmerged?
8. any new cadence-intelligence carrier PR?
9. any new EA5E2 explicit live run?
```

当前最准确的一句话：

> EA5E2 runner/admission implementation 已基本闭合；soil exact-hour phase 已证明可用。KBS Raw Hourly 已确认是每天一次、一次约 24 小时数据的 daily-batch provider。后续测试必须对齐 daily batch 的实际发布时间：engineering validation 可在独立 <=24h non-authoritative 模式下快速推进；正式 EA5E2 仍保留 <=6h freshness authority，并且还需要新的 lawful crop-context requalification。不要再全天盲等或随机消耗 7h live window。
