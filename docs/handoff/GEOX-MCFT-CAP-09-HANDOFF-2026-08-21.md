# GEOX MCFT-CAP-09 Conversation Handoff — 2026-08-21

Status: **CONVERSATION HANDOFF ONLY — NOT REPOSITORY AUTHORITY**

本 handoff 汇总本轮从 fresh-v4 Amendment-19 qualification、producer-bound rehydration 非确定性、ET0 canonical determinism 修复、T3R1 crop-window authority 失效、Branch A phenology reproof、Alternative Scope Rescue，到当前 T4R1 successor authority / runtime rebind frontier 的完整工作脉络。

它不是新的规范、不是新的 authority、不是对 Taskbook/Amendment 的替代。下一位接手者必须按仓库 authority hierarchy 重新核验 protected main、live PR/run/artifact，再用本文恢复对话上下文。

---

## 1. 当前 exact repository frontier

截至本 handoff 写入前的 live GitHub 核验：

```text
repository:
liyongshang44-max/GEOX

protected main:
002f73f96ae5632162675a86518844c111e30d6d

main merge:
PR #3245
MCFT-CAP-09: qualify T4R1 Formal successor authority

current implementation frontier:
PR #3248
MCFT-CAP-09: route T4R1 runtime rebind around historical gates

PR #3248 base:
002f73f96ae5632162675a86518844c111e30d6d

PR #3248 head:
dc2f80e51254f309b98ee0c35a390e1cc05c0795

PR #3248 state:
OPEN / non-draft / mergeable=true

PR #3248 exact-head workflow status:
ALL observed associated workflows terminal SUCCESS

success runs include:
32458463602  mcft-delivery-policy-v2
32458463585  mcft-main-ruleset-readiness-v1
32458463327  mcft-release-lane-v1
32458463431  mcft-candidate-declaration-selftest-v2
32458463477  mcft-cap-09-amendment19-persistent-24t-qualification
32458463318  mcft-cap-09-ea5b3-external-runtime-config-resolver
32458463542  mcft-cap-09-ea5d1-external-bootstrap-persistence-qualification
32458463436  ci

runtime rebind implementation PR:
PR #3247
MCFT-CAP-09: rebind External Formal runtime to T4R1

PR #3247 state:
OPEN / DRAFT

PR #3247 base:
002f73f96ae5632162675a86518844c111e30d6d

PR #3247 head:
a0f70fbf96ee34f0812a4bbee1ecb351773d1348

IMPORTANT:
#3247 is intentionally stale relative to the planned routing repair.
It MUST be rebuilt/rebased on the protected-main merge SHA produced by #3248 before adoption.
Do not merge #3247 as-is.
```

当前唯一 restart point 是：

> **先裁决/合并 #3248；若合并成功，从新的 protected-main SHA 重建 #3247 的 T4R1 runtime/source rebind exact boundary，然后重新跑 exact-head gates。**

在 #3247 重建并被正式采用之前，**repository authority 已经建立 T4R1 successor candidate/authority，但 active External Formal runtime 仍不能被描述为已经切换到 T4R1。**

---

## 2. Authority hierarchy：下一位接手者先读什么

不要把本文当规范。接手顺序仍应是：

1. 数字孪生总任务书 / Complete Agricultural Digital Twin task boundary；
2. MCFT-CAP-09 Taskbook 与其当前 Delivery Policy；
3. 当前生效 Amendment，尤其 Amendment-19；
4. protected `main` exact SHA 上的 authority/config/runtime code；
5. live GitHub PR / workflow run / artifact / DB evidence；
6. 最后才是本文 handoff。

Amendment-19 当前关键仓库文件包括：

