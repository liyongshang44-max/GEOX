# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-24

更新时间：2026-08-24 10:33（UTC+8）

> **CONVERSATION HANDOFF ONLY — NOT REPOSITORY AUTHORITY.** 本文只用于恢复工程上下文，不制造新的 authority / effectiveness / activation / crop-stage / qualification / epoch / Formal write 权限。若本文与 `docs/SSOT.md`、数字孪生总任务书、MCFT-CAP-09 Taskbook、effective Amendments、protected `main`、exact workflow run、Neon live state、immutable artifact 或 repository machine gate 冲突，以后者为准。

---

## 0. 当前快照 / 下一对话第一步

```text
repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
18b690e8c2d92bfdc4eeea9eece0723c4181a996

protected_main_merge:
PR #3280 — fix(mcft-cap09): recover Formal v3 prebootstrap failure without requalification

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

current_phase:
MCFT-9 T4R1 FORMAL v3 O01 IRREVERSIBLE NO-GO / HOURLY ORCHESTRATION REPAIR FRONTIER

current_open_runtime_pr:
Draft PR #3281 — fix(mcft-cap09): close Formal hourly orchestration recursion gap
base = 18b690e8c2d92bfdc4eeea9eece0723c4181a996
head at handoff = 97f3f09ba7430a9d9dc8624bf11772ed1c161453
2 commits / 2 workflow files changed at this snapshot

qualification_generation:
v11 / blocked_v11 — IMMUTABLE PASS
qualification_subject = abf0aa121001480f01ad4e39364b1df13f3c26eb
persistent run = 32638502092
artifact = 9493316708
digest = sha256:3a6f01a9c1da1de4522ba9d745e3619b7c116ece45bde39ebec10d8637cb4544
13/13 = PASS
static_blocker_count = 0

current deployment subject:
18b690e8c2d92bfdc4eeea9eece0723c4181a996
qualification relation:
CARRY_FORWARD from immutable v11 qualification; no v12 was created

actual Formal logical generation:
geox_mcft_cap09_s6_formal_t4r1_24h_v3

actual Formal epoch status:
IRREVERSIBLE NO-GO at O01
DO NOT RERUN / DO NOT REUSE / DO NOT CONTINUE O02-O23

A0 bootstrap:
SUCCESS — run 32653201474
artifact 9497548692
digest sha256:1d5c70f1d7a8258568766516794703a3974237b3450f0fa7bbd8e150433bda96
A0 = 2026-08-23T17:00:00Z

O00:
2026-08-23T18:00:00Z
terminal PASS / DEGRADED
forcing = PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
formal_epoch_no_go = false
live runner run = 32656683897
artifact = 9497616126
digest = sha256:7ea5d331f08e5fe1c391f9f7bbd251fdf9819334b090aa83d758664c44677f25

O01:
2026-08-23T19:00:00Z
FAILED / BLOCKED_NO_CAUSAL_FORCING
terminal tick NOT created
irreversible NO-GO recorded
live runner run = 32660018684
artifact = 9498479992
digest = sha256:dd531b49138ee5b9046e9cc4d8dbd458572c62995de0cc08a2cad7f64e6ee0d2

failed epoch database shape at first adjudication:
scheduler slots = 2 (O00 + O01)
terminal ticks = 1 (O00 only)
O01 tick_ref = null
O01 health_ref = ...:O01:BLOCKED_NO_CAUSAL_FORCING
O01 terminal_at = 2026-08-23T19:04:00Z

mcft_cap09_complete:
false
```

### 下一对话第一步必须做什么

不要再等 O02，也不要 rerun `32660018684`。第一步只做 live read：

```text
1. 确认 protected main 是否仍 == 18b690e8c2d92bfdc4eeea9eece0723c4181a996
2. 读取 Draft #3281 当前 head / diff / CI / comments
3. 确认 failed Formal v3 仍 immutable，不能被 reset / truncate / rebound
4. 确认 #3281 是否已经补齐“fresh actual Formal generation + qualification boundary”决策
5. 在 merge 前做完整 downstream static/rehearsal audit，特别是 GitHub-token-trigger recursion
6. 只有新的 fresh Formal store + 合法 qualification/carry-forward 关系明确后，才允许下一 epoch
```

如果 `main` 已漂移，先查明是哪一个 PR/commit 推进；不要把本 handoff 的 `18b690e8...` deployment evidence 当成新 SHA 的 exact deployment evidence。

---

## 1. 我们现在到底在做什么

总任务仍是：

```text
MCFT-CAP-09 — Shadow-Online Promotion
目标：STAGE_1B_SHADOW_ONLINE_CLOSURE
最终不可替代验收：REAL O00 → O23，24 个真实 UTC 小时
```

这轮不是重新设计数字孪生，也不是重新做 accelerated qualification。

我们已经完成：

```text
T4R1 successor
→ production-equivalent accelerated qualification
→ immutable v11 13/13 PASS
→ semantic/control-plane identity separation
→ fresh actual Formal v3
→ Graduation OPEN
→ A0 SUCCESS
→ real O00 SUCCESS
```

