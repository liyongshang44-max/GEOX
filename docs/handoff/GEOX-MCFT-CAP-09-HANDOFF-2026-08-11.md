# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-11

更新时间：2026-08-12 17:56（UTC+8）

> 本 handoff 只用于下一对话恢复工程上下文，不制造新的 authority / effectiveness / activation / crop-stage / epoch / Formal write 权限。若本文与当前 Taskbook、effective Amendments、protected `main`、exact PR head、exact workflow run 或 immutable artifact 冲突，以前述更高权威事实为准。

```text
repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
dc9b03a0197e94f64d0d06447999290057e722f2

protected_main_merge:
PR #3067 — MCFT-CAP-09: align EA5E2 soil readiness with frozen 15m selector

pr_3067_exact_head:
0373ea616ffdaf40ededf8f949684026303ae5e1

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

current_taskbook_version:
Complete Taskbook v0.5 — Stage 1B Design Freeze / S6

current_primary_authority_frontier:
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION

current_engineering_frontier:
S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08

current_live_run:
31584908899

current_live_run_subject:
dc9b03a0197e94f64d0d06447999290057e722f2

current_live_run_status_at_handoff:
IN_PROGRESS

ea5e2_implementation_qualified:
true

ea5e2_operational_activation_qualified:
false

current_season_stage_authority_established:
false

current_season_recovery_reopened:
false

successor_epoch_selected:
false

ea5e3_effective:
false

formal_execution:
0/24

mcft_cap09_complete:
false
```

---

## 0. 下一对话第一步

不要从旧 `2026-08-10` handoff、#3035、旧 run、旧 PR body 或本对话记忆继续。

第一步只查当前仓库事实：

```text
1. protected main 当前 SHA
2. run 31584908899 当前状态 / first substantive failure or success
3. run 31584908899 exact jobs / logs / artifacts
4. 最新 KBS publication cadence observer successful main run
5. Draft PR #3056 当前 state/head
6. EA9B 是否出现新的 post-2026-05-11 KBS Aglog T1/T1R1 planting evidence
```

当前 handoff snapshot 已确认：

```text
protected main = dc9b03a0197e94f64d0d06447999290057e722f2
#3067 merged = true
#3067 merge SHA = dc9b03a0197e94f64d0d06447999290057e722f2
live run 31584908899 = in progress
live run exact head = dc9b03a0197e94f64d0d06447999290057e722f2
```

---

## 1. 我们现在在做什么

任务仍是：

```text
MCFT-CAP-09 — Shadow-Online Promotion
目标：STAGE_1B_SHADOW_ONLINE_CLOSURE
当前大阶段：S6 Formal 24-hour closure
```

但必须区分两条线。

### 1.1 Primary authority frontier

```text
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION
```

当前 `season_2026_corn` 的 current-season bounded thermal salvage 已 terminal；没有合法 four-stage authority，也没有合法 successor epoch。

只有新的公开 KBS Aglog T1/T1R1 planting observation，且 observation date > `2026-05-11`，才允许重新跑 EA9B。

### 1.2 当前实际工程主线

```text
S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08
```

目标不是开始 Formal，而是证明已经 implementation-qualified 的 EA5E2 live provider / fixed-lag runtime 能在：

```text
真实 provider
真实 wall clock
真实 private transient R2
真实 isolated DB
真实 exact protected-main subject
```

下完整通过 operational activation qualification。

Amendment-08 冻结边界：

```text
IMPLEMENTATION_QUALIFIED != OPERATIONAL_ACTIVATION_QUALIFIED
```

当前仍然：

```text
ea5e2_implementation_qualified = true
ea5e2_operational_activation_qualified = false
```

即使 `31584908899` 最终 workflow PASS，也只形成 candidate evidence。下一合法 successor 仍是：

```text
S6-EA5E2-OPERATIONAL-ACTIVATION-EVIDENCE-FREEZE-UNDER-AMENDMENT-08
```

必须用独立 evidence-freeze/effectiveness PR 才能讨论：

```text
ea5e2_operational_activation_qualified = true
```

---

## 2. 已完成：current-season crop / thermal salvage 已正式关闭

前序 #3047–#3054 已完成，关键事实：