```text
docs/digital_twin/mcft/cap_09/
  GEOX-MCFT-CAP-09-AMENDMENT-19-ACCELERATED-GRADUATION-GATE.md
  GEOX-MCFT-CAP-09-AMENDMENT-19-PROVIDER-RUNTIME-CADENCE-DECOUPLING-AUTHORITY.md
  GEOX-MCFT-CAP-09-AMENDMENT-19-ACCELERATED-GRADUATION-GATE-V1.json
  GEOX-MCFT-CAP-09-AMENDMENT-19-CADENCE-DECOUPLING-AUTHORITY-V1.json

scripts/runtime_acceptance/
  PREFLIGHT_MCFT_CAP_09_AMENDMENT_19_CROP_WINDOW_V1.cjs

scripts/governance_acceptance/
  ACCEPTANCE_MCFT_CAP_09_AMENDMENT_19_CADENCE_DECOUPLING.cjs
  ACCEPTANCE_MCFT_CAP_09_AMENDMENT_19_ACCELERATED_GRADUATION_GATE.cjs
  ACCEPTANCE_MCFT_CAP_09_AMENDMENT_19_PERSISTENCE_FREE_24T.cjs
  ACCEPTANCE_MCFT_CAP_09_AMENDMENT19_PERSISTENT_PRODUCTION_CUTOVER.cjs
  PREFLIGHT_MCFT_CAP_09_FORMAL_EPOCH_GRADUATION_GATE_V1.cjs
  ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_FORMAL_GRADUATION_INPUT_V1.cjs
```

任何新的实现如果与这些冻结边界不一致，应先按 authority 变更流程处理，而不是在 workflow 中偷偷绕过。

---

## 3. 我们现在到底在做什么任务

当前任务不是“继续调查 KBS cadence”，也不是“继续等 T3R1 GDD”，也不是“再跑一遍旧 v3 qualification”。

当前主线已经收敛为：

```text
MCFT-CAP-09 final completion
    ↓
需要一个真实可资格化的 External Research Scope
    ↓
T3R1 的完整 O00–O23 crop authority window 已失效
    ↓
Branch A 没有找到可直接绑定的 T3R1 phenology authority
    ↓
Alternative Scope Rescue 扫描当前季 KBS corn scopes
    ↓
唯一合格 successor = T4R1
    ↓
T4R1 lifecycle + crop-only geometry qualification
    ↓
T4R1 Formal successor authority qualification
    ↓
【当前】把 production External Formal runtime/source/config chain 原子 rebind 到 T4R1
    ↓
fresh T4R1 rolling
    ↓
fresh v4 producer-bound rehydration + persistent 13/13
    ↓
subject-bound graduation
    ↓
new T4R1 A0
    ↓
real wall-clock O00–O23
    ↓
final readback/adjudication
    ↓
MCFT-CAP-09 completion candidate
```

因此当前任务是一个 **scope succession + exact-subject requalification** 问题，不是简单换 field ID。

---

## 4. 本轮开始时的旧 frontier

本轮接手时 protected main 是：

```text
4e3460656e52166a63c7276e5e70de247f71c4b7
```

当时已有：

- fresh rolling producer run `32371029955` SUCCESS；
- rolling artifact `9409234348` 完整；
- persistent consumer run `32376543137` 在 producer-bound rehydration 阶段 semantic manifest equality FAIL；
- persistent 24T 尚未真正开始；
- Formal O00–O23 尚未启动；
- 历史 `58fb...` 的 13/13 不能迁移到新 subject SHA。

最初看起来像 producer/consumer semantic 不一致，但后续诊断证明不是稳定的 raw evidence 差异。

---

## 5. 已完成：rehydration 非确定性定位与 ET0 deterministic canonicalization

### 5.1 诊断事实

诊断 PR #3237 在同一 subject SHA、同一 rolling artifact、同一 retained raw objects、同一 Python 3.12.14 条件下，曾得到：

```text
PASS
semantic_manifest_match=true
```

而 predecessor persistent run 又真实发生过 semantic hash mismatch。

由此排除了“稳定 producer/consumer 语义不同”这一简单解释，转而确认存在 runner/environment-sensitive 非确定性。

