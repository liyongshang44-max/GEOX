# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-12

更新时间：2026-08-12 17:58（UTC+8）

> 本 handoff 只用于恢复工程上下文，不制造新的 authority / effectiveness / activation / crop-stage / epoch / Formal write 权限。若本文与当前 Taskbook、effective Amendments、protected `main`、exact PR head、exact workflow run 或 immutable artifact 冲突，以前述更高权威事实为准。

```text
repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
dc9b03a0197e94f64d0d06447999290057e722f2

protected_main_merge:
PR #3067 — MCFT-CAP-09: align EA5E2 soil readiness with frozen 15m selector

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

current_taskbook_version:
Complete Taskbook v0.5 — Stage 1B Design Freeze / S6

primary_authority_frontier:
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION

current_engineering_frontier:
S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08

active_live_run_at_handoff:
31584908899

active_live_run_subject:
dc9b03a0197e94f64d0d06447999290057e722f2

active_live_run_state_at_handoff:
IN_PROGRESS / pre-boundary job / step 15 real provider phase

active_live_run_passed_before_step_15:
protected-main subject
private bindings
transient R2 smoke + cleanup
KBS Raw Hourly <=6h freshness
future target selection with pre-boundary lead guard
conservative frozen crop-stage preflight

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

**不要从 2026-08-11 handoff、#3035、旧 #3067 head 或旧失败 run 开始。**

第一步只做仓库事实核对：

```text
1. protected main 当前 SHA
2. run 31584908899 最终状态、jobs、logs、artifacts
3. 最新 protected-main KBS cadence observer run/artifact
4. #3056 Draft 状态
5. 是否已经出现新的 EA5E2 evidence-freeze/effectiveness PR
```

如果 `main != dc9b03a0197e94f64d0d06447999290057e722f2`，先查是什么 PR/commit 推进了 main，再继续。

---

## 1. 我们现在在做什么任务

总任务仍是：

```text
MCFT-CAP-09 — Shadow-Online Promotion
目标：STAGE_1B_SHADOW_ONLINE_CLOSURE
当前大阶段：S6 Formal 24-hour closure
```

当前有两条并行线。

### A. Primary authority frontier

```text
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION
```

它在等新的公开 KBS Aglog T1/T1R1 planting observation，且 observation date 必须晚于 `2026-05-11`。

当前没有合法 successor season / successor epoch。

### B. 当前工程主线

```text
S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08
```

我们正在证明 EA5E2 已实现的 fixed-lag / real-provider runtime 能在：

```text
protected main
real wall clock
real KBS providers
same-cycle GFS
private transient R2
isolated readiness DB
strict no-Formal-write boundary
```

下完整跑通 live operational-activation qualification。

Amendment-08 冻结：

```text
IMPLEMENTATION_QUALIFIED != OPERATIONAL_ACTIVATION_QUALIFIED
```

所以即使当前 live run PASS，也只是 candidate evidence；下一步仍是 separate evidence-freeze/effectiveness PR。

---

## 2. 已完成：current-season thermal salvage 已 terminal

#3047–#3054 已完成，不要重新走一遍 P0306 current-season salvage。

关键事实：

```text
season = season_2026_corn
planting = 2026-05-11
hybrid = P0306Q
RM = 103
```

Amendment-10 bounded proxy：

```text
silk = [1222, 1438] GDU
physiological maturity = [2392, 2608] GDU
```

#3054 live bounded Base-50 GDD：

```text
lower = 1714.626
upper = 1828.917
LATE-safe minimum = 2608
```

结论：

```text
CURRENT_SEASON_FOUR_STAGE_AUTHORITY_NOT_ESTABLISHED_UNDER_BOUNDED_GDD_PROXY
current_season_recovery_reopened = false
successor_epoch_selected = false
Formal = 0/24
```

禁止通过 RM、related-product point threshold、P0306AM/P0306AMXT 或 full-season hindsight 再救旧 current season。

---

## 3. 已完成：KBS publication cadence observer 已进入 protected main

### PR #3057

Merge：

```text
56e24c3abb540d74a208592d7a0698df600ee0c8
```

Workflow：

```text
.github/workflows/mcft-cap-09-kbs-publication-cadence-observer.yml
```

Formal 主小时源仍是：

```text
https://lter.kbs.msu.edu/datatables/13.csv
KBS Raw Hourly Weather
```

Observer 是：

```text
AVAILABILITY_OBSERVER_ONLY_NOT_FORMAL_EVIDENCE
```

只公开 metadata，不公开 raw values，不写 DB/R2/scheduler/canonical Runtime。

### PR #3058

Merge：

```text
6df2241f1470e1df930498782b42c6ba9e813b41
```

修复 GitHub Actions artifact restore 的 302 cross-host redirect auth bug：跨 host 下载 signed artifact 时必须剥离 `Authorization`，并且 predecessor chain 只接受 previous successful main artifact。

### 正式 baseline

```text
run 31517782654
```

### 第一条真实 publication transition

```text
run = 31565265200
artifact = 9129224001
digest = sha256:0df0c260f67a43162020a3b2160ccd51d0e93b185a387c42af27c4dcab88bebd
```

观测：

```text
previous latest = 2026-08-11T05:00:00Z
new latest      = 2026-08-12T04:00:00Z
forward events  = 23
provider revisions = 2
shape = MIXED_FORWARD_AND_BACKFILL_OR_REVISION
last_not_seen_at = 2026-08-12T02:45:09.677Z
first_seen_at    = 2026-08-12T05:03:31.413Z
```

这是强 burst/batch-like 信号，但只是一条 transition。

Observer 要求至少 3 条真实 chained transitions 才能做 cadence candidate classification，因此当前禁止宣称：

```text
KBS = DAILY_BATCH
```

---

## 4. 已完成但保持 Draft：#3056 E/A/I/K temporal-semantics candidate

```text
PR #3056
Draft / Open / Unmerged
head = f3b5d01dfb603825e3ea986bd84add6051c17a29
```

候选模型：

```text
E = event time
A = provider/source availability time
I = ingested_at
K = runtime knowledge time / available_to_runtime_at
```

没有可信 provider publication timestamp 时，只能写：

```text
A in (last_not_seen_at, first_seen_at]
```

8 类 deterministic fixtures 已通过，所有 production/Formal write count = 0。

#3056 仍然不是 authority。至少等真实 KBS cadence transitions 足够后，再决定是否起正式 publication-profile / temporal-semantics Amendment。

如果最终确认 batch publication，正确接入语义仍是：

```text
1 publication batch -> N independent hourly Evidence records
```

绝不能把 daily aggregate 替换成 Raw Hourly Formal Evidence。

---

## 5. EA5E2 live qualification 已经踩过的两个真实失败

### 5.1 Run 31566710679 — stale transient retention causality

Subject：

```text
main@6df2241f1470e1df930498782b42c6ba9e813b41
```

KBS `<=6h` 已 PASS，第一次真正进入 real pre-boundary provider phase。

第一处实质失败：

```text
EA3_RETAINED_BEFORE_RETRIEVAL
```

根因：content-addressed transient R2 复用了以前 retain 的同 digest object，旧 `retained_at` 早于当前 retrieval 的 `retrieved_at`。

### PR #3066 — 已修并合并

```text
head  = 97793927a9f29f7de05fe1d893360d53e79799da
merge = e1d9b6a160e7d8c897c010cfb6efe420119cbb87
```

必须保留核心 invariant：

```text
retrieved_at <= retained_at
```

旧 object 只有在 `old retained_at >= current retrieved_at` 才可复用；否则 stale delete + re-retain。

**绝不能弱化 EA3 invariant 来让 readiness test 通过。**

---

### 5.2 Run 31573422554 — soil 15m window conformance

Subject：

```text
main@e1d9b6a160e7d8c897c010cfb6efe420119cbb87
```

它通过：

```text
protected-main subject
private bindings
transient R2 smoke
KBS Raw Hourly <=6h
```

当时：

```text
latest KBS Raw Hourly = 2026-08-12T04:00:00Z
age = 3.319601h
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