```text
season = season_2026_corn
planting date = 2026-05-11
hybrid = P0306Q
RM = 103
```

Amendment-10 只允许 bounded thermal proxy：

```text
silk interval = [1222, 1438] GDU
physiological maturity interval = [2392, 2608] GDU
```

#3054 最终 bounded Base-50 GDD：

```text
lower = 1714.626
upper = 1828.917
bounded LATE minimum = 2608
```

因此：

```text
CURRENT_SEASON_FOUR_STAGE_AUTHORITY_NOT_ESTABLISHED_UNDER_BOUNDED_GDD_PROXY
current_season_recovery_reopened = false
successor_epoch_selected = false
Formal = 0/24
```

禁止继续叠加 RM、related-product point threshold、P0306AM/P0306AMXT 等假设去救 current season。

---

## 3. 已完成：KBS publication cadence observer 已进入 protected main

### PR #3057

```text
KBS Publication Cadence Observer
merge main = 56e24c3abb540d74a208592d7a0698df600ee0c8
```

Workflow：

```text
.github/workflows/mcft-cap-09-kbs-publication-cadence-observer.yml
```

Exact source：

```text
https://lter.kbs.msu.edu/datatables/13.csv
KBS Raw Hourly Weather
```

Observer authority role：

```text
AVAILABILITY_OBSERVER_ONLY_NOT_FORMAL_EVIDENCE
```

它只记录 metadata：

```text
polled_at
snapshot digest / response bytes
parsed row count
latest event_time
new event count
forward batch / backfill / revision counts
last_not_seen_at
first_seen_at
publication-lag bracket
```

不公开 raw values，不写 Formal DB/R2/scheduler/canonical Runtime。

### PR #3058 — artifact restore redirect fix

Merge main：

```text
6df2241f1470e1df930498782b42c6ba9e813b41
```

踩坑：GitHub artifact API 会 302 到签名对象存储。旧 Python restore 把 `Authorization: Bearer GITHUB_TOKEN` 一起带到跨-host redirect，导致对象存储 401。

修复规则：

```text
GitHub API request may carry token
cross-host artifact download must strip Authorization
state chain only restores previous successful main artifact
failed runs never become predecessor
```

### 正式 baseline

```text
run = 31517782654
```

第一条 protected-main baseline 只能建立当前状态，不能给历史已有行伪造 availability time。

### 第一条真实 publication transition

```text
run = 31565265200
artifact = 9129224001
digest = sha256:0df0c260f67a43162020a3b2160ccd51d0e93b185a387c42af27c4dcab88bebd
```

观测：

```text
previous latest event = 2026-08-11T05:00:00Z
new latest event      = 2026-08-12T04:00:00Z
forward hourly events = 23
provider revisions    = 2
transition shape      = MIXED_FORWARD_AND_BACKFILL_OR_REVISION
last_not_seen_at      = 2026-08-12T02:45:09.677Z
first_seen_at         = 2026-08-12T05:03:31.413Z
```

这是一条强 burst/batch-like 信号，但目前只确认了第一条真实 transition。

Observer 合同要求至少 3 条真实 chained publication transitions 才能进行 cadence candidate classification。

所以当前禁止宣称：

```text
KBS = DAILY_BATCH
```

正确表述：

```text
第一条真实 transition 表现为 23 个 forward hourly events + 2 provider revisions 的 bursty/mixed publication。
publication cadence authority 尚未建立。
```

---

## 4. 已完成但仍非生效：External Evidence E/A/I/K candidate

Draft PR：

```text
#3056
head = f3b5d01dfb603825e3ea986bd84add6051c17a29
state = Draft / Open / Unmerged
```

候选时间模型：

```text
E = event time
A = source/provider availability time
I = actual ingested_at
K = available_to_runtime_at / runtime knowledge time
```

如果 provider 不给可信 publication timestamp：

```text
A ∈ (last_not_seen_at, first_seen_at]
```

候选 deterministic harness 已覆盖：

```text
hourly low latency
hourly fixed latency
delayed hourly
daily/batched publication
out-of-order arrival
provider revision
duplicate delivery
missing-interval backfill
```

原则：