进一步多 runner 精度探针把漂移收敛到：

```text
record family:
future_et0_assumption_v1

not drifting:
weather canonical family
soil canonical family
retained raw evidence
```

高概率来源为 GFS 解码后 ET0 浮点全精度值跨 CPU/libm/NumPy/refet 的末位差异。

### 5.2 生产修复 #3238

PR #3238：

```text
fix(mcft-cap09): canonicalize ET0 decoder output
```

完成并合并。

修复边界：

- 新增显式 `decode-gfs-v2`；
- V1 历史解码语义保持不变；
- 仅对 `future_et0_assumption_v1.points[*].et0_mm_per_hour` 做 12 位小数 half-away-from-zero 归一化；
- rolling capture、producer-bound rehydration、Formal A0 promotion、Formal hourly promotion 全部统一到 V2；
- runtime dependency graph 重绑定；
- 没有削弱 semantic hash；
- 没有改变 retained raw authority；
- 没有引入 alternate/simplified execution path。

这一步非常重要：它解决的是 **canonical determinism**，不是通过忽略 hash mismatch 来“让测试过”。

### 5.3 必须保留的坑教训

以后遇到 rehydration hash mismatch：

不要：

- 靠重跑一次 PASS 就判修复；
- 降低 semantic hash 覆盖范围；
- 只 hash rounded presentation value；
- 另写 simplified decoder/runner；
- refetch provider raw 替代 exact retained artifact；
- 在 consumer 端单独补 rounding。

必须保证 producer 与 consumer 调用同一 canonical decode/canonicalization core。

---

## 6. 已完成：fresh v4 qualification stores 与 subject binding

PR #3239：

```text
fix(mcft-cap09): bind fresh v4 qualification and formal successor replay
```

完成并合并。

建立/绑定 fresh qualification stores：

```text
geox_mcft_cap09_s6_accel24t_am19_v4
geox_mcft_cap09_s6_accel24t_am19_blocked_v4
```

当时两库：

- 26/26 required tables；
- authoritative columns/constraints/index fingerprints 匹配；
- governed tables 全零；
- v3 继续保留为历史审计 evidence；
- fresh qualification 加 exact-subject sentinel，禁止跨 SHA 重用。

这条原则仍然有效：

> **只要 protected-main subject SHA 变化，旧 qualification evidence 不自动迁移。**

尤其不要因为“代码只改了 workflow routing”就口头把 predecessor 13/13 搬过来。

---

## 7. 已完成：crop-window preflight 揭露 T3R1 真 blocker

在 fresh qualification 准备继续时，真正的前置 blocker 不再是 ET0 或 persistence，而是 crop authority window。

PR #3241 引入纯只读：

```text
PREFLIGHT_MCFT_CAP_09_AMENDMENT_19_CROP_WINDOW_V1
```

它必须发生在：

- decoder install；
- provider access；
- producer-bound rehydration；
- fresh v4 DB open/write；
- subject sentinel write

之前。

真实 rolling candidate A0：

```text
2026-08-21T04:00:00.000Z
```

结果：

```text
O00..O16: crop authority valid
O17 @ 2026-08-21T22:00:00.000Z:
window spans MID and LATE
=> exact 24-slot crop authority not uniquely established
=> FAIL CLOSED
```

同时证明：

```text
provider requests = 0
R2 requests = 0
rehydration started = false
DB reads/writes = 0/0
v4 subject sentinel writes = 0
both v4 stores remain zero-state
Formal remains 0/24
```

这一步阻止了一个非常危险的错误：如果没有 full-window preflight，系统会先污染 fresh qualification store，再在 O17 才发现 crop authority 不成立。

---

## 8. T3R1 为什么没有继续硬等或硬修

### 8.1 Branch A reproof

PR #3242：

```text
feat(mcft-cap09): start T3R1 Branch A phenology reproof
```

