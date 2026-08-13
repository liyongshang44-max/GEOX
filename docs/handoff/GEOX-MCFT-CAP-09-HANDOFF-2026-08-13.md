# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-13

更新时间：2026-08-13 10:23（UTC+8）

> 本 handoff 只用于恢复工程上下文，不制造新的 authority / effectiveness / activation / crop-stage / epoch / Formal write 权限。若本文与 current Taskbook、effective Amendments、protected `main`、exact PR head、workflow run 或 immutable artifact 冲突，以前述更高权威事实为准。

```text
repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
8b51945b64f765e8e7a819045a9fe75a1d105468

protected_main_latest_merge:
PR #3089 — feat(mcft-cap09): prepare daily KBS crop-window readiness observer

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

current_taskbook_header:
Complete Taskbook v0.5 — Stage 1B Design Freeze / S6 Amendment-01 + Amendment-02 + Amendment-03 + Amendment-04 Bound

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

kbs_raw_hourly_cadence_classification:
INSUFFICIENT_TRANSITIONS (1 real chained transition)

formal_execution:
0/24

mcft_cap09_complete:
false
```

---

## 0. 下一对话第一步

不要从旧 2026-08-12 handoff、旧 #3070 Draft 状态、旧 soil `INSUFFICIENT_REPEAT_EVIDENCE` 状态、或旧 live run 继续。

第一步只做当前仓库事实核对：

```text
1. protected main 当前 SHA
2. latest KBS Raw Hourly cadence observer run + artifact
3. latest EA9B current-main crop-window observer run + artifact
4. #3071 是否仍为 diagnostic-only / unmerged
5. 是否已有新的 crop-context requalification authority PR
6. 是否已有新的 EA5E2 explicit live run
```

如果 protected main 不再是 `8b51945b...`，先确认推进 main 的 PR/commit，再重裁 frontier。

---

## 1. 我们在做什么

总任务仍是：

```text
MCFT-CAP-09 — Shadow-Online Promotion
目标：STAGE_1B_SHADOW_ONLINE_CLOSURE
最终：真实 UTC O00–O23 24 小时 Formal closure
```

当前不是在“写一个新 runtime”，而是在把已经实现的 Shadow-online runtime 推过真实 provider / real-wall-clock operational qualification。

当前有两条必须分开的线：

### A. Authority 主线

```text
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION
```

旧 `season_2026_corn / planting 2026-05-11` 的 frozen crop context 已经没有新的合法 EA5E2 target T。任何 2026-08-13 或更晚的完整 EA5E2 live qualification，都需要新的 lawful successor / requalified crop-context authority。

### B. Engineering / provider 主线

```text
KBS provider temporal behavior + EA5E2 admission / value-path qualification
```

目标是两件事：

1. 不再随机消耗约 7h 的 live window；
2. 让 KBS 数据路径可以在今天快速、稳定地做 engineering validation，同时不把 engineering validation 冒充 production authority。

---

## 2. 本对话从哪里开始：run 31584908899

本对话的工程主线从 protected-main EA5E2 live run `31584908899` 的失败分析开始。

当时 subject：

```text
main@dc9b03a0197e94f64d0d06447999290057e722f2
```

该 run 在 pre-boundary 前置条件上通过了：

```text
exact protected-main subject
private bindings
transient R2 smoke + cleanup
KBS Raw Hourly <=6h freshness
future target selection
crop consensus
```

KBS Raw Hourly precheck 当时：

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

失败发生在约 `10:54:33Z`，即 T-5 附近。

正确分类：

```text
Immediate provider truth:
no authorized endpoint-25 soil observation became visible early enough
inside frozen [T-15m,T] while preserving T-5m ingress margin

Readiness weakness exposed:
target/window admission did not model provider first-seen temporal behavior
```

它不是“15m authority 太严格”的证明，也不是网络偶发错误可以直接解释掉的失败。

失败 cleanup 正常完成，没有 Formal write / public raw-value artifact 泄漏。

---

## 3. 为什么后来做 #3070

`31584908899` 暴露了一个高成本问题：

```text
一个本来就不值得运行的 provider window
也会进入长 real-wall-clock qualification
```

因此本对话把 EA5E2 改为先做 admission，再决定是否烧 live window。

### PR #3070

```text
MCFT-CAP-09: complete EA5E2 preflight before next live window
merged_at = 2026-08-12T18:11:36Z
merge = 1c27cf70f62503e89e37602a6f267141e0546bcf
```

#3070 已经合并，不再是 Draft。

它完成：