但第一轮真实 Formal v3 在 O01 因 control-plane orchestration gap fail-closed，因此：

```text
Formal v3 epoch = NO-GO
MCFT-9 = NOT COMPLETE
```

当前工作只剩两类：

1. 修掉 **已被真实 O01 证明的 hourly orchestration defect**；
2. 建立一个新的、fresh、不可与失败 v3 混用的 actual Formal epoch，然后重新跑完整 O00→O23。

不要把工作重新扩散成 architecture redesign。

---

## 2. 本轮最重要的工作方法变化：停止 exact-SHA 自失效循环

### 2.1 之前为什么不断 v6→v7→v8→v9

此前 qualification identity 过度绑定整个 `main` commit SHA：

```text
repository commit SHA
qualification subject
producer identity
consumer identity
deployment identity
evidence identity
database generation
```

长期被压在同一个 SHA 上。

结果是：

```text
13/13 PASS
↓
发现纯 control-plane seam
↓
修一行 workflow/classifier
↓
main SHA 改变
↓
旧 qualification 被视为 stale
↓
immutable DB 不能重绑
↓
再滚一个 generation
```

这就是 v6→v7→v8→v9 的主要放大器。

### 2.2 #3274：qualification/control-plane identity loop 被正式拆开

PR #3274：

```text
fix(mcft-cap09): close qualification/control-plane identity loop
```

建立了 fail-closed compatibility contract：

```text
repository_commit_sha
!= automatically
qualification_subject_sha
```

只有当 governed semantic boundary byte-identical 时，才允许：

```text
CARRY_FORWARD
```

任何 runtime/domain/persistence/external-evidence/migration/runtime-acceptance/frozen-authority 改变仍然必须：

```text
FRESH_QUAL_REQUIRED
```

关键意义：纯 artifact name、Graduation plumbing、非 semantic workflow/control-plane 修改不再天然烧掉 13/13。

### 2.3 PR CI 不再只做 static string proof

#3274 还把真实 frozen qualification artifact 带进 PR CI：

```text
real immutable qualification artifact
→ actual classifier
→ cutover
→ Graduation input
→ machine gate
→ immutable envelope
```

这样 protected main 不再是第一个 integration environment。

这是后续必须保持的工程纪律。

---

## 3. #3273→#3277：为什么“永远差一步”，以及怎样结束

### #3273 — T4R1 artifact prefix seam

Graduation machine gate 已 OPEN，但 immutable envelope assembler 仍要求历史 prefix：

```text
mcft-cap09-am19-persistent24-
```

而真实 T4 artifact 是：

```text
mcft-cap09-t4r1-am19-persistent24-
```

这是典型 distributed string contract drift。

### #3275 — repeated digest causal retention 是真正 semantic bug

post-gate rolling 暴露：同一 run 内相同 digest 重复 acquisition 时，旧 immutable `retained_at` 可能早于新的 `retrieved_at`：

```text
EA3_RETAINED_BEFORE_RETRIEVAL
```

正确修复不是放宽 EA3，而是：

```text
若 reused retained_at < current retrieved_at
→ 删除当前 run 的 stale transient object
→ 对相同 bytes 重新 retain
→ 保持 retrieved_at <= retained_at
```

因为它修改 governed runtime-acceptance semantics，所以必须 fresh qualification。

### #3276 — fresh v10

建立：

```text
v10 / blocked_v10
```

v9 永久 predecessor evidence。

### v10 qualification

```text
subject = fa5d85b0d21f3c9d7697b7f608f22c27158b0c67
run = 32619215884
artifact = 9488084535
digest = sha256:ffe85a5d5d1f829569d9c34bf1dd9965b32bb8cd2313aa28138ed3d3fcd846e8
13/13 PASS
```

### #3277 — v10 Graduation bind

纯 control-plane：

```text
current generation = v10
v9 = stale predecessor
compatibility source = immutable v10
```

预期并实际使用 `CARRY_FORWARD`，没有制造 v11。

---

## 4. CTO closure mode：为什么最终还是主动建立 v11

后续反向审计发现，在真正 24h 前仍有已知 semantic/orchestration seams：

```text
A. A0 crop authority V2 → T4R1 V3
B. qualification generation fresh boundary
C. actual Formal v2 已失败，必须 fresh actual Formal generation
D. active Formal chain 必须统一绑定 fresh generation
E. T4 hourly rolling 不能只靠人工 workflow_dispatch
F. final readback forcing enum 不能继续用旧 EXACT_PROVIDER_PAIR
```

因此决定：

> 所有已知会改变 governed semantic digest 的问题，在下一次 qualification 之前一次性关闭。

这形成 PR #3278：

```text
fix(mcft-cap09): final semantic closure bundle before v11 qualification
```

### #3278 的硬边界

一次性完成：

```text
crop authority V3
fresh v11 / blocked_v11
fresh actual Formal v3
active Formal chain → v3
hourly T4 rolling automation
final readback enum → EXACT_PROVIDER_INTERVAL_PAIR / PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
reverse terminal static closure gate
deterministic 24h orchestration rehearsal
```