扫描 KBS AgLog，自 planting anchor：

```text
observation id: 6966
planting date: 2026-05-20
scope: T3 / T3R1
```

沿 5 页 / 150 records 检查可用 phenology / termination candidates。

实际结论：

```text
NO_T3R1_PHENOLOGY_AUTHORITY_CURRENTLY_ESTABLISHED
```

这不是“没有任何语义 token”，而是：

- 没有足够直接、空间可绑定、时间可绑定、mapping 可裁决的现季 T3R1 phenology authority；
- 不能从一般 agronomy stage 名称、邻近地块、历史 season 或 model inference 偷渡成 direct authority；
- positive semantic candidate 即使发现，也仍需独立 spatial/temporal/mapping qualification。

### 8.2 为什么不把 bounded GDD 当主线

GDD 路径仍可作为保底 observer，但不能成为当前主线，因为当时估计可能需要等待约 3 周以上。

Taskbook 冻结的是：

> 一个合格 External Research Scope 完成真实 O00–O23。

它没有永久冻结“必须永远是 T3R1”。

因此 successor scope 可以通过新的 authority supersede 当前 active scope，同时保留 T1R1/T3R1 历史 evidence，不需要让整个 MCFT-9 被单一地块物候窗口绑死数周。

---

## 9. 已完成：Alternative Scope Rescue

PR #3243：

```text
feat(mcft-cap09): discover alternative Formal scope candidates
```

在扫描前先冻结 deterministic selection rule，再扫描当前季 KBS MCSE corn treatments T1–T6；禁止先看结果再挑喜欢的 field。

候选要求包括：

- explicit crop identity；
- explicit hybrid identity；
- planting identity 可绑定；
- lifecycle 可成立；
- 当前完整 O00–O23 内 stage/Kc 唯一；
- crop-only geometry 可资格化；
- 可复用已成立的 weather/soil/GFS source authority；
- 不迁移 T1R1/T3R1 canonical state。

结果：

```text
unique eligible successor:
T4R1

planting observation:
6974

planting date:
2026-05-27

crop:
corn

hybrid:
43-96P

valid MID O00 candidates:
113

earliest observed candidate O00 at discovery time:
2026-08-23T06:00:00Z
```

重要：#3243 只是 candidate discovery，不自己创建 successor authority。

---

## 10. 已完成：T4R1 lifecycle + crop-only geometry

PR #3244：

```text
feat(mcft-cap09): qualify T4R1 lifecycle and crop-only geometry
```

最终已合并。

同一 exact-head 上建立：

### Lifecycle

```text
ACTIVE
RESOLVED
VALID

known termination/conflict:
0
```

资格链包括：

- 从 planting anchor 做 structured AgLog index/detail scan；
- known termination/conflict classification；
- 180-day truncation guard。

### Crop-only geometry

```text
unique official scope:
T4 / R1 / main polygon

crop-only geometry qualification:
PASS

geometry hash:
sha256:8108f8e38dbe1326cc3d10d05a96843d77bdf1fdb28b7ed28cb53126a6818868

conservative crop-only area:
approx 700.15 m²
```

geometry 明确排除了 central prairie strip，不允许把 non-crop patch 混入 Formal crop zone。

这一步仍然没有：

- runtime rebind；
- DB/R2 write；
- Formal start。

---

## 11. 已完成：T4R1 Formal successor authority

### 11.1 historical S6 routing repair #3246

在 successor authority PR 上发现两个 historical S6 path routers 仍把旧 T3R1 exact-boundary 当普适 gate，导致合法 successor boundary 会被错误拦截。

PR #3246：

```text
MCFT-CAP-09: route T4R1 successor around historical S6 gates
```

已合并。

它只教 historical routers 识别 exact seven-file T4R1 successor authority boundary 为不适用旧 gate；没有修改 authority document/runtime/database/R2/scheduler/Formal。

### 11.2 successor authority #3245