所以 `T-15m` 本身合法。

旧 readiness runner 错在：

```text
observedAt > T-15m
first soil poll only at T-10m
```

它比 frozen selector 更严格，丢掉了 T-15 → T-10 的合法窗口。

---

## 6. PR #3067 已合并：soil-window conformance + live-window hardening

PR：

```text
#3067 — MCFT-CAP-09: align EA5E2 soil readiness with frozen 15m selector
final head = 0373ea616ffdaf40ededf8f949684026303ae5e1
merge main = dc9b03a0197e94f64d0d06447999290057e722f2
```

最初 core fix：

```text
soil first poll T-10 -> T-15
lower bound > T-15 -> >= T-15
```

但 PR 在推进过程中扩大为：

```text
20 commits
6 changed files
+668 / -58
```

最终 exact head 同时加入了 readiness hardening，包括：

```text
pre-boundary minimum lead guard
target crop-consensus preflight
failure-path transient cleanup ledger
expanded critical-path drift checks
bounded SAME_SOURCE_TRANSIENT_ONLY late transport retry
runner qualification / orchestration conformance updates
```

这次最大的治理教训：**PR body 一度仍写“Exactly three files”，但 exact diff 已经是 6 files / 20 commits。下一次任何 PR merge 前都必须重新核 exact head + changed files + diff + same-head checks。**