同时冻结规则：

```text
v10 = immutable predecessor
Formal v2 = immutable failed epoch
no v12 unless a genuinely new governed semantic defect is proven
```

---

## 5. Phase 0.5：反向终点静态验收

为了避免再在第 7 小时、第 23 小时才发现机械 wiring bug，PR 阶段增加反向 closure acceptance。

必须证明：

```text
A0 authority == T4R1 V3
current qualification DB == v11
stale v10 only predecessor
current actual Formal DB == Formal v3
active path contains no Formal v2
T4 rolling hourly automation exists
hourly evidence consumes T4 rolling
Formal live runner has autonomous schedule
forcing enum == EXACT_PROVIDER_INTERVAL_PAIR or PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
final readback expects 24 bases / 23 hourly promotions / 24 terminal ticks
```

active path 如果残留：

```text
V2 crop authority
formal_t4r1_24h_v2
current v10
EXACT_PROVIDER_PAIR
manual-only T4 rolling
```

PR 不应 merge。

注意：这套 static gate 后来仍没捕获 GitHub `GITHUB_TOKEN` recursion suppression；这是当前最重要的新测试缺口，见 §15。

---

## 6. Phase 0.6：虚拟 24h orchestration rehearsal

CI 增加 deterministic control-plane rehearsal：

```text
rolling base A0 → O00 forcing ready
rolling base O00 → O01 forcing ready
...
rolling base O22 → O23 forcing ready

A0 → O00 → ... → O23 → final readback
```

边界：

```text
zero real provider access
zero Formal DB writes
zero Formal completion claim
```

它只证明 target/slot/enum/mapping/orchestration logic 的机械自洽。

它不能替代最终 real wall-clock O00→O23。

当前 O01 失败证明：rehearsal 还必须覆盖 **GitHub event provenance / token recursion semantics**，不能只模拟逻辑图。

---

## 7. v11 qualification：当前仍然有效，不要误判成需要 v12

#3278 合并后，fresh v11 qualification 成功：

```text
qualification subject:
abf0aa121001480f01ad4e39364b1df13f3c26eb

persistent run:
32638502092

artifact:
9493316708

artifact name:
mcft-cap09-t4r1-am19-persistent24-abf0aa121001480f01ad4e39364b1df13f3c26eb-32638502092

digest:
sha256:3a6f01a9c1da1de4522ba9d745e3619b7c116ece45bde39ebec10d8637cb4544

databases:
geox_mcft_cap09_s6_accel24t_am19_v11
geox_mcft_cap09_s6_accel24t_am19_blocked_v11

13/13:
PASS

static blocker count:
0
```

这是 immutable qualification evidence。

不要：

```text
truncate v11
rebind v11
replace subject SHA
rewrite sentinel
reuse v11 for another qualification subject
```

---

## 8. #3279：最后 planned control-plane Graduation bind

PR #3279：

```text
fix(mcft-cap09): bind Graduation closure to immutable v11 evidence
```

只做：

```text
classifier current v10 → v11
v10 → stale predecessor
compatibility frozen source → real v11 run/artifact/digest
actual Formal → v3
PR/replay lane authenticate real v11 artifact
```

硬边界没有碰：

```text
scripts/runtime_acceptance/**
runtime/domain/persistence
provider semantics
crop authority
migrations
State / Forecast / Scenario
```

所以它必须：

```text
CARRY_FORWARD
```

不能制造 v12。

---

## 9. Graduation v11 → fresh rolling → Formal arm

在后续 control-plane merge 后，compatible Graduation replay 成功：

```text
Graduation run:
32650291300

deployment subject:
18b690e8c2d92bfdc4eeea9eece0723c4181a996

qualification subject:
abf0aa121001480f01ad4e39364b1df13f3c26eb

qualification_reexecution_required:
false

formal_epoch_creation_gate:
OPEN

gate opened:
2026-08-23T16:00:14.397Z

Graduation artifact:
9495982377

digest:
sha256:df4134d2c7e8a63adc19dea537a3761fd4e04bba15fe2627347152dbd5553794
```

随后 fresh rolling：

```text
run 32650465877 — SUCCESS
target A0 = 2026-08-23T17:00:00Z
artifact 9496737694
digest sha256:c541eaf13a666dc1474979b9acbbf00175a19d520a69aaca213cfd719656f483
```

链路随后自动进入 Formal arm / A0。

---

## 10. Formal v3 第一次 A0：不是 semantic failure，是 workflow parse failure

第一次 actual Formal v3 A0 run：

```text
32646669506
```

它已经完成：

```text
producer-bound rehydration
3 exact T4R1 A0 evidence promotions
```

但在 canonical bootstrap mutation 之前失败。

根因：

```text
shell: node {0}
+
top-level await
```

具体是：

```text
await new Promise(...)
```

Node 20 按 CommonJS 临时脚本解析，直接 parse error。

因此失败边界非常干净：

```text
facts = 3
all runtime/checkpoint/lease/scheduler/state tables = 0
canonical bootstrap mutation started = false
```

