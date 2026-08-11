# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-11

更新时间：2026-08-11 17:01（UTC+8）

```text
repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
e220baa72415d8d95580a153e2a0acba7f9b7cad

protected_main_merge:
PR #3045 — MCFT-CAP-09: qualify successor whole-window viability scanner

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

current_taskbook_version:
Complete Taskbook v0.5 — Stage 1B Design Freeze / S6 Amendment-01 + Amendment-02 + Amendment-03 + Amendment-04 Bound

additional_effective_overlays:
Amendment-05 — External Formal Runtime Authority Profile
Amendment-06 — Formal Window Epoch Rebase Authority
Amendment-07 — Fixed-lag External Formal Causality
Amendment-08 — Implementation / Operational Activation Qualification Separation Authority

current_primary_formal_planning_frontier:
S6-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-UNDER-AMENDMENT-08

parallel_operational_frontier:
S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08

operational_activation_qualified:
false

current_season_successor_epoch_available:
false

current_season_successor_result:
NO_CURRENT_SEASON_SUCCESSOR_EPOCH

successor_epoch_selected:
false

ea5e3_effective:
false

formal_window_started:
false

formal_execution:
0/24

mcft_cap09_complete:
false

handoff_authority_class:
CONTINUATION_CONTEXT_ONLY
```

---

## 0. 这份 handoff 的定位与权威顺序

这份文件只用于下一对话恢复 MCFT-CAP-09 的工程上下文，不制造任何新的 effectiveness、activation、epoch、crop/season authority 或 Formal write authority。

下一对话必须按以下顺序认定事实：

```text
1. 当前 Taskbook + protected-main 已 effective Amendment / Delivery Policy
2. protected main repository fact
3. live PR / exact-head workflow run / immutable artifact / Formal DB read-only proof
4. 本 handoff
```

如果本 handoff 与 protected main 冲突，以 protected main 为准。

本 handoff 的准确 base 是：

```text
main@e220baa72415d8d95580a153e2a0acba7f9b7cad
```

这是 PR #3045 的 merge commit。

### 严禁误读的旧状态

以下 PR / handoff / epoch 都已经过期、被 supersede 或仅是历史证据，下一对话不得当成当前 frontier：

- PR #3007：旧 EA5B1 handoff，未合并；
- `docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-10.md`：历史 A06C→EA5E1 handoff；
- PR #3035：pre-Amendment-08 EA5E2 implementation PR，已关闭且被 #3039 supersede；
- PR #3040：重复 EA5E2 PR，已关闭；
- PR #3044：successor scanner 早期版本，被 #3045 supersede；
- PR #2958：早期 EA1 machine-source binding PR，仍是旧生命周期，不代表当前 S6 frontier；
- 原 A06A selected epoch `2026-08-11T17:00Z .. 2026-08-12T16:00Z`：不可 rescue、shift、backfill、relabel。

---

# 1. 我们正在做什么任务

仍然是：

```text
MCFT-CAP-09 — Shadow-Online Promotion
目标：STAGE_1B_SHADOW_ONLINE_CLOSURE
当前大阶段：S6 Formal 24-hour closure
```

目标不是 Recommendation / Approval / AO-ACT / Dispatch，也不是商业闭环。

S6 最终仍必须形成：

```text
External Reality / Evidence
→ private durable raw retention
→ governed canonical Evidence
→ External Runtime Config authority
→ honest A0 handoff
→ exact successor 24-config chain + Window Manifest
→ protected-main Operational Activation evidence
→ EA5E3 Formal Authority V3
→ actual UTC O00 ... O23
→ scheduler / State / Forecast / Scenario / Checkpoint / Health / lineage
→ restart / intentional miss / oldest-first backfill / stale / late-evidence behavior
→ final exact-SHA / R2 closure
```

但 Amendment-08 后，生命周期已经被拆成两条互不替代的线：

```text
A. Implementation Qualification / preparatory engineering
B. Operational Activation Qualification / real-provider actual-UTC proof
```

第三方 provider outage 可以阻塞 B，但不再自动阻塞已经满足 repository-controlled acceptance 的 A。

当前真正的 Formal 规划主线已经不是“等 KBS 然后继续旧 epoch”，而是：