PR #3245：

```text
MCFT-CAP-09: qualify T4R1 Formal successor authority
```

已合并，形成当前 protected main：

```text
002f73f96ae5632162675a86518844c111e30d6d
```

它建立 V3 Formal：

- site successor authority；
- reality successor authority；
- crop-context successor authority；
- exact T4R1 lifecycle binding；
- exact crop-only geometry binding；
- current stage/Kc window re-derivation。

但 #3245 明确保留 non-effects：

```text
NO runtime/source rebind
NO R2 write
NO database write
NO producer-bound rehydration
NO scheduler arm
NO EA5E2 activation
NO Formal O00–O23 start

v4 stores remain zero-state
Formal remains 0/24
```

因此不能说“#3245 合并后 MCFT-9 已经开始 T4R1 Formal”。

---

## 12. 当前进行中：T4R1 runtime/source rebind

### 12.1 Draft #3247

PR #3247：

```text
MCFT-CAP-09: rebind External Formal runtime to T4R1
```

当前 exact boundary：

- 13 files / 1 commit；
- runtime scope 改为：

```text
field_kbs_mcse_t4r1
zone_kbs_mcse_t4r1_crop_formal_v1
```

- pin V3 site/reality/crop authority；
- pin T4R1 lifecycle；
- pin T4R1 crop-only geometry；
- source matrix 保留 V1，不做 field-equivalence 偷升格；
- rolling crop-legality fixtures 迁到 T4R1 MID window；
- workflow authority paths 迁到 T4R1；
- legacy + active rolling dependency graphs 重算；
- carrier digest 重算；
- future fresh T4R1 Formal DB 增加 EA5A V3 fail-closed requirement。

明确 non-effects：

- 不创建 DB/R2；
- 不复制 T3R1 canonical rows；
- 不复用 T3R1 persisted A0；
- 不写 sentinel/Formal evidence；
- 不 arm scheduler；
- 不启动 O00–O23。

### 12.2 为什么 #3247 现在不能直接合并

它暴露出三个 historical T3R1 gates 仍把旧 frozen A18/T3R1 identity 当成普适约束：

- EA5B3；
- EA5D1；
- Amendment-19 persistent qualification orchestration checks。

不能通过放宽 gate 来解决；必须像 #3246 一样，只对**精确 file-set / exact successor boundary**做 path routing，并保留其他 compatibility tests。

### 12.3 routing repair #3248

PR #3248：

```text
MCFT-CAP-09: route T4R1 runtime rebind around historical gates
```

范围：

```text
3 workflow files
1 commit
head dc2f80e51254f309b98ee0c35a390e1cc05c0795
```

策略：

- T4 runtime rebind classifier 必须 exact 匹配 #3247 的 13-file set；
- 多一个/少一个/改名一个文件都回到 historical fail-closed path；
- EA5B3 / EA5D1 仍继续 server/resolver/CAP04/isolated PostgreSQL compatibility tests；
- 只不 replay obsolete exact-base authority checks；
- Amendment-19 只 skip 与 historical T3R1 frozen A18 identity 绑定的 pure orchestration selftests。

截至写本文时，#3248 exact head 的关联 workflow 已全部 SUCCESS，且 PR `mergeable=true`。

但：

> **#3248 尚未合并。**

所以 handoff 不得把 routing repair 描述为已进入 protected main。

---

## 13. 当前 blocker / 非 blocker 分类

### 13.1 当前真正 blocker

唯一直接 implementation blocker：

```text
#3248 尚未合并
↓
#3247 不能基于其 routing repair merge SHA 重建
↓
T4R1 runtime/source rebind 尚未成为 protected-main authority/runtime fact
```

### 13.2 不是当前 blocker 的东西

以下都不应再被当成当前主线 blocker：