immutable failure proof：

```text
artifact 9495063273
digest sha256:af6dd063753c9b558cd014358753b9653853b26fe3b4776e864fd59052002f9d
```

不要把这个 run 说成 crop/provider/runtime failure。

---

## 11. #3280：archive-first recovery，不销毁失败证据

PR #3280：

```text
fix(mcft-cap09): recover Formal v3 prebootstrap failure without requalification
```

完成：

```text
A0 wait → CommonJS-safe async IIFE
failed v3 attempt → explicit authority record
one-time archive-first recovery workflow
```

### recovery 原则

绝不：

```text
DROP failed evidence
TRUNCATE
DELETE FROM facts
UPDATE facts
```

而是：

```text
active v3 failed boundary
→ rename
geox_mcft_cap09_s6_formal_t4r1_24h_v3_failed_32646669506

then
create fresh active logical v3
→ TEMPLATE template0
→ schema-only restore
→ prove 26/26 zero-state
→ fingerprint equality
```

v11 / blocked_v11 完全不碰。

### Neon 512 MB 容量坑

第一次 recovery 在 archive 已成功后，创建 fresh active v3 时撞 Neon project 512 MB 容量上限。

处理方式：只清理两套已无 repository reference、且历史 run artifact 已保留的 audit scratch DB：

```text
...am19_v3_audit_32305894454
...am19_blocked_v3_audit_32305894454
```

没有动：

```text
v11
blocked_v11
v10
Formal v2
failed-v3 archive
```

随后 rerun recovery 成功。

recovery artifact：

```text
9495878945
digest sha256:d91998529a60fb63bda5c05ea87a6008a3e6df6172cf6cb4a6e53d1d81aca449
```

fresh active v3：

```text
26 public tables
facts = 0
all governed relations = zero-state
```

---

## 12. 第二次 A0：真实成功

修复后的 A0 bootstrap：

```text
run 32653201474 — SUCCESS
artifact 9497548692
digest sha256:1d5c70f1d7a8258568766516794703a3974237b3450f0fa7bbd8e150433bda96
A0 = 2026-08-23T17:00:00Z
```

A0 后只读数据库确认：

```text
facts = 37
authority_snapshot = 1
checkpoint = 1
lease = 1
runtime_health = 1
state_history = 1
state_latest = 1
scheduler_slots = 0
terminal_ticks = 0
```

checkpoint/state logical time：

```text
2026-08-23T17:00:00Z
```

这证明 #3280 的 CommonJS wait fix 已经通过真实 production Formal A0。

---

## 13. O00：第一颗真实 terminal tick 成功

```text
O00 = 2026-08-23T18:00:00Z
live runner run = 32656683897
artifact = 9497616126
digest = sha256:7ea5d331f08e5fe1c391f9f7bbd251fdf9819334b090aa83d758664c44677f25
```

数据库：

```text
scheduler_slots = 1
terminal_ticks = 1
state/checkpoint logical time = 18:00Z
```

O00 terminal state：

```text
DEGRADED
```

但不是失败。

forcing：

```text
PRIOR_STEP_CAUSAL_ASSUMPTION_PAIR
```

forecast 因：

```text
NO_COMPLETE_MATCHING_FORCING_CYCLE
```

被 BLOCKED，但 State propagation / checkpoint / terminal tick 正常提交。

runner 外层：

```text
status = PASS
formal_epoch_no_go = false
```

这证明 real wall-clock production path 确实启动过，不是 accelerated/replay 自证。

---

## 14. O01：不可逆 NO-GO

```text
O01 = 2026-08-23T19:00:00Z
live runner run = 32660018684
run event = schedule
head = 18b690e8c2d92bfdc4eeea9eece0723c4181a996
conclusion = failure
```

数据库：

```text
scheduler slots = 2
terminal ticks = 1
O01 status = FAILED
O01 health_ref = ...:O01:BLOCKED_NO_CAUSAL_FORCING
O01 tick_ref = null
O01 terminal_at = 2026-08-23T19:04:00Z
```

NO-GO artifact：

```text
9498479992
mcft-cap09-am19-formal-cycle-NO-GO-18b690...-32660018684
sha256:dd531b49138ee5b9046e9cc4d8dbd458572c62995de0cc08a2cad7f64e6ee0d2
```

### 结论

这轮 actual Formal v3：

```text
IRREVERSIBLE NO-GO
```

从这一刻起：

```text
DO NOT rerun O01
DO NOT patch tick in place
DO NOT continue O02-O23 as if epoch were valid
DO NOT reset scheduler slot
DO NOT delete NO-GO evidence
DO NOT truncate/reuse Formal v3
```

---

## 15. O01 真正根因：不是 provider，而是 GitHub Actions recursion semantics

这是当前最重要的新发现。

hourly scheduler 实际已经成功 dispatch 了 rolling：

```text
rolling run = 32652593667
subject = 18b690e8c2d92bfdc4eeea9eece0723c4181a996
target = 2026-08-23T18:00:00Z
conclusion = SUCCESS
```