1. expensive EA5E2 live workflow 改为 `workflow_dispatch` only；
2. live-window viability preflight 在 DB/R2/live activation side effects 之前运行；
3. late exact-hour availability 改为 read-only same-source exact-T polling；
4. frozen T+390 / T+432 / T+437 不变；
5. soil endpoint 25 独立建模，不再和 Raw Hourly 混在一起；
6. global soil p95/max 只作为 diagnostic；
7. candidate-T soil admission 改为 exact-hour phase-conditioned SSOT；
8. deterministic selftest / dependency graph / full-chain / ordinary CI / release gates 均已通过。

Protected main 当前 live workflow 仍明确保留 production Raw Hourly `<=6h` gate。

---

## 4. Soil 问题已经关闭：不要再把它当当前 blocker

### #3071 diagnostic

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

Protected main 当前冻结的 soil evidence：

`docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-SOIL-FIRST-SEEN-EVIDENCE-V1.json`

当前 authoritative repository fact（scheduler heuristic only, authority_effect=false）：

```text
status = GLOBAL_DIAGNOSTIC_SUFFICIENT_PHASE_ADMISSION_PROVEN_COMPATIBLE
```

### Exact-hour phase result

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
phase = :45 / T-15
```

这意味着 soil 已经有可用的 provider-compatible exact-hour phase。

**禁止继续使用旧 handoff 中“:45 只有 1 条 / soil evidence insufficient / proven compatible count=0”的叙述。**

Global p95/max 约 10.969m 仍然只是 diagnostic，不得重新变成 universal candidate-T authority。

---

## 5. Raw Hourly 才是当前 KBS temporal blocker

Protected-main cadence workflow：

```text
.github/workflows/mcft-cap-09-kbs-publication-cadence-observer.yml
schedule = 17 * * * *
```

它逐次恢复 previous successful main artifact，形成 chained metadata state。

截至本 handoff，最新已核 artifact-level run：

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

因此到接近 24:00Z，Raw Hourly 仍停在 04:00Z，production `<=6h` freshness 显然不成立。

历史唯一已确认 chained transition：

```text
first_seen around 2026-08-12T05:03:31Z
previous latest = 2026-08-11T05:00Z
new latest = 2026-08-12T04:00Z
forward events = 23
revisions = 2
shape = MIXED_FORWARD_AND_BACKFILL_OR_REVISION
```

这是非常强的 daily/burst-like 信号，但 repository policy 要求至少 3 个真实 chained transitions 才允许 cadence classification。

所以当前只能说：

```text
scheduler heuristic:
observed release window is around ~05:00Z

authority:
INSUFFICIENT_TRANSITIONS
```

不能正式写 `KBS = DAILY_BATCH`。

---

## 6. 为什么“今天 full EA5E2”不只是等 KBS fresh

旧 frozen crop context：

```text
season = season_2026_corn
planting = 2026-05-11
crop = corn
six FAO variants
backward guard = 6h
forward guard = 30h
```

#3070 已计算并冻结：

```text
terminal legal target T = 2026-08-12T21:00:00Z
latest lawful dispatch = 2026-08-12T20:10:00Z
```

因此到了 2026-08-13：

```text
old crop authority cannot legally supply a new EA5E2 target T
```

也就是说，今天即使 Raw Hourly 在约 05:00Z 恢复到 `<=6h`，也不能直接用旧 crop context 跑 full EA5E2。

今天 full EA5E2 的两个硬阻塞是：

```text
A. lawful successor / requalified crop-context authority not yet established
B. Raw Hourly current-read freshness currently >6h until provider publishes
```

Soil 不再是 blocker。

---

## 7. #3089：为今天的 crop authority window 做准备

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

作用：扫描 KBS Aglog，在 2026-05-11 anchor 之后寻找新的 T1/T1R1 Planting candidate metadata。

它只做 readiness observation，明确不能：

```text
create season
create crop authority
select successor epoch
select EA5E2 target T
write DB/R2/canonical state
start EA5E2/EA5E3/Formal
```

截至 handoff 时（约 2026-08-13T02:23Z），protected-main schedule 尚未到 05:10Z，因此 current-main run count = 0 是正常状态。

如果后续 observer 找到 candidate，也还必须经过 separate EA9B authority adjudication / requalification 才能成为 live crop authority。

---

## 8. 今天怎么稳定地“通过 KBS 测试”——必须分两种测试

### 8.1 KBS engineering data-path test：今天可以稳定推进

用户当前最关心的是不要每天等一次 provider window，先把 KBS 数据路径尽快跑通。

正确方案不是把 production authority `6h -> 24h`，而是两层 freshness：

```text
Layer 1 — Production Freshness Authority
latest Raw Hourly age <= 6h
决定：EA5E2 production qualification / effectiveness

