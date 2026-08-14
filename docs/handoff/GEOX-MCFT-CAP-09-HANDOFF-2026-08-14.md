# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-14

更新时间：2026-08-14 15:33（UTC+8）

> 本 handoff 只用于恢复工程上下文，不制造新的 authority、effectiveness、activation、crop-stage、season、Formal write 或 operational GO 权限。若本文与 current Taskbook、effective Amendments、protected `main`、exact workflow run、immutable artifact 或后续 merged evidence 冲突，以更高权威事实为准。

## 0. 当前快照

```text
repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
353f642019c5f581d0b578847ee586dffba1f22c

protected_main_latest_merge:
PR #3126 — MCFT-CAP-09: bind qualification crop context before final CAP04 live

current_engineering_frontier:
AMENDMENT-11 CAP04 REAL FIVE-FAMILY CONSUMPTION
— canonical chronology / caller snapshot alignment

current_first_substantive_live_failure:
EXTERNAL_CAP04_LATE_RECORD_AFTER_SNAPSHOT:observed_rainfall_v1

kbs:
CLOSED FOR CURRENT FRONTIER — DO NOT REOPEN

rolling capture / intersection:
CLOSED FOR CURRENT FRONTIER — DO NOT REOPEN

cross-head rehydration:
CLOSED FOR CURRENT FRONTIER — DO NOT REOPEN

five-family isolated DB package:
PROVEN PASS

qualification-only crop-context binding:
PROVEN IN PRE-MERGE HARNESS / CROP COVERAGE FAILURE CLOSED

cap04_runtime_successor_qualified:
false

ea5e2_operational_activation_qualified:
false

formal O00-O23:
0/24

full_operational_go:
false
```

---

## 1. 现在在做什么任务

当前唯一工程任务不是继续测试 provider，也不是继续扩展 KBS cadence / rolling capture / rehydration。

当前任务是：

```text
用已经证明过的真实 five-family package，
在 isolated qualification harness 中忠实复制 exact-main live 的 canonical chronology，
复现并关闭：
EXTERNAL_CAP04_LATE_RECORD_AFTER_SNAPSHOT:observed_rainfall_v1
```

必须在同一个工程分支内一直推进，直到下面整条链一次完整通过：

```text
five-family canonical facts
→ PostgresExternalFormalEvidenceSourceV1
→ Amendment-11 External CAP04 successor
→ A1
→ SELECTED
→ COMPLETED
→ exactly 72 forecast points
```

新的工作方式已经冻结：

```text
先在 isolated qualification harness 中把真实失败完整复现并修透
→ 同一分支跑完整 positive + fail-closed regression
→ 只 merge 一次
→ 只做一次 exact-main real-provider witness
```

禁止回到“一层一个 PR、每次到 protected main 才发现下一层问题”的低效率模式。

---

## 2. 已经完成了什么

### 2.1 KBS provider / Amendment-11 late path 已经闭合

当前 frontier 不再重新裁决以下事实：

```text
KBS provider publication cadence = DAILY_BATCH
observation resolution = HOURLY
raw retention before canonicalization = required
same-source exact record identity = required
no source substitution
no future leakage
```

KBS 的 provider fetch、raw retention、exact-T rainfall / historical ET0 构造已经在真实五家族链路中通过。

当前 CAP04 failure 不得重新分类成 KBS provider failure。

### 2.2 rolling capture / causal intersection 已经闭合

真实 pre-boundary evidence 已经通过 rolling capture / intersection 形成可复用的 immutable producer candidate。

当前 CAP04 调试不再重新抓 provider 来证明这层。

除非出现直接证据证明 immutable producer candidate 或其 provenance 被当前代码改坏，否则不允许重开这一 frontier。

### 2.3 cross-head rehydration 已经闭合

真实 retained pre-T soil/GFS 三家族已经完成 producer-SHA-bound cross-head rehydration，并进入 isolated DB。

已证明：

```text
semantic manifest match = true
producer-bound raw reverification = true
producer dataset identity preserved = true
producer decoder identity preserved = true
provider refetch count = 0
Formal writes = 0
```

