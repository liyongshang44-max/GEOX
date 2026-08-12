# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-13

更新时间：2026-08-13 02:05（UTC+8）

```text
repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
edd8a005702dee309e72b21384c8de5f8f3bd4fa

protected_main_merge:
PR #3069 — docs(mcft-cap09): add 2026-08-12 continuation handoff

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

current_taskbook_version:
Complete Taskbook v0.5 — Stage 1B Design Freeze / S6

current_primary_frontier:
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION

parallel_operational_frontier:
S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08

active_implementation_pr:
PR #3070 — complete EA5E2 preflight before next live window

active_implementation_pr_head:
a03d2bac28a518cc3d722ea7c3e9c208441ab676

active_implementation_pr_state:
READY / OPEN / UP-TO-DATE / ordinary CI still running at snapshot

ea5e2_implementation_qualified:
true

ea5e2_operational_activation_qualified:
false

soil_t_minus_15_phase:
PROVEN_COMPATIBLE / 2 repeat exact-row samples

kbs_raw_hourly_freshness_authority:
<=6h unchanged

next_test_scheduler_planning:
TREAT_AS_ONE_DAILY_HIGH_VALUE_PUBLICATION_WINDOW

kbs_daily_publication_is_authority:
false

successor_epoch_selected:
false

ea5e3_effective:
false

formal_execution:
0/24

mcft_cap09_complete:
false

handoff_authority_class:
CONTINUATION_CONTEXT_ONLY
```

---

## 0. 权威顺序

本 handoff 只恢复工程上下文，不制造 effectiveness、activation、crop/season/stage、provider SLA、epoch 或 Formal write authority。

```text
1. 当前 Taskbook + effective Amendments + Delivery Policy
2. protected main repository fact
3. exact PR head / workflow run / immutable artifact / live read-only proof
4. 本 handoff
```

若冲突，以更高权威事实为准。

---

## 1. 当前任务定位

```text
MCFT-CAP-09 — Shadow-Online Promotion
目标：STAGE_1B_SHADOW_ONLINE_CLOSURE
当前大阶段：S6 Formal 24-hour closure
```

Formal 尚未开始。至少仍需同时成立：

```text
A. 合法 crop / season / four-stage authority + successor epoch
B. EA5E2 operational activation effectiveness
C. EA5E3 Formal Authority V3 effectiveness
```

当前 A、B 未成立：

```text
Formal = 0/24
```

Amendment-08 继续冻结：

```text
IMPLEMENTATION_QUALIFIED != OPERATIONAL_ACTIVATION_QUALIFIED
```

---

## 2. run 31584908899：最终失败事实

Subject：

```text
main@dc9b03a0197e94f64d0d06447999290057e722f2
```

第一处实质失败：

```text
EA5E2_PREBOUNDARY_SOIL_OBSERVATION_NOT_IN_AUTHORIZED_T_WINDOW
```

启动时：

```text
KBS Raw Hourly latest = 2026-08-12T04:00:00Z
age = 5.891522h <= 6h
T = 2026-08-12T11:00:00Z
```

真实 provider phase 在 T-5 前没有取得合法 `[T-15m,T]` soil observation，因此 fail closed。

已证明失败后无 authority side effect：

```text
private transient R2 refs cleaned = 4
public value artifact count = 0
Formal DB/raw/scheduler/canonical writes = 0
Formal = 0/24
```

不得扩大 soil 15m window、减少 T-5 ingress margin、换 source、relabel time 或 accelerated clock 来规避该失败。

---

## 3. Soil endpoint25：T-15 exact-hour phase 已证明兼容

Soil source：

```text
https://lter.kbs.msu.edu/weather/variates/25
KBS Current Weather variate 25 JSON
```

Frozen semantics：

```text
soil selector = inclusive [T-15m,T]
minimum ingress margin = 5m before T
```

#3071 diagnostic-only exact-row first-seen evidence：

```text
2026-08-12T13:45Z -> upper-bound lag 5.466m <= 10m
2026-08-12T15:45Z -> upper-bound lag 5.590m <= 10m
```

因此 scheduler-only phase state：