#3067 最终合并说明这些 hardening 已进入 protected main；不要回滚到早期 `69a9202...`、`c0dbad...` 或最初 3-file 版本。

---

## 7. 当前真正状态：新的 protected-main EA5E2 live run 已自动开始

#3067 merge 后，push 自动触发：

```text
run = 31584908899
workflow = mcft-cap-09-ea5e2-operational-activation-live
subject = main@dc9b03a0197e94f64d0d06447999290057e722f2
status at handoff = IN_PROGRESS
```

在 handoff snapshot 时，该 run 已通过：

```text
1. protected-main subject and activation-boundary check
2. private R2 + Formal read-only bindings
3. transient R2 round-trip + cleanup smoke
4. smoke-only cleanup ledger reset
5. unchanged KBS Raw Hourly <=6h freshness gate
6. future target T selection with explicit pre-boundary lead guard
7. conservative frozen crop-stage consensus preflight
```

当前正在：

```text
step 15 — Execute real pre-boundary provider phase with private transient R2 and isolated DB
```

**下一对话第一优先级不是再修代码，而是先看 run 31584908899 的最终结果。**

如果它仍在正常 real-wall-clock phase 中，等待，不要并发再起第二条 live qualification。

如果失败：只定位第一处实质失败，区分：

```text
frozen authority / provider truth failure
vs
readiness implementation / orchestration bug
```

不要用后续 skipped/cancelled steps 当 root cause。

如果完整 PASS：只进入 evidence-freeze/effectiveness PR，不直接宣布 operational activation effective。

---

## 8. run 31584908899 完整 PASS 的验收标准

不能只看 workflow `success`。

必须读取 exact logs/artifacts，确认：

```text
exact protected-main subject
KBS <=6h remained valid under frozen authority
selected T identity
crop-consensus preflight PASS without inventing stage
pre-boundary proof PASS
soil observation within inclusive [T-15m, T] selector semantics
T-5m minimum ingress margin preserved
GFS same-cycle pair
metadata-only interphase proof
real wall-clock waits / no accelerated clock
T+6h30 exact-hour phase
bounded same-source-only transport retries
T+7h17 actual observer
pre rehydration semantic hash match
no provider re-fetch during private rehydration
all transient refs cleaned
public raw/value artifact count = 0
Formal DB/raw-prefix/scheduler/canonical writes = 0
Formal window started = false
```

完整 PASS 的下一合法 successor：