当前不再把 rehydration 作为 blocker。

### 2.4 real five-family data path 已经闭合

protected-main five-family qualification 已经证明真实 package 可以形成 exactly five canonical evidence families：

```text
future_et0_assumption_v1
future_weather_assumption_v1
soil_moisture_observation_v1
observed_rainfall_v1
historical_et0_estimate_v1
```

并且满足：

```text
preboundary family count = 3
KBS family count = 2
isolated database fact count = 5
exact KBS target = true
KBS raw retained before decode = true
private transient cleanup confirmed = true
```

因此：

```text
KBS_EXTERNAL_FIVE_FAMILY_DATA_PATH_QUALIFIED = true
```

这个结论不因 CAP04 consumer 后续失败而自动失效。

### 2.5 #3125 暴露的 crop coverage 问题已经被正确关闭

PR #3125 首次把真实 five-family package 交给 Amendment-11 CAP04 successor 时，第一处 substantive failure 是：

```text
CROP_STAGE_CONTEXT_OUTSIDE_COVERAGE
```

该问题已确认是 qualification harness wiring defect，不是 production crop validator 错误：旧 qualification crop fixture 的 coverage 与真实 target `2026-08-13T15:00:00.000Z` 不一致。

### 2.6 #3126 已合并：qualification-only crop context 已绑定

PR #3126：

```text
title:
MCFT-CAP-09: bind qualification crop context before final CAP04 live

merge:
353f642019c5f581d0b578847ee586dffba1f22c
```

#3126 做了三件正确的事：

1. 为目标 T 构建 target-scoped qualification-only crop context；
2. 将其 ref/hash 真正绑定进 qualification Runtime Config；
3. 保留 `crop_authority_effect=NONE`，不修改 production CAP04 crop coverage fail-closed validator。

它还新增了完整 pre-merge isolated qualification harness，并要求：

```text
DB source
→ CAP04
→ A1
→ SELECTED
→ COMPLETED
→ 72 points
```

在 pre-merge deterministic fixture 上完整 PASS。

因此旧的：

```text
CROP_STAGE_CONTEXT_OUTSIDE_COVERAGE
```

不再是当前 blocker。

---

## 3. 当前卡在哪里

protected main `353f642019c5f581d0b578847ee586dffba1f22c` 的 exact-main workflow：

```text
workflow:
mcft-cap-09-cap04-amendment11-real-five-family-consumption

run:
31776769088
```

运行结果：

```text
static-contract                         PASS
qualification-harness                  PASS
exact protected main                   PASS
private transient R2 bindings          PASS
latest successful KBS intersection     PASS
immutable rolling producer candidate   PASS
three-family rehydration               PASS
exact-T KBS rainfall + historical ET0  PASS
five-family same isolated DB           PASS
CAP04 real five-family consumption     FAIL
```

当前第一处 substantive live-only failure：

```text
EXTERNAL_CAP04_LATE_RECORD_AFTER_SNAPSHOT:observed_rainfall_v1
```

这已经确认不是：

```text
KBS provider failure
rolling capture failure
rehydration failure
five-family DB missing record
crop coverage failure
```

当前问题的本质是：

```text
pre-merge deterministic qualification harness
没有忠实复制 exact-main real canonical rainfall / ET0 chronology
与 caller-supplied evidence snapshot 之间的真实时间关系。
```

因此 pre-merge harness 可以绿，但 exact-main canonical record 在 CAP04 snapshot admission 时被正确 fail-closed 判为 late record。

当前不能靠修改错误分类、跳过 late-record guard、伪造 availability time 或扩大 snapshot 来“让测试通过”。

---

## 4. Amendment-11 当前必须守住的 temporal authority

Amendment-11 已经纠正旧 Amendment-07 中以下值作为 authority 的地位：

```text
scheduler_eligibility_lag_hours = 7
late collector = T+06:30
exact evidence cutoff = T+07:12
runtime observer = T+07:17
```

这些不能继续作为不可变 authority 去倒推 canonical chronology。

但以下边界仍然必须严格保持：