这个 target 正好是 O01 `19:00Z` 所需要的 causal base。

问题不是 rolling 没跑。

问题是：scheduler dispatch rolling 时使用 repository `GITHUB_TOKEN`。

GitHub Actions 的 recursion protection 导致：

```text
scheduled workflow
→ GITHUB_TOKEN dispatch rolling
→ rolling SUCCESS
→ expected downstream workflow_run consumer
```

最后一跳没有被创建。

也就是：

```text
rolling producer SUCCESS
↓
NO formal-hourly-evidence workflow_run
↓
NO O01 causal forcing promotion into Formal v3
↓
live runner reaches O01
↓
BLOCKED_NO_CAUSAL_FORCING
↓
correct fail-closed NO-GO
```

手工/user-dispatched rolling 之前能触发 downstream hourly workflow，进一步证明差异来自 event/token provenance，而不是 provider data。

### 这不是 KBS cadence blocker

不要重新把问题归因到：

```text
KBS daily batch
KBS freshness
crop authority
GFS availability
ET0 availability
```

当前 O01 failure 的直接根因是 control-plane trigger recursion gap。

---

## 16. Draft #3281：当前修复方向

当前 Draft：

```text
#3281 — fix(mcft-cap09): close Formal hourly orchestration recursion gap
base = 18b690e8c2d92bfdc4eeea9eece0723c4181a996
head at handoff = 97f3f09ba7430a9d9dc8624bf11772ed1c161453
```

当前 diff 只改两个 workflow：

```text
.github/workflows/mcft-cap-09-amendment19-formal-hourly-evidence.yml
.github/workflows/mcft-cap-09-t4r1-rolling-preboundary-capture.yml
```

### 修复设计

把 hourly evidence 从隐式：

```text
workflow_run:
  workflows:
    - mcft-cap-09-t4r1-rolling-preboundary-capture
```

改成显式：

```text
workflow_dispatch:
  rolling_run_id
```

rolling SUCCESS 后显式：

```text
gh workflow run mcft-cap-09-amendment19-formal-hourly-evidence.yml
  --ref main
  -f rolling_run_id=$GITHUB_RUN_ID
```

这是 GitHub recursion protection 明确允许的 explicit dispatch 例外路径。

### consumer 必须先 authenticate rolling run

在任何 Formal mutation 前必须验证：

```text
rolling_run_id > 0
workflow name exact
workflow path exact
status = completed
conclusion = success
event = workflow_dispatch
head_branch = main
head_sha = current exact deployment subject
```

并短暂 poll upstream run terminal state，关闭 rolling 最后一步 dispatch 与 GitHub 把 upstream 标记 completed 之间的 race。

### 原安全边界全部保留

不能因为改 trigger 而放松：

```text
artifact identity
artifact digest
arm identity
A0 identity
deadline
rehydration equality
NO-GO propagation
actual Formal DB identity
protected-main equality
```

---

## 17. #3281 现在还不能直接 merge 的原因

当前 #3281 只关闭了 trigger recursion seam，但 failed Formal v3 已经不可复用。

因此 merge 前还必须明确：

```text
1. failed v3 的 immutable archive/freeze 方式
2. 新 actual Formal generation 名称（预计 fresh v4，但以 repository authority 为准）
3. fresh store provisioning / zero-state proof
4. 当前 v11 qualification 是否可对 #3281 carry-forward
5. 若 #3281 只改 .github/workflows/** 且 governed semantic digest unchanged，则 no v12
6. 新 Formal generation 必须绑定 arm/A0/hourly/live/final-readback/completion 全 active chain
```

不要出现：

```text
修 trigger
→ merge
→ 才发现没有 fresh Formal store
```

这正是之前 orchestration dead-end 的重复。

---

## 18. qualification 决策：当前默认不应创建 v12

#3281 当前只修改 `.github/workflows/**`，没有修改：

```text
scripts/runtime_acceptance/**
apps/server/src/domain/twin_runtime/**
apps/server/src/runtime/twin_runtime/**
apps/server/src/persistence/twin_runtime/**
apps/server/src/external_evidence/**
migrations
crop authority V3
State / Forecast / Scenario semantics
```

因此从 #3274 compatibility contract 的设计目标看，当前修复应优先证明：

```text
CARRY_FORWARD v11
```

而不是机械创建 v12。

但最终以 machine-governed semantic digest 为准：

```text
semantic digest equal → CARRY_FORWARD
semantic digest changed → FRESH_QUAL_REQUIRED
```

不要靠人工“感觉是 control-plane”绕过 machine gate。

---

## 19. 新 actual Formal epoch 必须 fresh

即使 v11 qualification 可以 carry-forward，**actual Formal epoch 不能 carry-forward**。

因为 v3 已经有：

```text
A0
O00 terminal
O01 failed slot
irreversible NO-GO
```

所以新的 execution epoch 必须：

```text
fresh physical Formal store
fresh future A0
fresh O00
```

不能：

```text
清空 v3
删除 O01
把 O01 改回 pending
补写 missing forcing
从 O02 接着跑
```