Layer 2 — Provider Cadence / Engineering Intelligence
识别 provider expected delay / release window
决定：PASS / DEFER / FAIL 的 scheduler/readiness 行为
```

Engineering validation 可以有独立、明确的：

```text
ENGINEERING_VALIDATION_MAX_AGE_HOURS = 24
```

但必须同时输出：

```text
authority_effect = false
formal_activation = false
ea5e2_effectiveness = false
```

它的用途只是验证：

```text
KBS transport
parser
hourly event identities
rainfall / ET0 value path
coverage semantics
provider metadata
```

而不是宣布 production qualification。

### 8.2 今天最合理的快速测试节奏

根据目前唯一一次真实 Raw Hourly transition，provider release heuristic 在约 `05:00Z`。

因此今天应：

```text
~04:45Z 开始高频/短周期 read-only watch
05:00–05:20Z 捕获 Raw Hourly advance
一旦 advance：立即计算 current age / batch shape / transition #2
同时启动 engineering KBS value-path test
```

这不是 cadence authority，只是 scheduler heuristic。

如果 latest Raw Hourly 仍旧没有发布：

```text
engineering path:
<=24h -> 可继续验证，标记 NON_AUTHORITATIVE_ENGINEERING_VALIDATION

production path:
>6h -> DEFER / NO LIVE
```

这样就不会再“为了验证代码，等一天”。

---

## 9. 今天 full EA5E2 的稳定执行条件

Full EA5E2 不能靠 24h engineering override 通过。

只有以下条件全部相交才允许 explicit live：

```text
1. new lawful/requalified crop authority exists
2. Raw Hourly current age <=6h
3. soil phase :45 / T-15 = PROVEN_COMPATIBLE
4. legal exact-hour T exists under new crop authority
5. pre-boundary lead >= frozen minimum
6. exact protected-main critical path checks PASS
7. viability preflight PASS
```

今天的执行规则：

### 情况 A：05:10/06:10/07:10 EA9B observer 没有发现新 planting candidate

```text
FULL EA5E2 = impossible today under current authority
```

不要烧 7h live。

继续：

```text
KBS engineering validation
Raw Hourly cadence collection
soil diagnostic only as needed
```

### 情况 B：EA9B observer 发现 candidate

不能直接 live。

顺序：

```text
candidate metadata
→ separate EA9B authority adjudication/requalification
→ merge protected main
→ rederive crop target legality
→ check Raw Hourly <=6h
→ read-only viability preflight
→ PASS 后 explicit dispatch exactly one EA5E2 live
```

### Candidate-T 选择

soil 已证明 `T-15 / :45` phase compatible，因此 exact-hour T 应继续使用这一自然 phase，不需要等待 :50/:55。

---

## 10. Provider cadence intelligence 分支：不要直接 merge

现有分支：

```text
agent/mcft-cap09-provider-cadence-intelligence
head = 8bda55eb13b4a913a8d7934cf705c0fb2d884898
```

它不是空分支，已经包含一组真实 engineering work，包括：

```text
docs: define KBS provider cadence intelligence layer
feat: non-authoritative KBS value path
ci: execute KBS engineering value path
fix: align engineering KBS coverage semantics with EA4
docs: freeze 24h engineering freshness boundary
```

但它的 merge base 是旧 `df0cb0ec...`，现在相对 current main 已 diverged。

Current main 已经包含它没有的：

```text
final merged #3070 state
final soil evidence (:45 PROVEN_COMPATIBLE)
#3089 EA9B observer
```

因此：

**禁止直接 merge / force-rebase 这个旧分支。**

正确做法：

```text
fresh branch from current protected main
→ selectively port / reimplement only cadence-intelligence + ENGINEERING_VALIDATION pieces
→ preserve current #3070/#3089 files and evidence
→ run exact current-head CI/governance
```

这是下一工程动作。

---

## 11. 今天应立即做的工程计划

### P0 — Fresh current-main cadence/engineering carrier

从 `8b51945...` 或更晚的 protected main 创建 fresh branch。

只迁移旧 cadence-intelligence 分支中以下概念：

```text
provider cadence profile parser
PASS / DEFER / FAIL decision SSOT
24h ENGINEERING_VALIDATION ceiling
authority_effect=false hard boundary
KBS rainfall / ET0 engineering value-path test
```

不要迁移旧 crop/soil state，不覆盖 current main evidence。

### P1 — Cadence decision contract

正式生产：

```text
if raw_hourly_age <= 6h:
    PRODUCTION_FRESHNESS_PASS
else:
    production_authority = FAIL
    cadence intelligence may return EXPECTED_DELAY / UNKNOWN / ABNORMAL
    scheduler action = DEFER or FAIL
```

Engineering：

```text
if raw_hourly_age <= 24h:
    ENGINEERING_VALIDATION_ALLOWED
    authority_effect = false