```text
interval_start / interval_end 必须仍是 exact T semantics
event_time 不得改写
available_to_runtime_at 必须是真实 provider/runtime 可用时间
ingested_at 必须是真实 ingestion 时间
no future leakage
no interpolation
no persistence fill
no source substitution
raw retention before canonicalization
```

当前 snapshot bug 的修复必须服从这些边界。

尤其禁止：

```text
为了让 rainfall 落进 snapshot，
把 event_time、available_to_runtime_at 或 ingested_at 改成更早时间。
```

如果真实 canonical record 在 caller snapshot 之后可用，那么 consumer 必须要么选择正确 lawful snapshot，要么在更早 snapshot 上 fail closed；不能改写事实时间。

---

## 5. 下一步计划

### Step 1 — 在 isolated harness 复制真实 chronology

不要再用抽象的“delayed family = T+20h”就认为已经覆盖 live chronology。

从 exact-main real witness 中复制/构造与真实 canonical rainfall / ET0 完全一致的 temporal relation，至少包括：

```text
event / interval time
available_to_runtime_at
ingested_at
canonicalization time（若 contract 使用）
caller supplied evidence snapshot
```

目标是让 isolated harness 先稳定复现：

```text
EXTERNAL_CAP04_LATE_RECORD_AFTER_SNAPSHOT:observed_rainfall_v1
```

在没有复现前，不开始新的 exact-main 尝试。

### Step 2 — 确认 late-record guard 使用的精确时间语义

沿真实调用链核：

```text
PostgresExternalFormalEvidenceSourceV1
→ external CAP04 input authority validation
→ evidence snapshot admission
```

明确 late 判定究竟绑定：

```text
available_to_runtime_at
还是 ingested_at
还是其他 canonical availability field
```

不要从字段名或旧 Amendment-07 deadline 猜测。

### Step 3 — 修 consumer / witness chronology，而不是改写 provider truth

优先修：

```text
caller snapshot construction
canonical record selection ordering
qualification harness chronology fidelity
witness handoff timing
```

只有在明确证明 canonicalizer 写错真实 timestamp 时，才允许改 canonicalizer。

默认假设 provider/event chronology 本身是事实，不是为了通过 CAP04 可调的 fixture 参数。

### Step 4 — 同一分支一直修到完整 positive path PASS

必须一次完整达到：

```text
selected record count = 5
caller supplied evidence snapshot honored = true
A1
forcing status = SELECTED
forecast status = COMPLETED
forecast point count = 72
crop authority effect = NONE
provider request count inside CAP04 = 0
database write count inside CAP04 = 0
canonical persistence authorized = false
Formal effect = false
EA5E2 operational activation qualified = false
full operational GO = false
```

### Step 5 — 同一分支补 fail-closed regression

至少保留两个 chronology case：

```text
A. record available <= snapshot
   → admitted / full CAP04 PASS

B. record available > snapshot
   → EXTERNAL_CAP04_LATE_RECORD_AFTER_SNAPSHOT
```

不能只把 positive fixture 改到绿而丢掉真实 fail-closed 保护。

### Step 6 — 只 merge 一次、只做一次 exact-main witness

只有当完整 isolated harness 与 repository required checks 全绿后才 merge。

merge 后只做一次 exact-main real-provider witness。

如果 exact-main witness PASS，才允许建立：

```text
CAP04_RUNTIME_SUCCESSOR_QUALIFIED = true
```

scope 仍限定为：

```text
REAL_EXTERNAL_FIVE_FAMILY_CONSUMPTION_IN_ISOLATED_DB
WITH_QUALIFICATION_ONLY_CROP_CONTEXT
```

它不自动建立：

```text
operational crop authority
EA5E2 operational activation
Formal O00-O23
full operational GO
```

### Step 7 — CAP04 PASS 后再重新读取 readiness blocker set

CAP04 witness PASS 后，立即重新读取 exact-head full readiness blocker set。

如果硬 blocker = 0，则停止扩展外围审计，进入下一真实测试/activation 决策。

不要再创建与当前 GO/NO-GO 无关的新 proof 链。

---