- KBS 是否 hourly/daily：已经确认 daily batch，且 Amendment-19 已 decouple provider cadence 与 runtime cadence；
- ET0 semantic hash drift：已由 #3238 canonical determinism 修复；
- v4 schema 准备：已准备并 subject-bound；
- T3R1 GDD：只做 fallback observer，不是主线；
- T3R1 Branch A：已经得到当前 `NO_T3R1_PHENOLOGY_AUTHORITY_CURRENTLY_ESTABLISHED`；
- T4R1 candidate selection：已完成；
- T4R1 lifecycle/geometry：已完成；
- T4R1 successor authority：已通过 #3245 进入 protected main；
- Formal 24h wall-clock 本身：它是最终必做 gate，但现在还没到启动点。

---

## 14. 下一步严格执行顺序

### Step 1 — merge adjudication for #3248

先核：

- head 仍是 `dc2f80e5...`；
- base 仍是 `002f73f9...`；
- 3 files / 1 commit boundary 未漂移；
- exact-head workflow 仍 terminal SUCCESS；
- mergeable 仍 true；
- 没有新 review blocker。

若成立，合并 #3248。

### Step 2 — freeze new protected-main SHA

合并后立刻读取新 main SHA，记为：

```text
S_rebind_route
```

不要继续使用 `002f73f9...` 作为 qualification subject。

### Step 3 — rebuild #3247 on S_rebind_route

不要 merge 当前旧-base Draft #3247。

应该：

- rebase/rebuild same intended 13-file runtime/source rebind onto `S_rebind_route`；
- 确认 diff 仍严格等价于冻结的 T4R1 rebind intent；
- 重新计算 dependency graphs / carrier digest；
- rerun all exact-head gates；
- 不把 #3248 predecessor CI 迁移为新 head CI。

### Step 4 — merge rebind only after exact-head all-green

rebind merge 后得到：

```text
S_t4_runtime
```

从这里开始，才可以说 active repository runtime/config chain 已正式指向 T4R1 successor scope。

### Step 5 — fresh T4R1 rolling candidate

必须从 `S_t4_runtime` 重新捕获：

- current exact crop-window preflight；
- exact provider/raw authority；
- exact T4R1 scope；
- exact decoder V2；
- exact runtime dependency graph；
- exact rolling artifact。

任何 T3R1 rolling artifact 都只能做历史证据，不能做 T4R1 producer input。

### Step 6 — fresh v4 producer-bound rehydration

使用 exact retained raw artifact：

- no provider refetch；
- R2 raw read only until governed write phase；
- same decoder/canonicalizer；
- semantic manifest exact equality；
- exact-subject sentinel；
- no cross-SHA evidence reuse。

### Step 7 — persistent accelerated 13/13

v4 full qualification 必须继续满足：

```text
same schema
same runtime config chain
same persistence repositories
same scheduler
same lease/fencing
same runner
same health/checkpoint semantics

only accelerated clock substitutes wall-clock waiting
```

不能为了测试另外写 simplified runner。

### Step 8 — graduation

只有 exact `S_t4_runtime` 的 fresh qualification：

```text
13/13 PASS
static_blocker_count=0
subject-bound evidence valid
```

才允许打开 graduation gate。

历史 `58fb...`、v3、T3R1、pre-rebind v4 PASS 全部不可作为 substitute。

### Step 9 — new T4R1 A0

需要新的 T4R1 A0 bootstrap：

- producer-bound exact retained evidence；
- durable raw retention before canonicalization；
- production lease/repositories；
- real DB clock；
- no T3R1 persisted A0 copy；
- lease expiry <= O00；
- bootstrap 不提前写 O00 scheduler slot。

### Step 10 — real O00–O23

最终仍必须是真实 wall-clock 24h。

Accelerated qualification 不能替代 Formal。

### Step 11 — final readback/adjudication

最终要求至少一致证明：