```text
S6-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-UNDER-AMENDMENT-08
```

原因：#3045 已机器证明，在现有冻结 EA2 crop authority + Amendment-06/08 timing 下，当前 season 已不存在任何可合法新选的完整 24-slot successor epoch。

---

# 2. 当前 authority

## 2.1 Taskbook

文件：

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
```

当前仍是：

```text
Complete Taskbook v0.5
GEOX-MCFT-CAP-09-TASK-V0.5-STAGE-1B-S6-AMENDMENT-01-02-03-04-BOUND
```

Taskbook 文件标题只显示 Amendment-01~04，不代表后续 overlays 未生效。

## 2.2 后续 effective overlays

必须同时读取：

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-FIXED-LAG-EXTERNAL-FORMAL-CAUSALITY.md
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY.md
```

其中 Amendment-08 是当前生命周期判断的关键：

```text
IMPLEMENTATION_QUALIFIED
!=
OPERATIONAL_ACTIVATION_QUALIFIED
```

它没有降低任何 live threshold，只改变“provider outage 阻塞什么”。

---

# 3. 自上一份 handoff 后已经完成并进入 protected main 的工作

## 3.1 EA5E1 — Formal DB preflight + immutable Window Input Manifest

PR：

```text
#3033 — MCFT-CAP-09 EA5E1: freeze post-rebase Formal input manifest
```

完成：

- 24 个明确 `Runtime Config ref/hash/parent/crop-context` pin；
- exact A06C artifact equality；
- Formal Neon READ ONLY preflight；
- live DB identity / inventory / A0 / scheduler 0/0 / forbidden-marker checks；
- zero-write proof。

这份 EA5E1 manifest 现在是 **旧 A06A epoch 历史 authority**，不得直接拿来作为未来 successor epoch manifest。

## 3.2 Amendment-07 — fixed-lag External Formal causality

PR：

```text
#3034 — MCFT-CAP-09 Amendment-07: fixed-lag External Formal causality
```

它解决了一个真实因果矛盾：exact-hour Rain / Historical ET0 的 `(T-1h,T]` 最终小时观测不可能在 provider 正发布延迟下同时满足 `available<=T`。

冻结的 External Formal profile：

```text
pre-boundary collector target   = T-00:30
late exact-hour collector       = T+06:30
scheduler eligibility           = T+07:00
late evidence cutoff            = T+07:12
Runtime observer                = T+07:17
minimum ingestion margin        = 5m
KBS Raw Hourly max age          = <=6h
```

只允许 Rain / Historical ET0 使用 late cutoff。

Soil / Future Weather / Future ET0 仍保持 pre-T causal cutoff；Future Weather / Future ET0 必须是同一完整 GFS cycle。

禁止：

- source substitution；
- timestamp relabel；
- 旧小时平移到目标小时；
- interpolation / persistence fill；
- post-T Future Forcing；
- cross-cycle substitution；
- accelerated Formal clock。

## 3.3 Amendment-08 — implementation 与 operational activation 解耦

PR：

```text
#3038
merge SHA: f150b18a2ab9691fec64eaecb00105911857994c
```

触发原因：#3035 已证明主要软件链可正确 fail-closed，但 KBS provider 长时间 stale 使“软件 merge”被第三方 availability 无限阻塞。

A08 的正确裁决：

```text
provider outage
→ may block Operational Activation
→ must NOT by itself block already-qualified software merge
```

但 live activation 仍保留所有原始安全约束，不能为了方便降低 freshness / lag / source / clock / crop-context 标准。

## 3.4 EA5E2 Implementation Qualification 已进入 main

PR：

```text
#3039 — MCFT-CAP-09 EA5E2: implementation qualification under Amendment-08
```

#3035 已被它 supersede。

已经进入 protected main 的 EA5E2 implementation 包括：

- 7h fixed-lag scheduler seam；
- exact-hour late-cutoff seam；
- provider-specific two-phase collector composition；
- private raw retention before decode；
- restricted append-only External Evidence ingress；
- External-only read-only DB Evidence source；
- DB source → External CAP04 candidate；
- A1 / COMPLETED / 72-point deterministic compatibility；
- Runtime provider request = 0；
- Runtime R2 HEAD = 0；
- Formal DB / Formal R2 / scheduler / canonical Runtime write = 0 during qualification。