```text
late evidence != retroactive Formal rescue
old canonical Evidence / lineage immutable
batch arrival -> N independent hourly Evidence records
```

#3056 当前仍不能因第一条 burst transition 而直接 merge。继续等至少 3 条真实 KBS transitions，再决定是否起正式 publication-profile / temporal-semantics Amendment。

---

## 5. EA5E2 live qualification 已踩过的失败与修复

### 5.1 Run 31566710679 — stale transient retention causality

Subject：

```text
main@6df2241f1470e1df930498782b42c6ba9e813b41
```

它第一次真正跨过 KBS `<=6h` freshness gate，进入 real pre-boundary provider phase。

第一处实质失败：

```text
EA3_RETAINED_BEFORE_RETRIEVAL
```

根因：readiness harness 的 transient R2 使用 content-addressed key；同一 raw digest 可能命中以前 retain 的对象，其旧 `retained_at` 早于当前 retrieval 的 `retrieved_at`。

### PR #3066 — 已修复并合并

```text
head = 97793927a9f29f7de05fe1d893360d53e79799da
merge = e1d9b6a160e7d8c897c010cfb6efe420119cbb87
```

必须保留：

```text
retrieved_at <= retained_at
```

旧 transient object 只有在：

```text
old retained_at >= current retrieved_at
```

时才可复用；否则 stale delete + re-retain 当前 verified bytes。

绝不能删掉或放宽 `EA3_RETAINED_BEFORE_RETRIEVAL` 来让测试变绿。

---

### 5.2 Run 31573422554 — soil readiness window conformance

Subject：

```text
main@e1d9b6a160e7d8c897c010cfb6efe420119cbb87
```

它通过：

```text
protected-main subject
private bindings
transient R2 smoke
KBS Raw Hourly <=6h freshness
```

KBS 当时：

```text
latest = 2026-08-12T04:00:00Z
age ≈ 3.319601h
```

Target：

```text
T = 2026-08-12T08:00:00Z
```

第一处实质失败：

```text
EA5E2_PREBOUNDARY_SOIL_OBSERVATION_NOT_IN_AUTHORIZED_T_WINDOW
```

冻结 CAP-03 V2 selector：

```text
LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2
max age = 900000ms
stale only when age > 900000ms
```

所以：

```text
T-15m observation is valid
```

旧 runner 却：

```text
observedAt > T-15m
first soil poll at T-10m
```

这比 frozen selector 更严格，并白白丢掉合法的 T-15 → T-10 采样段。

---

## 6. PR #3067 已完成并合并

PR：

```text
#3067 — MCFT-CAP-09: align EA5E2 soil readiness with frozen 15m selector
exact head = 0373ea616ffdaf40ededf8f949684026303ae5e1
merge main = dc9b03a0197e94f64d0d06447999290057e722f2
state = MERGED
```

最初 core conformance fix：

```text
soil first poll: T-10m -> T-15m
lower bound: observedAt > T-15m -> observedAt >= T-15m
```

保持冻结：

```text
max soil age = 15m
T-5m minimum ingestion margin
KBS Raw Hourly <=6h
same-source
same-cycle GFS
no time relabel
no Formal write
```

#3067 最终 exact head 不只包含最初 3-file 小修；在合并前已扩展为 20 commits / 6 files，并加入 readiness hardening，包括：

```text
critical activation dependency/path checks 扩展
pre-boundary lead guard
selected-T crop consensus preflight
smoke cleanup ledger 与 real provider refs 分离
pre-boundary failure cleanup evidence
GFS/soil acquisition orchestration hardening
bounded SAME_SOURCE_TRANSIENT_ONLY late transport retry
```

这一点是重要历史事实：旧 PR body 曾长期写“Exactly three files”，但 exact diff 已扩展。下一对话认 merged exact commit，不再按旧 body 推断边界。

---

## 7. 当前正在运行：EA5E2 live run 31584908899

当前 exact run：

```text
run = 31584908899
workflow = mcft-cap-09-ea5e2-operational-activation-live
workflow file = .github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml
event = push
head = main
subject = dc9b03a0197e94f64d0d06447999290057e722f2
status at handoff = IN_PROGRESS
```