- exact 24 terminal ticks O00–O23；
- exact 24 causal base snapshots；
- A0 + hourly evidence chronology；
- no O23 extra O24 seed；
- final pointer/readback consistency；
- raw provenance retained；
- same-epoch terminal NO-GO scan；
- downstream recommendation/approval/action/dispatch/model-activation zero side-effect proof；
- only then assemble completion candidate。

---

## 15. 这一轮最重要的工程约束

### 15.1 accelerated lane 不能“测另一套代码”

Persistence-free 24T 与 persistent accelerated lane 必须调用 production persistent path 使用的 canonical core：

```text
current-interval forcing selector
→ State propagation
→ Forecast
```

不能出现：

```text
engineering lane PASS
production lane FAIL
```

只是因为两条路根本不是同一 execution graph。

### 15.2 accelerated full 24T 只能替代时钟

fresh v4 accelerated qualification 应尽量做到：

```text
Formal system - wall-clock waiting + accelerated clock seam
```

而不是一个 mock simulation。

### 15.3 raw retention before canonicalization

永远不要为了 semantic determinism 放弃 raw provenance。

正确顺序仍是：

```text
provider bytes / retained object
→ immutable raw identity
→ decoder
→ canonical record
→ semantic hash
```

### 15.4 late evidence 不 retroactive repair

Amendment-19 的核心不是“让 provider 等到数据来”。

Runtime cadence 与 provider cadence decoupled：

- required causal evidence at T 若可由 frozen authority 的 prior evidence 支持，可以 DEGRADED/ASSUMED 按协议继续；
- conflict / required-family gap 则 fail closed；
- late arrival 不得回写历史 T；
- no future leakage；
- no interpolation；
- no persistence fill；
- no source substitution。

---

## 16. 已踩过的坑，下一位不要再踩

### 坑 A — 把 provider freshness 当 crop authority

KBS freshness/cadence 与 crop stage authority 是两类问题。

不要因为 KBS 数据“很新”就推导 stage/Kc 唯一。

### 坑 B — 认为 KBS Raw Hourly 应该 hourly 发布

已经证明是 daily batch，一次推进约 24h。

不要再围绕 6h/7h/14h 做 cadence patch。

### 坑 C — 用固定 age threshold 当 late exact-T authority

`<=6h` 仅可保留历史 online freshness diagnostic 身份，不是 late authoritative admission gate。

### 坑 D — protected-main drift 后继续复用旧资格证据

任何 exact-subject-bound qualification 都必须重新开始。

### 坑 E — 一次重跑 PASS 就关闭 intermittent determinism bug

#3237 已证明 intermittent mismatch 可能消失。

必须跨 runner 捕获、按 record family 缩小，再修 canonical source。

### 坑 F — 通过放宽 semantic hash 解决 floating drift

错误。

正确方案是 canonical numeric normalization，且 producer/consumer 同一 core。

### 坑 G — 等到写 DB 后才检查完整 crop window

#3241 已证明必须 preflight A0 + O00–O23，且发生在任何 side effect 之前。

### 坑 H — 把 model-inferred stage 冒充 external authority

Branch A 没有 direct authority 就必须明确 NO AUTHORITY。

不能因为“农学上很可能是 MID”就当作 authoritative MID。

### 坑 I — 把 successor candidate discovery 当 successor authority

#3243 只是 discovery；#3244 是 lifecycle/geometry；#3245 才建立 Formal successor authority。

三层不能混写。

### 坑 J — successor authority 建立后就说 runtime 已切换

当前正处于这个边界。

#3245 已合并不等于 #3247 已生效。

### 坑 K — historical gate 直接删除

#3246/#3248 都采用 exact-boundary routing，而不是把旧 gate 拔掉。

历史 T3R1 path 仍要 fail-closed。

### 坑 L — 复用 T3R1 canonical state / persisted A0

禁止。

T4R1 是新的 External Formal subject scope，必须 fresh rolling / fresh rehydration / fresh A0。

### 坑 M — accelerated 24T 替代真实 Formal