qualification carry-forward 与 Formal epoch reuse 是两件完全不同的事。

---

## 20. 下一步正确执行顺序

当前最短闭环不是“继续等 24h”，而是：

```text
Phase A — finish #3281 closure
  1. trigger recursion fix
  2. fresh actual Formal generation authority
  3. active-chain generation binding
  4. compatibility classification
  5. static reverse closure gate
  6. orchestration rehearsal including token/event provenance

Phase B — PR CI
  7. all static/CI PASS
  8. prove no governed semantic drift if claiming CARRY_FORWARD

Phase C — merge once
  9. merge #3281 once
  10. freeze new protected main
  11. no unrelated merge

Phase D — fresh Formal store
  12. archive/freeze failed v3
  13. provision fresh actual Formal store zero-state
  14. prove schema fingerprints + 26/26 zero-state

Phase E — re-open execution authority
  15. compatible Graduation replay if CARRY_FORWARD
  16. fresh rolling
  17. Formal arm
  18. fresh future A0

Phase F — real wall-clock
  19. O00
  20. O01 — must now have promoted causal forcing
  21. O02 ... O23
  22. final readback
  23. completion candidate
  24. final adjudication
```

最关键的新 early checkpoint：

> 下一 epoch 不要等到 O23 才判断 orchestration。O01 前必须直接看到 `rolling SUCCESS → explicit hourly evidence workflow created → promotion PASS → O01 forcing present`。

---

## 21. 下一轮 Formal 的强制观察点

### A0 后

必须看到：

```text
facts > 0
checkpoint = A0
state = A0
authority snapshot exists
scheduler slots = 0
terminal ticks = 0
```

### O00 前

必须看到：

```text
rolling candidate for A0/O00 causal base
hourly promotion semantics correct
no premature scheduler tick
```

### O00 后

必须看到：

```text
scheduler_slots = 1
terminal_ticks = 1
formal_epoch_no_go = false
```

### O01 前，这是本轮新增硬 gate

必须直接证明：

```text
scheduled rolling workflow exists
rolling run SUCCESS
explicit formal-hourly-evidence workflow exists
hourly promotion PASS
promoted forcing lineage targets O01
```

只看到 rolling SUCCESS **不够**。

### O01 后

必须看到：

```text
scheduler_slots = 2
terminal_ticks = 2
O01 != BLOCKED_NO_CAUSAL_FORCING
no irreversible NO-GO
```

只有过了这一关，才有意义继续 O02→O23。

---

## 22. 最终 completion 仍然没有任何放宽

最终仍必须：

```text
24 base snapshots
23 hourly promotions
24 terminal Runtime ticks

no irreversible NO-GO
no missing slot
no future leakage
no retroactive rewrite
no source relabel
exact Formal DB generation
exact deployment subject
exact qualification lineage
exact evidence lineage
zero unauthorized downstream side effects
```

final readback / completion candidate 只能在完整 real wall-clock chain 后生成。

accelerated 13/13、virtual rehearsal、A0 PASS、O00 PASS 都不能单独宣布 MCFT-9 COMPLETE。

---

## 23. 这一路踩过的坑：按类别归档

### 23.1 exact-SHA 自失效

错误模式：

```text
control-plane one-line fix
→ main SHA changes
→ full runtime qualification invalidated
→ new DB generation
```

避免：使用 #3274 governed semantic digest / compatibility attestation。只有 semantic boundary 变化才 fresh qualification。

### 23.2 producer SHA == consumer SHA 假设

错误：把 authenticated predecessor rolling producer 与 current consumer 强制 same-head。

避免：producer identity / consumer identity 分离，但 producer 必须 artifact-authenticated。

### 23.3 immutable qualification DB 当普通测试库

错误：失败或 stale 后 truncate/reuse。

避免：每 generation 一次性 evidence container；non-zero 后 immutable。

### 23.4 generation 名称散落硬编码

历史出现：

```text
v4 / v6 / v7 / v8 / v9 / v10 / v11
```

classifier / workflow / provision / Graduation 分散绑定。

避免：current/stale generation 必须由 machine gate 反向审计，不能只改 producer。

### 23.5 artifact prefix distributed string drift

T4 producer 已升级，envelope 仍旧 prefix。

避免：PR CI 使用真实 artifact 穿完整 consumer chain。

### 23.6 GitHub runner PostgreSQL client major 太旧

```text
pg_dump 16
Neon PostgreSQL 18.6
```

避免：production-equivalent provisioning preflight 必须在 PR 阶段验证 client/server major compatibility。

### 23.7 retained_at 生命周期归属错误

同 digest reuse 不能随意改 immutable `retained_at`；current acquisition 又必须满足 causal ordering。

避免：run-scoped namespace + created-only cleanup + causal re-retention。

### 23.8 target-only R2 namespace collision

避免：

```text
target + GITHUB_RUN_ID + GITHUB_RUN_ATTEMPT
```

### 23.9 top-level await under `shell: node {0}`

GitHub workflow 临时脚本不是 ESM。