状态：

```text
EA5E2_IMPLEMENTATION_QUALIFIED = true
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false
```

## 3.5 Protected-main Operational Activation runner 已 qualified 并进入 main

PR：

```text
#3041 — MCFT-CAP-09 EA5E2: protected-main operational activation runner
merge SHA: 5229598e1222defd2aa3a2dab73649678e2300d8
```

runner 只允许 protected-main live proof，不再允许 feature-branch live proof冒充 activation。

真实时钟必须走：

```text
T-00:30
→ T+06:30
→ T+07:00
→ T+07:12
→ actual T+07:17 observer
```

observer 已在 qualification 中修掉两处真实接线错误：

1. 不能实例化不存在的 `ExternalFormalCap04CandidateExecutionServiceV1`；正确接口是：
   `PostgresExternalFormalEvidenceSourceV1.loadCandidateRecords()` + `executeExternalFormalCap04CandidateV1()`；
2. scheduler 表名必须使用真实：
   `twin_shadow_online_scheduler_slot_v1` / `twin_shadow_online_scheduler_cursor_v1`。

即使 live workflow PASS，也只能得到 candidate operational evidence；仍需独立 exact-head **activation evidence freeze** merge 后，`OPERATIONAL_ACTIVATION_QUALIFIED` 才能 effective。

截至本 handoff：

```text
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false
```

不要把“runner qualified”误写成“activation qualified”。

## 3.6 Post-activation readiness audit 已进入 main

PR：

```text
#3042
merge SHA: c31a5533521a671d6059cadfe4209182ce3b1926
```

这个 audit 提前查清了 KBS 等待结束后可能踩的结构性问题。

最重要结论：

### 历史 Formal runner 不可直接复用

旧 scheduled S6 Formal workflow / legacy runner：

- 使用静态 `GEOX_MCFT_CAP09_S6_CANONICAL_INPUT_JSON`；
- 仍走 Replay-oriented path；
- 不使用 External DB-only Evidence；
- V2 runner 仍委托旧 runner；
- helper 仍带 MCFT-00 Replay authority / C8 soil-hydraulic identity。

因此 successor Formal 必须使用新的 External Formal V3 entrypoint。

### 旧 epoch 资产不可直接复用

历史-only：

- A06A old epoch selection；
- A06B old 24-config builder（硬编码 epoch/MID）；
- A06C old persistence result；
- EA5E1 old manifest + old fixed inventory checks；
- legacy/V2 Formal runner。

### EA5E1 的 `60 facts / 49 configs` 不是永久 global invariant

如果未来合法 append 第三条 24-config chain，规划 inventory 将变为：

```text
Runtime Configs = 73
facts = 84
```

这只是 append-only planning consequence；真正 live assert 前必须重新 READ ONLY preflight。

## 3.7 External Formal V3 persistent tick core 已 implementation-qualified

PR：

```text
#3043
merge SHA: 6ae90765b1ec90f96d9f07895d4570bfa53382e0
```

新增 V3 persistent tick core，核心 contract：

- 消费一个 already-claimed fixed-lag scheduler slot；
- 消费 exact manifest slot pin；
- exact persisted next-tick handoff；
- exact Runtime Config ref/hash；
- DB-only External Evidence；
- exact `T+07:12` cutoff；
- actual observer `T+07:17`，max skew 10m；
- scheduler claim 的 lease owner/fencing token同时用于 canonical A / Scenario B；
- 不获取第二套 Runtime write lease；
- A1 COMPLETED 才允许 Scenario；
- A2 BLOCKED 禁止 Scenario；
- existing A+B retry 0 write；
- pending-B crash recovery从 canonical Forecast重建 B，不重读 provider Evidence；
- Runtime provider/R2能力 = 0。

状态：

```text
EXTERNAL_FORMAL_V3_PERSISTENT_TICK_IMPLEMENTATION_QUALIFIED = true
EXTERNAL_FORMAL_V3_FORMAL_EXECUTION_AUTHORIZED = false
```

## 3.8 Successor whole-window viability scanner 已进入 main

PR：