不允许。

最终 O00–O23 必须 real wall-clock 24h。

---

## 17. 关于 T4R1 的当前已知事实与禁止外推

当前可说：

```text
T4R1 is the unique currently-qualified alternative scope candidate
under the frozen Alternative Scope Rescue selection rule.

planting = 2026-05-27
hybrid = 43-96P
planting record = 6974
lifecycle = ACTIVE / RESOLVED / VALID
crop-only geometry = qualified
successor Formal authority = adopted on protected main by #3245
```

当前不能说：

```text
T4R1 runtime already active          -- false / not yet
T4R1 v4 13/13 already graduated      -- false
T4R1 A0 already persisted            -- false
T4R1 Formal started                  -- false
Formal O00-O23 completed             -- false
MCFT-CAP-09 completed                -- false
```

截至本 handoff：

```text
Formal = 0/24
```

---

## 18. 诊断 PR / 非主线 PR 的处理

以下历史诊断 PR 仍可能存在 open draft，但不得误合并：

```text
#3237 diag(mcft-cap09): isolate rolling semantic hash mismatch
#3236 diagnostic(mcft-cap09): repeat exact-main rehydration hash probe
```

它们只用于历史定位。

尤其 #3237 body 已明确 `must never merge`。

商业 demo PR #3240 也是独立 off-main 工作流，不属于当前 MCFT-CAP-09 qualification mainline；不要 rebase/merge 它来“顺便清 PR”。

---

## 19. 下一位接手者建议的第一轮命令/核验清单

接手后不要先写代码，先重新读取 live GitHub：

```text
1. protected main SHA
2. PR #3248 current head/base/state/mergeable
3. #3248 exact-head workflow terminal conclusions
4. whether #3248 has merged since this handoff
5. PR #3247 current base/head/draft state
6. if #3248 merged, compare #3247 against new main and rebuild instead of merge-old-base
7. verify no Formal DB / scheduler / A0 side effect has appeared unexpectedly
8. verify v4 qualification stores are still in the expected pre-rebind state
9. verify Formal remains 0/24 unless a later authorized chain says otherwise
```

如果发现本文之后 #3248 已合并，则本文的 restart point 自动前移到：

```text
rebuild T4R1 runtime/source rebind on new protected main
```

不要再重复 #3248 已完成的 historical routing investigation。

---

## 20. GO / NO-GO 决策

### 当前对 #3248 的技术状态

基于 handoff 写入时 live evidence：

```text
exact head = dc2f80e51254f309b98ee0c35a390e1cc05c0795
mergeable = true
associated workflows = terminal SUCCESS
```

因此它处于 **merge adjudication ready** 状态。

### runtime rebind 的 GO 条件

只有：

```text
#3248 merged
+
#3247-equivalent rebind rebuilt on exact new main
+
exact 13-file boundary preserved
+
all exact-head gates green
```

才 GO merge runtime rebind。

### qualification 的 GO 条件

只有 runtime rebind 进入 protected main 后，才 GO：

```text
fresh T4R1 rolling
→ fresh producer-bound rehydration
→ fresh v4 persistent 13/13
```

### Formal 的 GO 条件

只有 exact runtime subject：

```text
13/13 PASS
static_blocker_count=0
subject-bound graduation valid
new T4R1 A0 admitted
O00 timing valid
```

才 GO real wall-clock Formal。

---

## 21. 一句话交接

**MCFT-CAP-09 已经从“fresh-v4 rehydration nondeterminism”推进到“合法 T4R1 successor 已进入 protected main”；当前只差先合并全绿的 #3248 historical-gate routing repair，再在其新 main SHA 上重建并采用 #3247 的 T4R1 runtime/source rebind。之后必须从该 exact subject 重新跑 fresh rolling → v4 13/13 → graduation → new T4R1 A0 → real O00–O23，任何 T3R1 / predecessor-SHA evidence 都不得迁移。**