这是修复 #3066 + #3067 后的第一条 protected-main live test。

它必须按顺序证明：

```text
exact protected-main subject
critical dependency/path identity
private bindings
transient R2 smoke
unchanged KBS Raw Hourly <=6h freshness
future target T with pre-boundary lead guard
conservative frozen crop consensus for selected T
PRE_BOUNDARY_CAUSAL provider phase
metadata-only interphase proof
real wall-clock wait phases
T+6h30 delayed exact-hour phase
same-cycle GFS
actual T+7h17 observer
private transient cleanup
public value artifact count = 0
raw values emitted = false
Formal DB/raw-prefix/scheduler/canonical writes = 0
Formal window started = false
```

### 对 run 31584908899 的下一动作

下一对话不要重新启动测试，先读取它当前结果。

如果仍 `in_progress`：继续监控，不要因为 pre-boundary/wait 阶段耗时长就判断卡死。这个 workflow 使用真实 wall clock，不是加速测试。

如果失败：只找第一处 substantive failure。不要把后续 skip/cancel 当根因。区分：

```text
A. frozen source/timing/authority 真实失败 -> fail closed，不绕过
B. readiness implementation/conformance bug -> 最小修复 + same-head gates + 新 protected-main run
C. provider/network transient -> 仅在 frozen authority 允许的 bounded same-source retry 范围内处理
```

如果完整 PASS：不要直接宣布 operational activation effective。立即进入：

```text
S6-EA5E2-OPERATIONAL-ACTIVATION-EVIDENCE-FREEZE-UNDER-AMENDMENT-08
```

冻结：

```text
protected-main SHA
run id
job id
target T
pre-boundary artifact + digest
interphase artifact + digest
late-phase artifact + digest
observer artifact + digest
cleanup artifact + digest
all non-effect/write counters
```

然后单独 PR 决定 effectiveness。

---

## 8. 后续 KBS publication / ingestion 方向

KBS Raw Hourly 继续是 Formal 主小时 Evidence：

```text
https://lter.kbs.msu.edu/datatables/13.csv
```

KBS 561 继续只做 direct daily extrema / GDD 辅助。

不得用 daily aggregate 替代 Raw Hourly Formal truth。

继续 protected-main cadence observer，直到 >=3 条真实 chained publication transitions。

如果最终坐实 delayed/batched publication，推荐模型：

```text
hourly event resolution
+ batch-aware ingestion
+ E/A/I/K
+ delayed assimilation
+ append-only revision lineage
+ no retroactive Formal rescue
```

即：

```text
1 provider publication batch -> N hourly Evidence records
```

而不是：

```text
1 daily row -> replace 24 hourly Evidence
```

不要为了适配 KBS 简单把 `<=6h` 改成 24h。真正 authority 如需变化，应基于多次真实 publication transition 建立 KBS-specific publication profile / governed lag。

---

## 9. EA9B 仍在等什么

Primary frontier：

```text
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION
```

Trigger：

```text
A_NEW_KBS_AGLOG_T1_OR_T1R1_PLANTING_OBSERVATION_WITH_OBSERVATION_DATE_AFTER_2026_05_11_BECOMES_PUBLICLY_RETRIEVABLE
```

新 season candidate 出现后必须 fresh 建立：

```text
new immutable season_id
actual crop authority
actual planting/emergence authority
fresh source/field binding
fresh bootstrap
fresh whole-window viability scan
```

禁止：

```text
auto season rollover
rotation inference as crop truth
cross-season stitch
旧 current-season stage 复用
future observation backfill 成旧 Formal
```

---

## 10. 进入 Formal O00 前仍缺什么

至少同时成立：

```text
A. 合法 crop / season / four-stage authority + successor epoch
B. EA5E2 operational activation effectiveness
C. EA5E3 Formal Authority V3 effectiveness
```

当前：

```text
A = false
B = false
C = false
Formal = 0/24
```

因此：

```text
EA5E3 / successor epoch / O00 / Formal writes 均不得提前授权
```

---

## 11. 本轮踩过的坑——必须避开

### 坑 1：把 hourly observation 当 hourly publication

KBS event resolution 是 PT1H，不代表网站每小时发布。只认 protected-main observer 的真实 first-seen chain。