```text
T-15 / :45 = PROVEN_COMPATIBLE
repeat samples = 2
minimum repeat = 2
```

其它 phase：

```text
T-10 / :50 = PROVEN_INCOMPATIBLE against 5m budget
T-5  / :55 = PROVEN_INCOMPATIBLE against 0m budget
```

该结论：

```text
authority_effect = false
formal_effect = false
```

只用于下一次 live-window admission。

---

## 4. PR #3070：当前 exact-head 状态

PR：

```text
#3070 — MCFT-CAP-09: complete EA5E2 preflight before next live window
```

第二条 soil :45 evidence 冻结后旧 head：

```text
b6fc016a3156ceef703a22aa4fd41eb0ca00d312
```

旧 head 全部主要 workflow 已绿，但 PR 当时：

```text
mergeable_state = behind
```

GitHub ruleset 因 strict up-to-date 拒绝 merge。

已执行非 force Update branch，当前真正 up-to-date head：

```text
a03d2bac28a518cc3d722ea7c3e9c208441ab676
```

Snapshot 时以下 workflow 已 SUCCESS：

```text
runtime dependency graph
candidate declaration selftest
CAP08 authority reconciliation
Delivery Policy
Main Ruleset readiness
EA5E2 live-window preflight hardening
release lane
EA5E2 runner qualification
```

Ordinary CI：

```text
run 31625369374 = IN_PROGRESS at snapshot
```

下一对话必须核 `a03d2bac...` exact-head，不得用旧 `b6fc...` 绿灯代替。

#3070 已实现：

```text
expensive live = workflow_dispatch only
read-only viability preflight before side effects
Raw Hourly <=6h authority unchanged
soil phase admission SSOT
T+390 semantic availability polling
T+432 cutoff unchanged
T+437 observer unchanged
same-source / same-cycle / real wall clock unchanged
NO_VIABLE_LIVE_WINDOW before expensive live when admission not proven
```

---

## 5. KBS Raw Hourly publication：下一次按 daily window 做工程准备

Formal 主小时源：

```text
https://lter.kbs.msu.edu/datatables/13.csv
```

已观察到真实 transition：

```text
2026-08-11T05:00Z -> 2026-08-12T04:00Z
forward events = 23
provider revisions = 2
shape = MIXED_FORWARD_AND_BACKFILL_OR_REVISION
first seen = 2026-08-12T05:03:31Z
```

之后 observer 多次 NO_CHANGE，latest 仍为 `2026-08-12T04:00Z`，所以当前已超过 frozen `<=6h` freshness gate，不能启动 live。

Repository transition evidence 仍不足以把 `DAILY_BATCH` 写成 formal cadence authority。

但下一次测试的工程 planning 从现在起必须按：

```text
ONE_DAILY_HIGH_VALUE_PUBLICATION_WINDOW
```

处理。该 planning rule：

```text
authority_effect = false
provider_SLA_claim = false
```

含义是：所有 repository-controlled preparation 必须在 KBS 发布前完成，不能把当天唯一机会浪费在临时修代码、临时跑 CI 或机械选择 next whole-hour T。

---

## 6. 下一次 daily window 前必须完成的准备

```text
1. #3070 up-to-date exact head all required checks green
2. #3070 merge into protected main
3. post-merge protected main SHA verified
4. crop successor / lawful future target authority ready if old window expired
5. private R2 bindings verified without exposing secrets
6. readiness DB binding verified
7. GFS exact same-cycle path qualified
8. soil T-15/:45 phase evidence frozen + SSOT green
9. cleanup ledger / stale transient cleanup qualified
10. dependency graph exact digest green
11. no auto-push expensive live
12. candidate-T search/precompute ready before KBS publication
```

KBS 发布后只允许分钟级 admission：

```text
publication transition
-> Raw Hourly current-read <=6h
-> soil proven T-15 phase
-> legal crop target T
-> sufficient pre-boundary lead
-> private binding / critical path health
-> READY(candidate T) or NO_VIABLE_LIVE_WINDOW
```

只有 `READY` 才 workflow_dispatch。

禁止再出现：

```text
mechanically choose next whole hour
-> start live
-> later discover provider timing impossible
```