## 6. 已踩过的坑，下一对话必须避免

### 坑 1：把已闭合的 KBS / rolling / rehydration 一再重开

当前 CAP04 consumer failure 不等于 upstream provider path regression。

没有新的直接证据时，不得重新花时间：

```text
重抓 KBS
重做 cadence 判断
重做 rolling capture
重做 intersection
重做 rehydration qualification
```

### 坑 2：一层一个 PR

过去的低效率模式：

```text
修一层
→ PR
→ merge
→ exact-main
→ 才看到下一层 bug
```

现在禁止继续这样做。

必须在 merge 前通过完整 isolated end-to-end CAP04 harness 暴露尽可能多的 consumer-chain 问题。

### 坑 3：synthetic chronology 与 real canonical chronology 不等价

#3126 pre-merge harness 已证明结构链路可通，但 exact-main live 仍暴露 late-record。

因此以后不能只验证“有 delayed record”，必须验证：

```text
真实 canonical timestamp fields
+
真实 caller snapshot relation
```

### 坑 4：把 qualification crop context 当 operational crop authority

qualification-only crop context 的唯一目的，是让 CAP04 runtime successor 可以在不伪造当前生物学 crop authority 的情况下被独立 qualification。

必须继续保持：

```text
crop_authority_effect = NONE
```

不能把它拿去给 EA5E2 operational activation 或 Formal O00-O23 背书。

### 坑 5：为了通过测试放松 late-record fail-closed

`EXTERNAL_CAP04_LATE_RECORD_AFTER_SNAPSHOT` 本身是正确的安全边界。

正确修复目标是：

```text
让 lawful snapshot 与真实 availability chronology 对齐
```

而不是：

```text
忽略 late record
把 late record 当 available
回写更早 timestamp
使用未来数据
```

### 坑 6：混淆 event time 与 runtime availability

Amendment-11 下：

```text
event / interval semantics = 事实发生时间
available_to_runtime_at = 系统真实可使用时间
ingested_at = 实际 ingestion 时间
```

三者不能互相替代。

### 坑 7：用旧 Amendment-07 的固定 T+ 时间倒推新流程

旧固定：

```text
T+06:30
T+07:12
T+07:17
scheduler lag 7h
```

已经不应被当成 Amendment-11 authority。

不要为了兼容旧 harness 再把它们偷偷写回新 consumer contract。

### 坑 8：docs/handoff 更新影响 active exact-main

当前工程正在做 exact-main-sensitive qualification。

handoff 文档应走独立 docs branch / docs-only PR；在当前 CAP04 engineering branch 完成并需要 exact-main 稳定期间，不应为了文档更新主动移动 protected main。

---

## 7. 下一对话接手时的最短恢复路径

新的接手者不要重新遍历整个 MCFT-9 历史。

先按以下顺序核：

```text
1. protected main 是否仍为 353f642... 或其明确 successor
2. 当前 CAP04 chronology fix branch / PR
3. isolated harness 是否已能复现 LATE_RECORD_AFTER_SNAPSHOT
4. positive path 是否已到 A1 / SELECTED / COMPLETED / 72
5. negative late-record regression 是否仍 fail closed
6. 是否已经 merge
7. merge 后 exact-main witness 是否 PASS
8. CAP04 PASS 后 readiness blockers 是否为 0
```

除非其中出现 upstream regression 的直接证据，否则不要回到 KBS、rolling capture、intersection 或 rehydration。

---

## 8. 当前一句话状态

> MCFT-CAP-09 当前已经越过 KBS、rolling intersection、cross-head rehydration、real five-family package 和 qualification crop coverage；唯一工程 frontier 是把 exact-main real canonical rainfall/ET0 chronology 与 caller-supplied CAP04 evidence snapshot 对齐，并在 isolated harness 中先完整复现和修复 `EXTERNAL_CAP04_LATE_RECORD_AFTER_SNAPSHOT:observed_rainfall_v1`，一直跑通 `External DB source → CAP04 → A1 → SELECTED → COMPLETED → 72 points` 后再只 merge 一次、只做一次 exact-main witness。