```text
#3045
merge SHA / current protected main:
e220baa72415d8d95580a153e2a0acba7f9b7cad
```

它使用完全冻结的 EA2 crop authority：

```text
planting possible UTC window:
[2026-05-11T04:00:00Z, 2026-05-12T04:00:00Z)

six frozen FAO-56 maize stage variants
no future observations
T-6h backward stability
inclusive T+30h forward transition guard
exact 24 hourly slots
minimum successor lead = 36h
EA5E3 readiness = O00-12h
```

独立 deterministic 结果：

```text
latest complete current-season O00:
2026-08-11T22:00:00Z

corresponding O23:
2026-08-12T21:00:00Z

all 24 slots:
MID

next hour 2026-08-12T22:00Z:
fails transition guard

latest possible successor epoch-selection effectiveness time:
2026-08-10T10:00:00Z

Amendment-08 effective time:
2026-08-11T02:33:13Z

required result:
NO_CURRENT_SEASON_SUCCESSOR_EPOCH
```

关键含义：

**KBS 即使现在恢复，也不能 rescue current-season Formal O00–O23。**

KBS recovery 仍然有价值，因为它可以完成 protected-main software Operational Activation Qualification / evidence freeze；但它不再能自动产生 current-season successor epoch。

---

# 4. 当前到底卡在哪里

现在不是单一 blocker，而是两个独立状态：

## 4.1 Operational Activation 尚未 effective

当前：

```text
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false
```

要变成 true，必须在 protected main 上完成真实 KBS/GFS actual-UTC qualification：

- KBS Raw Hourly freshness `<=6h`；
- exact source identity；
- same-cycle GFS；
- private retention before decode；
- five-family canonicalization；
- isolated qualification PostgreSQL；
- DB-only Runtime；
- actual `T+07:17` observer；
- A1 / COMPLETED / 72；
- all Formal side-effect counters = 0；
- 然后另做 exact-head activation evidence freeze。

禁止通过以下方式“让它过”：

- 放宽 6h；
- 把 7h 改成更大值；
- 修改 KBS timestamp；
- 用旧小时冒充目标小时；
- 换 provider；
- 用 model ET / rPET 冒充 frozen Historical ET0；
- cross-cycle GFS；
- accelerated clock。

### KBS 历史经验

本轮 KBS Raw Hourly 曾持续 stale 超过 13h，且官方没有我们可以依赖的发布 SLA。

因此：

```text
KBS stale != implementation defect
KBS stale = activation fail-closed
```

不要再因为 provider stale 把已经 qualified 的 implementation 留在 feature branch。

## 4.2 当前 season 已无合法 successor 24h epoch

这是当前 **Formal 规划主线** 的真正 blocker。

#3045 已机器证明：

```text
NO_CURRENT_SEASON_SUCCESSOR_EPOCH
```

原因不是 KBS，而是时间顺序与 crop-context authority：

- latest complete current-season O00 = `2026-08-11T22:00Z`；
- 为满足 36h minimum lead，selection authority最晚必须在 `2026-08-10T10:00Z` effective；
- A08 自己直到 `2026-08-11T02:33:13Z` 才 effective；
- A08 又要求 successor selection 必须发生在 operational activation effectiveness之后；
- 因此 current-season successor lifecycle已经在时间上不可能成立。

不能通过以下方式修：

- 人工延长 MID；
- fabricated LATE；
- 缩短 Formal window；
- rescue旧 A06A epoch；
- initial multi-slot catch-up；
- future observation rewrite；
- 把 selection timestamp倒签。

---

# 5. 当前 Formal DB / raw-store 状态应如何理解

Formal Neon：

```text
project:
delicate-glade-62464340

branch:
br-cold-dust-a6j6aymz (main / primary / default)

database:
geox_mcft_cap09_s6_formal_24h
```

Simulation branch仍然不是 Formal authority：

```text
br-falling-cake-a6lfsdak
```

最后一次 live pre-window authority建立的是：

```text
facts = 60
Runtime Configs = 49
  1 A0
  24 first expired epoch
  24 second expired/rebased epoch
State = 1 anchored to A0
scheduler slots = 0
scheduler cursors = 0
Formal execution = 0/24
```