避免：CommonJS-safe async IIFE；PR static gate 必须实际 parse/execute，不要只 grep。

### 23.10 Neon project capacity

archive-first recovery 可能成功 rename 后才在 CREATE DATABASE 撞容量。

避免：任何 fresh generation/provision 前先做 capacity inventory；只删除明确无引用 scratch DB，不碰 immutable evidence。

### 23.11 “rolling SUCCESS = downstream evidence exists”错误

这是当前最重要的新坑。

GitHub `GITHUB_TOKEN` 触发的 workflow 具有 recursion suppression；不能假设其完成后一定产生 `workflow_run` downstream。

避免：

```text
explicit workflow_dispatch
+ exact rolling_run_id authentication
+ token/event provenance rehearsal
+ O01 preflight directly proves promotion exists
```

### 23.12 把 KBS daily batch 当 hourly scheduler blocker

KBS 是 daily batch，不是 hourly publish。

避免：scheduler/runtime cadence 与 KBS publication cadence 解耦；exact KBS 可用则 Mode A，否则合法 causal fallback Mode B。不能再用“等 KBS 每小时更新”的错误模型。

### 23.13 把 freshness 6h/24h/36h 混成 authority

冻结语义：

```text
6h = historical online freshness diagnostic
24h = cadence engineering observation window
36h = rolling candidate retention/expiry context
```

都不能重新变成 late exact-T authority gate。

### 23.14 merge 后才做 integration test

这是前期最大工作方法问题。

避免：Final Readback → O23 → hourly promotion → O00 → A0 → arm → Graduation → qualification 反向审计；PR CI 必须尽可能运行真实 consumer chain。

---

## 24. 明确禁止的操作

当前任何接手者都不要：

```text
1. rerun O01 live runner 32660018684
2. 删除 NO-GO artifact 9498479992
3. truncate / reset / reuse failed Formal v3
4. 把 O01 FAILED 改回 pending
5. 从 O02 继续并宣称同一 epoch 有效
6. 修改 v11 / blocked_v11 evidence
7. 因纯 workflow fix 自动创建 v12
8. 把 rolling run 32652593667 误判为 provider failure
9. 重新把 KBS cadence 当主 blocker
10. merge unrelated PR 到 protected main while preparing next Formal epoch
11. 手工补写 Formal forcing 来“救活”失败 epoch
12. 用 replay/accelerated result 替代下一次 real O00→O23
```

---

## 25. 当前可以安全并行做什么

在 #3281 未完成前，可以并行做只读/静态工作：

```text
- audit all active Formal workflow triggers
- audit token/event provenance
- audit new Formal generation binding
- audit final readback enum and DB identity
- audit completion/downstream-zero DB identity
- inspect v3 failure artifact/read-only DB
- run zero-effect workflow selftests
- extend deterministic orchestration rehearsal
```

不要并行做：

```text
- new Formal writes
- new A0
- new scheduler slots
- old v3 mutation
- unrelated main merge
```

---

## 26. 证据 ledger — 当前最重要的 immutable IDs

```text
v11 qualification:
subject  abf0aa121001480f01ad4e39364b1df13f3c26eb
run      32638502092
artifact 9493316708
digest   sha256:3a6f01a9c1da1de4522ba9d745e3619b7c116ece45bde39ebec10d8637cb4544

Graduation compatible replay:
run      32650291300
artifact 9495982377
digest   sha256:df4134d2c7e8a63adc19dea537a3761fd4e04bba15fe2627347152dbd5553794

fresh rolling before successful A0:
run      32650465877
artifact 9496737694
digest   sha256:c541eaf13a666dc1474979b9acbbf00175a19d520a69aaca213cfd719656f483

first Formal v3 prebootstrap failure:
run      32646669506
artifact 9495063273
digest   sha256:af6dd063753c9b558cd014358753b9653853b26fe3b4776e864fd59052002f9d
archive DB geox_mcft_cap09_s6_formal_t4r1_24h_v3_failed_32646669506

Formal v3 recovery:
artifact 9495878945
digest   sha256:d91998529a60fb63bda5c05ea87a6008a3e6df6172cf6cb4a6e53d1d81aca449

successful A0 bootstrap:
run      32653201474
artifact 9497548692
digest   sha256:1d5c70f1d7a8258568766516794703a3974237b3450f0fa7bbd8e150433bda96

O00:
run      32656683897
artifact 9497616126
digest   sha256:7ea5d331f08e5fe1c391f9f7bbd251fdf9819334b090aa83d758664c44677f25

O01 irreversible NO-GO:
run      32660018684
artifact 9498479992
digest   sha256:dd531b49138ee5b9046e9cc4d8dbd458572c62995de0cc08a2cad7f64e6ee0d2

rolling that should have fed O01:
run      32652593667
status   SUCCESS
target   2026-08-23T18:00:00Z
```

---

## 27. PR evolution ledger — 从旧 handoff 到当前 frontier