### 坑 2：用 cron 计划时间当 source availability

GitHub Actions schedule 可延迟。只认 actual `polled_at`。

### 坑 3：baseline 给历史数据伪造 availability time

第一条 baseline 只能建立状态，不能倒推 A。

### 坑 4：artifact 302 跨 host 携带 GitHub token

#3058 已修。跨-host object-storage redirect 必须 strip Authorization。

### 坑 5：content-addressed transient object 复用旧 retained_at

#3066 已修。不能弱化：

```text
retrieved_at <= retained_at
```

必须 stale delete + re-retain。

### 坑 6：soil 15m selector 下边界写错

冻结规则是 `age > 900000ms` 才 stale，所以 `T-15m` 合法；readiness 不能用严格 `>` 排除。

### 坑 7：明明有 15m 合法窗口，却到 T-10 才开始 poll

#3067 已修到 T-15 开始 acquisition。不要再缩短冻结窗口。

### 坑 8：为了赶测试窗口改 authority

禁止临时改：

```text
KBS <=6h
soil max age 15m
T-5m ingestion margin
T+07:12 cutoff
T+07:17 observer
same-source / same-cycle
```

### 坑 9：workflow success 直接等同 activation effectiveness

错误。必须 separate evidence-freeze/effectiveness PR。

### 坑 10：重跑旧 run 验证新代码

错误。GitHub rerun 绑定旧 SHA。修复 merge 后必须用新的 protected-main run。

### 坑 11：PR body / handoff 落后于 exact diff

#3067 是明确案例：最初 body 写 3 files，但最终 head 是 20 commits / 6 files。任何 merge 决策必须重新看 exact head / diff / same-head checks。

### 坑 12：失败路径 cleanup artifact 缺 refs

如果 provider phase 在 normal metadata artifact 前失败，cleanup 必须仍可定位本次 transient refs。#3067 已加入 failure cleanup hardening；后续 run 要读 artifact 验证，不要只看 cleanup job 绿色。

### 坑 13：smoke refs 与真实 provider refs 混用

#3067 已在进入 real provider phase 前清掉 smoke-only cleanup ledger。后续不要把 smoke cleanup 当真实 pre-boundary cleanup evidence。

### 坑 14：把 daily/batch publication 语义化成 daily Evidence

错误。Batch 是运输/availability 现象，不改变 event resolution。24 个小时仍是 24 条 hourly Evidence。

### 坑 15：一次 burst transition 就宣布 DAILY_BATCH

错误。Observer 要求至少 3 条真实 chained transitions 才做 candidate classification。

### 坑 16：看到 pre-boundary 长时间 in_progress 就判断卡死

这个 qualification 使用真实 wall clock，存在真实 T-30、T-15、T+2h45、T+5h30、T+6h30、T+7h17 等等待。先对照 target T 和代码 schedule 再判断。

---

## 12. 下一对话最短接手路径

```text
1. 查询 protected main；当前 snapshot 应为 dc9b03a0197e94f64d0d06447999290057e722f2
2. 第一优先检查 run 31584908899 当前状态
3. 若 run 仍在跑：继续监控，不启动重复 live run
4. 若失败：读取 first substantive failure，区分 authority/provider failure vs implementation bug
5. 若 PASS：立即进入 EA5E2 evidence-freeze/effectiveness PR，不直接写 activation=true
6. 同时继续 KBS cadence observer，累计 >=3 transitions；#3056 保持 Draft
7. EA9B 继续等新的 post-2026-05-11 T1/T1R1 planting evidence
8. 没有 crop/season + EA5E2 effectiveness + EA5E3 effectiveness 前，Formal 固定 0/24
```

---

## 13. 权威底线

```text
current_season_stage_authority_established = false
current_season_recovery_reopened = false
successor_epoch_selected = false
ea5e2_operational_activation_qualified = false
ea5e3_effective = false
Formal O00–O23 started = false
Formal execution = 0/24
MCFT-CAP-09 complete = false
```

下一对话不得通过修改 handoff、workflow green、synthetic fixture、provider latency 推断、daily aggregate substitution 或旧 run rerun改写这些 authority facts。