#3038–#3045 所有后续 merged slices 都明确不授权新的 Formal DB/R2/scheduler/canonical Runtime writes，所以不存在“后面偷偷开始了 Formal window”的 authority。

但是下一次需要 live DB inventory 时，**不要把 60/49 永久硬编码成新 global authority**。先重新做 READ ONLY inspection。

Formal raw store仍然是 private S3-compatible / Cloudflare R2 responsibility layer；不要把 raw evidence 放进 public GitHub artifact。

---

# 6. 下一步计划

## Primary：S6 crop-context / season architecture adjudication

下一对话的第一正式设计任务应当是：

```text
S6-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-UNDER-AMENDMENT-08
```

目标不是立即选新 O00，而是先裁决：

1. 在 current frozen crop authority 已无完整 24h conservative window 的事实下，MCFT-CAP-09 如何合法获得下一套 crop/season authority；
2. 是进入新的自然 season / crop context，还是存在可以被独立、真实、as-of 证据支持的新阶段 authority；
3. 新 authority 允许消费哪些事实，禁止消费哪些 future observations；
4. 新 authority 如何保持 FAO variant / planting uncertainty / transition guard 的 conservative semantics；
5. 新 authority effective 后，如何重新运行 whole-window scan，并且只有 scan PASS 才允许 successor epoch selection。

**不得先选 epoch 再反推 crop authority。**

建议先写 architecture adjudication / amendment candidate，不先写 Runtime code。

## Parallel：继续 Operational Activation Qualification

KBS 恢复到 `<=6h` 时，可以独立继续 main-only live activation runner。

如果 live PASS：

```text
live run PASS
→ collect exact protected-main SHA + run/artifact/digest + KBS timestamp/age + T/phase times + GFS cycle + private-retention hashes + isolated DB evidence hashes + T+07:17 observer result + zero-side-effect counters
→ separate exact-head activation evidence freeze
→ only after freeze: EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED=true
```

即便 operational activation PASS，也 **不能** 绕过 crop/season adjudication直接选 current-season epoch。

## New crop/season authority + activation 都满足之后

后续顺序必须重新建立：

```text
1. new crop/season authority effective
2. whole-window viability scan PASS
3. successor epoch-selection authority
4. successor 24-config builder qualification
5. append-only successor config persistence
6. successor Formal DB preflight + new immutable Window Input Manifest
7. External Formal V3 runner exact-binding qualification
8. EA5E3 Formal Authority V3 effective by O00-12h
9. actual UTC O00 ... O23
10. final exact-SHA / R2 effectiveness
```

#3043 已经准备了 V3 persistent tick core，但它不能替代 1–8 的 authority 链。

---

# 7. 踩过的坑，下一对话必须避开

## 7.1 先实现、再重读 authority，导致 scope 不断扩张

#3035 初期最大的工作方式问题：

```text
先实现
→ 再重新解释 Amendment-07 §9
→ 再发现 provider-specific real GET/retention/ingress path漏项
→ 再扩 PR
```

以后强制使用：

```text
Authority docs
→ Acceptance Matrix
→ Implementation Checklist
→ deterministic implementation
→ full offline acceptance
→ FREEZE SHA
→ live qualification
```

## 7.2 exact-head live proof 与高频 commit 天然冲突

一旦进入 live qualification：

- 冻结 exact SHA；
- 不做顺手重构；
- 不因为“等数据看起来没进展”继续塞代码；
- 任何代码变更都会让旧 live artifact失去 exact-head authority。

## 7.3 Provider outage 不能再等同于 implementation failure

A08 已经裁决：

```text
Implementation Qualification
!= Operational Activation Qualification
```

不要回退到 pre-A08 逻辑。

## 7.4 KBS freshness 不能为了推进临时放宽

冻结：

```text
KBS <= 6h
7h scheduler eligibility
T+07:12 cutoff
T+07:17 observer
```

曾出现 KBS >13h stale；这说明 source operational reliability有风险，不说明可以改 threshold。

## 7.5 public Actions artifact 不能携带 value-bearing raw/canonical evidence

曾经设计过跨 job 上传 `pg_dump`；这违反 EA2A public artifact boundary。

正确模式：