else:
    ENGINEERING_VALIDATION_BLOCKED_STALE
```

### P2 — 对齐 ~05Z provider window

今天不要全天候盲跑 live。

在 observed release heuristic 前后运行 metadata watch；一旦 transition 出现：

```text
freeze transition metadata
update transition_count
run engineering value path immediately
check production <=6h independently
```

### P3 — 等 EA9B 05:10/06:10/07:10 observer

如果新 planting candidate 出现，马上转 authority adjudication；否则明确宣布 full EA5E2 当天不可运行，停止消耗时间。

---

## 12. 本对话踩过的坑，下一对话不要重复

### 12.1 不要混淆 Raw Hourly 与 soil endpoint 25

```text
Raw Hourly:
hourly event series + burst publication behavior + <=6h production freshness

Soil endpoint 25:
5-minute source timestamps + exact-row first-seen phase behavior
```

不能拿 Raw Hourly 的 04:00Z 停滞证明 soil 也停在 04:00Z。

### 12.2 不要拿 arbitrary retrieval age 当 publication lag

真正 first-seen evidence：

```text
first_seen_at(source_timestamp) - source_timestamp
```

而不是：

```text
random GET time - latest source timestamp
```

### 12.3 global soil p95 不是 candidate-T authority

全局 p95/max 可以很差，但 `T-15 / :45` phase 仍可满足 frozen T-5 deadline。

当前 main 已证明 :45 compatible。

### 12.4 不要为了跑通测试放宽 production authority

```text
<=6h production freshness
[T-15,T] soil selector
T-5 ingress margin
T+390/T+432/T+437
actual UTC
same-source/same-cycle
```

都不因测试慢而改变。

24h 只能存在于明确的 `ENGINEERING_VALIDATION`，不能产生 effectiveness claim。

### 12.5 不要把 DEFER 当 PASS

Cadence intelligence 的价值是避免无意义 live，不是绕过 authority。

### 12.6 EA3 causality invariant 永久保留

历史 run `31566710679`：

```text
EA3_RETAINED_BEFORE_RETRIEVAL
```

必须保持：

```text
retrieved_at <= retained_at
```

旧 transient object 不能因 content-address equality 就复用旧 retained_at。

### 12.7 历史 soil selector harness bug 不得复发

历史 run `31573422554`：

```text
first poll T-10
strict > T-15
```

错误。

冻结 selector 是：

```text
[T-15,T] inclusive
```

### 12.8 run 31584908899 不要再误分类

它的 soil failure 已经通过 #3070/#3071 转化成可建模 provider phase knowledge。

现在 soil :45 已 PROVEN_COMPATIBLE，所以不要继续把该历史 failure 当成“soil 仍未解决”。

### 12.9 cadence 目前仍不能正式叫 DAILY_BATCH

当前 chained transition count = 1。

即使工程 scheduler 围绕 ~05Z 做窗口选择，也必须标记 heuristic，不是 authority classification。

### 12.10 stale branch 不要直接合并

`agent/mcft-cap09-provider-cadence-intelligence` 已 diverged。

只在 fresh current-main branch 上选择性迁移 engineering concepts。

### 12.11 PR body 不能代替 exact diff

每次 merge 前必须重新核：

```text
exact head
exact base/main
changed files
focused gates
Delivery Policy
Main Ruleset
standard CI / acceptance / release lane
```

---

## 13. 当前一句话结论

```text
EA5E2 runner / admission implementation 已经基本闭合；soil exact-hour provider phase 已证明可用。
今天要稳定推进 KBS，先用 fresh-current-main 的 cadence intelligence + <=24h NON-AUTHORITATIVE ENGINEERING_VALIDATION 快速跑通数据路径，并把正式 production live 严格对齐 Raw Hourly 实际发布窗口；full EA5E2 是否能今天运行则取决于 EA9B 是否出现并完成新的 lawful crop-context requalification，不能靠 freshness override 解决。
```

---

## 14. 下一对话建议直接执行

```text
1. Re-read current main and latest Raw Hourly artifact.
2. Re-read latest EA9B observer result (05:10/06:10/07:10Z).
3. Create a fresh cadence/engineering branch from current main.
4. Port only cadence intelligence + 24h non-authoritative engineering value-path logic from stale branch.
5. Run current-head static/governance/CI.
6. Around observed ~05Z Raw Hourly release, freeze transition and immediately run KBS engineering value-path.
7. If EA9B yields a lawful candidate, adjudicate/requalify crop authority.
8. Only after crop authority + Raw Hourly <=6h + soil :45 compatible + legal T + lead + exact-head gates intersect, dispatch one EA5E2 live.
9. Otherwise do not burn the 7h live window.
```