```text
#3267  immutable rolling retention
#3268  v7 fresh generation
#3269  authenticated cross-head Graduation provenance
#3270  v8 generation
#3271  run-scoped rolling namespace
#3272  v9 generation
#3273  T4R1 artifact prefix
#3274  qualification/control-plane compatibility contract
#3275  repeated-digest causal retention semantic fix
#3276  fresh v10 generation
#3277  v10 Graduation bind / CARRY_FORWARD
#3278  final semantic closure bundle / v11 / Formal v3 / orchestration rehearsal
#3279  immutable v11 Graduation bind / CARRY_FORWARD
#3280  Formal v3 prebootstrap recovery / CommonJS wait fix
#3281  CURRENT DRAFT — explicit hourly orchestration dispatch + fresh-epoch closure still to finish
```

不要从 #3265 handoff 的 v6 frontier 重启。

---

## 28. 当前根因分层

```text
KBS cadence                         NOT current blocker
crop authority                      NOT current blocker
GFS/provider availability           NOT root cause of O01 NO-GO
v11 qualification                   PASS / immutable
Graduation                          OPEN / carry-forward proven
A0 canonical bootstrap              PASS
O00 production runtime              PASS / DEGRADED
O01 runtime fail-closed              CORRECT behavior
O01 missing causal forcing          direct failure condition
hourly evidence orchestration       CURRENT ROOT CAUSE
GitHub GITHUB_TOKEN recursion        CURRENT CONTROL-PLANE DEFECT
failed Formal v3 reuse              FORBIDDEN
fresh next Formal generation        REQUIRED BEFORE NEXT EPOCH
v12 qualification                   NOT currently justified
```

---

## 29. 接手者应怎样判断 #3281 是否真正 closure-ready

只有以下全部为真，才可认为 #3281 可以进入 merge decision：

```text
[ ] trigger recursion root cause covered by executable test/static proof
[ ] rolling explicitly dispatches hourly evidence
[ ] hourly consumer authenticates rolling_run_id before mutation
[ ] token/event provenance is part of rehearsal or equivalent proof
[ ] failed Formal v3 immutable boundary frozen
[ ] fresh next actual Formal generation defined
[ ] store provisioning path exists and proves zero-state
[ ] arm/A0/hourly/live/final/completion all point to fresh generation
[ ] active path contains no reusable failed-v3 token
[ ] compatibility machine gate says CARRY_FORWARD, or if not, fresh qualification plan is explicit
[ ] no accidental governed semantic change hidden in workflow wrapper
[ ] all PR CI terminal green
```

如果缺一项，不要再用 protected main 做 discovery integration test。

---

## 30. 最短合法完成路径

```text
finish #3281 closure bundle
↓
PR CI + token/event orchestration proof
↓
merge once
↓
freeze exact protected main
↓
provision fresh actual Formal store
↓
compatible Graduation replay (if machine gate CARRY_FORWARD)
↓
fresh rolling
↓
Formal arm
↓
fresh future A0
↓
prove rolling→explicit hourly promotion before O01
↓
O00 PASS
↓
O01 PASS
↓
O02 ... O23
↓
24 base / 23 promotions / 24 terminal ticks
↓
final readback
↓
formal completion candidate
↓
final read-only adjudication
↓
MCFT-CAP-09 COMPLETE
```

---

## 31. 最后的工程判断

当前 MCFT-9 不是“核心 runtime 做不出来”。

已经真实证明：

```text
v11 13/13 production-equivalent qualification PASS
Graduation OPEN
fresh Formal store provisioning works
A0 production bootstrap works
real O00 production tick works
fail-closed at missing causal forcing works
```

这轮失败证明的是另一件事：

> **控制平面的 event provenance 也是 production semantics 的一部分。只画出 workflow graph 不够；必须证明真实 GitHub token/event 机制会产生下一条 workflow。**

O01 的 NO-GO 是正确的安全结果。错误发生在 O01 之前：rolling 已经成功，但 hourly promotion workflow 没有被创建。

因此下一轮的重点不是放宽 runtime，也不是修改 fallback 让 O01“凑合跑过去”。

正确方向是：

```text
修 orchestration
保留 fail-closed
fresh Formal epoch
早期证明 O01 evidence chain
再跑完整 24h
```

只要坚持这个边界，下一轮不应该再回到 v6→v7→v8→v9 那种 qualification-control-plane 自锁循环。

---

## 32. 一句话 continuation frontier

```text
MCFT-CAP-09 已完成 immutable v11 13/13、compatible Graduation、fresh Formal v3、真实 A0 和真实 O00；Formal v3 在 O01 因 GITHUB_TOKEN-dispatched rolling 未产生 downstream workflow_run hourly-evidence consumer 而正确 fail-closed 为 BLOCKED_NO_CAUSAL_FORCING，并形成 immutable NO-GO。当前 Draft #3281 正在把 hourly evidence 改为 authenticated explicit workflow_dispatch；下一步必须在同一 closure 中冻结 failed v3、建立 fresh actual Formal generation、证明 v11 compatibility boundary，并在下一 epoch O01 前直接验证 rolling→hourly promotion 链存在。不要 rerun/reuse v3，不要继续 O02-O23，不要无理由创建 v12。
```