```text
S6-EA5E2-OPERATIONAL-ACTIVATION-EVIDENCE-FREEZE-UNDER-AMENDMENT-08
```

只有 separate exact-head evidence/effectiveness PR 合并后，才能考虑：

```text
ea5e2_operational_activation_qualified = true
```

---

## 9. Primary EA9B 仍然在等什么

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

禁止 auto rollover、rotation inference、cross-season stitch、旧 stage 复用。

---

## 10. 进入 Formal O00 前仍然缺什么

至少必须同时成立：

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

所以当前 live readiness 即使成功，也不能自动启动 EA5E3 / successor epoch / O00 / Formal writes。

---

## 11. 必须避开的坑

### 11.1 hourly event != hourly publication

KBS 每行是 PT1H 事件，不代表网站每小时发布。只认 observer 的真实 `polled_at` 和 first-seen transition。

### 11.2 cron time != actual poll time

GitHub scheduled run 可延迟几十分钟。不得用 `:17` cron 反推 A。

### 11.3 baseline 不得伪造历史 availability

第一条 observer baseline 只建立当前状态，不给既有行倒推 A。

### 11.4 artifact 302 redirect 不得跨 host 携带 GitHub token

#3058 已修，不要回退。

### 11.5 transient R2 content-addressed reuse 不得破坏 retention causality

#3066 已修。保留 `retrieved_at <= retained_at`，stale object 必须 re-retain。

### 11.6 soil selector 边界是 inclusive T-15m

冻结 max age = 900000ms，只有 `age > 900000` 才 stale。

不得再使用严格 `observedAt > T-15m`。

### 11.7 不要为了赶测试改 frozen authority

不得修改：

```text
KBS <=6h
soil max age 15m
T-5m ingress margin
T+07:12 cutoff
T+07:17 observer
same-source / same-cycle rules
```

### 11.8 workflow green != activation effective

live PASS 只是 candidate evidence，仍需 evidence-freeze/effectiveness PR。

### 11.9 不要 rerun 旧 SHA 去验证新代码

GitHub rerun 仍绑定原 commit。新 hotfix 合并后必须用新的 protected-main run。

### 11.10 PR body / handoff 会落后于 exact diff

#3067 已实际发生。任何 merge 前重新查 exact head / changed files / diff / same-head checks。

### 11.11 pre-boundary 失败也必须可清理 transient refs

失败可能发生在 normal metadata artifact 生成之前。必须依赖 failure-path cleanup ledger，不得把 smoke refs 和 real provider refs 混在一起，也不得触碰 Formal raw prefix。

### 11.12 batch publication != daily semantic aggregation

即使 KBS 一次发布 24 个小时，也仍是 24 条 hourly Evidence；datatable 561 只做 daily extrema/GDD 辅助，datatable 7 是 synthetic record，不能替换 Formal Raw Hourly。

### 11.13 Enviroweather/NWS 只能做 sentinel

不能因为地理位置接近就替换 KBS002-007 Raw Hourly Formal truth。

---

## 12. 下一对话最短接手路径

```text
1. 查 current protected main
2. 先查 run 31584908899 final status/jobs/logs/artifacts
3. 若仍 running：只监控当前 run，不并发再起一条
4. 若 fail：定位第一处 substantive failure，判断是 authority/provider truth 还是 implementation bug
5. 若 PASS：核完整 artifact chain，然后开 EA5E2 evidence-freeze/effectiveness PR
6. 同时继续 KBS cadence observer，累计 >=3 real transitions；#3056 保持 Draft
7. EA9B 继续等 post-2026-05-11 新 T1/T1R1 planting evidence
8. 没有 crop/season + EA5E2 effectiveness + EA5E3 effectiveness 前，Formal 永远保持 0/24
```

---

## 13. 当前 authority 底线

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

不得通过修改 handoff、workflow success、synthetic fixture、provider-latency 推断、daily aggregate substitution 或旧 run rerun 改写这些 authority facts。