- private transient R2 carrier；
- public artifact只保留 hash / ref / timing / count / metadata；
- live proof后清理 transient objects；
- Formal raw prefix与qualification transient prefix严格隔离。

## 7.6 Authority 改变后不要继续硬修旧 PR base

#3035 在 A08 merge 后仍保留 pre-A08 PR base snapshot，导致 GitHub把 A08三文件重新算进 changed-file set并触发错误 lifecycle Gate。

正确处理：

- 保留旧 PR为历史；
- fresh PR against current protected main；
- 不 force-rewrite历史；
- 不通过改 Gate绕 branch ruleset。

#3039 就是正确 replacement。

## 7.7 Operational Activation 只能在 protected main 上做

feature-branch live proof只能是 implementation/readiness证据，不能成为 Operational Activation effectiveness。

main-only workflow必须绑定 critical activation blobs；critical blob改变后，旧 main SHA live proof不能继续作为新实现 authority。

## 7.8 live PASS 仍不等于 activation effective

需要：

```text
live workflow PASS
→ separate exact-head activation evidence freeze merge
→ activation effective
```

不要跳过 evidence freeze。

## 7.9 旧 Formal runner / V2 runner / Replay helper 不可用于 External V3

不要复用：

- static canonical-input secret；
- legacy Stage-1B runner；
- V2→legacy delegation；
- Replay crop fixture；
- C8 soil-hydraulic identity。

#3043 V3 core是正确 future execution core。

## 7.10 旧 A06 epoch资产只是历史，不是 successor template authority

特别是：

- A06B builder硬编码旧 epoch + MID；
- EA5E1 preflight硬编码 60/49 inventory；
- A06C result只证明旧 chain；
- old Window Manifest只证明旧 chain。

未来 successor必须 separate qualify。

## 7.11 不要 rescue expired epoch

禁止：

- shift旧 O00/O23；
- retroactive initial execution；
- initial multi-slot catch-up；
- backdate selection；
- relabel config logical time。

## 7.12 crop-stage authority不能因为窗口消失而“延长”

#3045 已证明 current frozen authority下没有未来合法 24h successor。

下一步只能 architecture adjudication；不能把 MID延长一天，也不能虚构 LATE。

## 7.13 exact-boundary Gate不要写脆弱 prose ABI / self-referential deny-list

本轮 Gate 曾因为：

- 把长 prose句子当 ABI；
- stale predecessor blob pin；
- 自己的 deny-list匹配到 Gate自身文本；

产生过假失败。

后续 Gate应优先：

- exact structured JSON fields；
- exact blob identities；
- semantic tokens / machine structure；
- 避免依赖自然语言整句；
- 避免 self-referential text deny-list。

---

# 8. 下一对话接手时的第一轮检查

不要直接开始写代码。先做以下只读对齐：

```text
1. git / GitHub protected main identity
2. 确认 main >= e220baa72415d8d95580a153e2a0acba7f9b7cad
3. 读取 Taskbook v0.5 + Amendment-05/06/07/08
4. 读取 #3042 post-activation readiness audit authority
5. 读取 #3043 External Formal V3 persistent tick qualification
6. 读取 #3045 successor whole-window viability scanner authority
7. 确认 EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED 仍未被新的 evidence-freeze authority改变
8. 确认没有新的 crop/season architecture amendment已进入 main
9. 如要推进 activation，再查 KBS live freshness；不要用旧 8/10 probe当当前 source状态
10. 如要推进 Formal planning，先做 crop-context / season architecture adjudication，不先选 epoch
```

如果 repository facts在本 handoff之后已经前进，则以新 protected main为准。

---

# 9. 当前一句话状态

```text
MCFT-CAP-09 的 External fixed-lag implementation、protected-main activation runner、post-activation readiness audit、External Formal V3 persistent tick core 和 successor whole-window scanner均已进入 main；Operational Activation 尚未 effective，Formal execution仍为0/24；#3045 已机器证明现有冻结 crop authority 下 NO_CURRENT_SEASON_SUCCESSOR_EPOCH，因此当前 Formal 规划主线必须进入 crop-context / season architecture adjudication，KBS recovery只作为独立 operational activation gate继续推进，不能再 rescue current-season epoch。
```