---

## 7. Crop / season authority 仍是独立 blocker

Primary authority frontier：

```text
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION
```

旧 current-season thermal salvage 已 terminal。

#3070 当前 PR body 记录旧 crop context terminal legal T：

```text
2026-08-12T21:00:00Z
```

如果下一次 KBS publication 已晚于合法 target window，不能沿用旧 T；必须先取得 lawful successor / requalified crop context authority。

禁止 automatic stage rollover、future hindsight、cross-season stitching、invented successor epoch。

---

## 8. 下一次 EA5E2 live 的 dispatch gate

只有以下条件同时成立才允许消耗 daily window：

```text
protected main exact SHA
+ Raw Hourly current-read age <= 6h
+ soil T-15/:45 PROVEN_COMPATIBLE
+ legal crop target T
+ sufficient pre-boundary lead
+ private R2/readiness DB healthy
+ GFS same-cycle healthy
+ critical dependency graph green
```

然后仍按真实 wall clock：

```text
PRE -> T -> T+390 -> T+432 -> T+437
```

Frozen constraints 不变：same source、same cycle、no substitution、no time relabel、no accelerated clock、soil `[T-15m,T]`、T-5 margin。

---

## 9. PASS 之后仍不能直接 Formal

EA5E2 live 完整 PASS 只产生 candidate operational-activation evidence。

下一合法 successor 是 separate evidence-freeze/effectiveness adjudication。只有 authority 生效后才允许：

```text
ea5e2_operational_activation_qualified = true
```

之后仍需 lawful successor crop/season/epoch + EA5E3 effectiveness。

当前保持：

```text
successor_epoch_selected = false
ea5e3_effective = false
Formal O00-O23 started = false
Formal execution = 0/24
MCFT-CAP-09 complete = false
```

---

## 10. 当前不要做的事

```text
不要重跑 31584908899
不要因为 soil phase 通过就跳过 Raw Hourly <=6h
不要把 daily-window planning 写成 provider authority
不要降低 6h freshness
不要扩大 soil 15m selector
不要减少 T-5 margin
不要 source/time/cycle substitution
不要 accelerated clock
不要把 #3071 diagnostic 直接变 authority
不要在 crop authority 过期后沿用旧 T
不要启动 EA5E3
不要启动 Formal O00-O23
```

---

## 11. 下一对话接手顺序

```text
1. 读取 docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-13.md
2. 核 protected main 当前 SHA
3. 核 #3070 exact head / mergeable_state / required checks
4. 若 a03d2bac... 全绿且 up-to-date，按 exact SHA merge
5. merge 后重新核 protected main，不自动 dispatch live
6. 核最新 KBS cadence observer / Raw Hourly latest event
7. 核 crop successor / future target authority
8. 只有 admission 全 PASS 才考虑下一次 live
```

若 #3070 已合并，下一工程任务：

```text
NEXT-DAILY-WINDOW-PREPARATION
= crop successor readiness
+ provider-compatible target precompute
+ publication-triggered read-only admission
+ one deliberate live dispatch
```

---

## 12. 一句话接手摘要

```text
MCFT-CAP-09 仍在 S6，Formal 0/24。EA5E2 implementation 已 qualified、operational activation 未 qualified。run 31584908899 因真实 soil pre-boundary availability fail closed，且无 Formal side effects。#3071 已补出第二条独立 T-15/:45 exact-row first-seen evidence，使 soil scheduler phase 达到 2-repeat PROVEN_COMPATIBLE。#3070 已完成 fail-closed live-window admission、soil phase SSOT、dependency binding 和 manual-only expensive live orchestration，并 Update branch 到 up-to-date head a03d2bac...；snapshot 时仅 ordinary CI 仍在跑。KBS Raw Hourly 当前已超过 6h freshness；formal cadence authority 仍不足，但下一次工程调度必须按每天一次高价值 publication window 做全部前置准备。下一步是 #3070 exact-head 全绿后合入 main，然后提前准备 crop successor + candidate-T precompute；KBS 发布后只做分钟级 admission，READY 才消耗当天唯一 live 窗口。
```
