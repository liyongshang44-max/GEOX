# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-11

更新时间：2026-08-11 22:30（UTC+8）

```text
repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
1d72c9d49050c01544d21f8cb1791245d8eb31d3

protected_main_merge:
PR #3054 — MCFT-CAP-09 EA9A: qualify bounded P0306Q Base-50 GDD stage

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

current_taskbook_version:
Complete Taskbook v0.5 — Stage 1B Design Freeze / S6 Amendment-01 + Amendment-02 + Amendment-03 + Amendment-04 Bound

additional_effective_overlays:
Amendment-05 — External Formal Runtime Authority Profile
Amendment-06 — Formal Window Epoch Rebase Authority
Amendment-07 — Fixed-lag External Formal Causality
Amendment-08 — Implementation / Operational Activation Qualification Separation Authority
Amendment-09 — Crop Context / Season Architecture Adjudication Authority
Amendment-10 — P0306 Bounded Thermal Proxy Authority

current_primary_frontier:
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION

primary_requalification_trigger:
A_NEW_KBS_AGLOG_T1_OR_T1R1_PLANTING_OBSERVATION_WITH_OBSERVATION_DATE_AFTER_2026_05_11_BECOMES_PUBLICLY_RETRIEVABLE

parallel_operational_frontier:
S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08

ea5e2_implementation_qualified:
true

ea5e2_operational_activation_qualified:
false

current_season_stage_authority_established:
false

current_season_recovery_reopened:
false

current_season_successor_epoch_available:
false

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

## 0. 权威顺序

本 handoff 只用于恢复工程上下文，不制造 effectiveness、activation、crop/season authority、stage authority、epoch 或 Formal write authority。

必须按以下顺序认定事实：

```text
1. 当前 Taskbook + protected-main effective Amendments + Delivery Policy
2. protected main repository fact
3. exact PR head / workflow run / immutable artifact / live read-only proof
4. 本 handoff
```

如果本 handoff 与 protected main 冲突，以 protected main 为准。

本 handoff 的准确 repository base：

```text
main@1d72c9d49050c01544d21f8cb1791245d8eb31d3
```

---

## 1. 当前任务定位

仍然是：

```text
MCFT-CAP-09 — Shadow-Online Promotion
目标：STAGE_1B_SHADOW_ONLINE_CLOSURE
当前大阶段：S6 Formal 24-hour closure
```

Formal 24h 尚未开始。当前不是 O00–O23 execution 阶段。

在进入新 Formal epoch 之前，至少还必须同时成立：

```text
A. 一个合法的 crop / season / four-stage authority + successor epoch
B. EA5E2 operational activation effectiveness
C. EA5E3 Formal Authority V3 effectiveness
```

当前 A 与 B 都尚未成立，所以：

```text
Formal = 0/24
```

---

## 2. Amendment-08 后的两条独立线

Amendment-08 已冻结：

```text
IMPLEMENTATION_QUALIFIED
!=
OPERATIONAL_ACTIVATION_QUALIFIED
```

### 2.1 EA5E2 implementation

已 qualified。

EA5E2 runner / fixed-lag implementation 已通过 repository-controlled qualification；不得因为 operational activation 尚未发生而把 implementation 重新写成未完成。

### 2.2 EA5E2 operational activation

仍未 qualified：

```text
ea5e2_operational_activation_qualified = false
```

当前可执行 workflow：

```text
.github/workflows/mcft-cap-09-ea5e2-operational-activation-live.yml
workflow name:
mcft-cap-09-ea5e2-operational-activation-live
```

它要求真实 provider / R2 / Formal DB 环境并走真实 wall-clock fixed-lag phases。

不得通过修改 critical activation workflow 来伪造 push 触发；应使用 `workflow_dispatch` 在 protected `main` 上执行。成功 run 也不能直接把 operational activation 标为 true，仍需按 Amendment-08 冻结并合并 activation evidence/effectiveness。

---

## 3. Crop / season / stage authority：从 Amendment-09 到最终 bounded-GDD terminal

### 3.1 PR #3047 — Amendment-09

Merge main：

```text
c5a0110e1cff3fd91d3a205315b73d16ac7d6bd7
```

裁决：

```text
Branch A = current-season contemporaneous phenology reproof
Branch B = new natural season fallback
```

Current-season 允许的 stage authority 角色包括：

- exact direct provider stage；
- qualified exact-spatial image phenology；
- GDD，但只有 exact hybrid/material + governed thermal method/threshold authority 同时成立时；
- management operations 只能辅助，不能单独确定 stage。

禁止：

- future observations；
- full-season hindsight normalization；
- invented LATE；
- cross-season stitching。

Branch B 如成立，必须创建新的 immutable season_id，并重新建立真实 crop/planting/emergence authority、field/source binding 与 bootstrap；不得自动 rollover。

### 3.2 PR #3048 — exact current-season hybrid qualification

Merge main：

```text
565e2a59cfd34b18185998744b8380c1101ea45b
```

KBS Aglog planting observation #6931 建立：

```text
season = season_2026_corn
planting date = 2026-05-11
hybrid = P0306Q
RM = 103
```

但：

```text
direct stage authority = false
hybrid identity != stage authority
RM alone != thermal threshold authority
```

因此进入 Hybrid/GDD 最终 current-season salvage。

### 3.3 PR #3049 — P0306Q thermal threshold authority

Merge main：

```text
87eab32bfade35f2d2e9ab945031a61288e20adf
```

结论：

```text
Pioneer Base-50 thermal method semantics = qualified
exact P0306Q GDU-to-silk threshold authority = false
exact P0306Q GDU-to-physiological-maturity threshold authority = false
```

明确禁止：

```text
RM -> GDU conversion
related-product point threshold transfer
```

原始 EA9A 在 exact-threshold 路径下 terminal。

### 3.4 PR #3050 — EA9B new natural season adjudication

Merge main：

```text
f54fd1c235898041aff50ac342d3ee6ad5a87b00
```

Live KBS Aglog snapshot：

```text
pages scanned = 6
rows scanned = 180
scan reached 2026-05-11 anchor or earlier = true
post-anchor T1 planting candidates = 0
```

裁决：

```text
NO_NEW_NATURAL_SEASON_CANDIDATE_EVIDENCE_CURRENTLY_OBSERVED
```

这只是 time-gated snapshot，不是 global absence claim。

因此 primary frontier 被定义为：

```text
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION
```

触发条件：

```text
A_NEW_KBS_AGLOG_T1_OR_T1R1_PLANTING_OBSERVATION_WITH_OBSERVATION_DATE_AFTER_2026_05_11_BECOMES_PUBLICLY_RETRIEVABLE
```

严禁：

- 根据 rotation 推断下一季 crop；
- 仅因为日历进入未来年份就创建 season；
- 复用旧 season authority 自动 rollover；
- cross-season stitching。

---

## 4. Bounded thermal salvage：#3051–#3054

这一组 PR 只是在 Amendment-09 约束下，验证“related P0306 evidence 是否足够支持一个保守 bounded proxy”。它没有恢复 exact P0306Q point threshold authority。

### 4.1 PR #3051 — thermal equivalence evidence adjudication

Merge main：

```text
9e9f358bc57799c7ec1a29d177076b7256bf163f
```

裁决：新证据足以支持进入 bounded-policy review，但不足以把 secondary `1330 / 2500` 直接升级成 P0306Q truth。

### 4.2 PR #3052 — Amendment-10

Merge main：

```text
23304a08fe37ee35258654a2520aa293ce328b2b
```

冻结：

```text
epistemic_class = ASSUMED_BOUNDED_PROXY
silk interval = [1222, 1438] GDU
physiological maturity interval = [2392, 2608] GDU
```

仍然：

```text
exact_p0306q_product_specific_threshold_authority_established = false
related_product_point_threshold_transfer_authorized = false
```

Amendment-10 只授权 bounded qualification，不授权 stage 结论。

### 4.3 PR #3053 — thermal landmark → water-use-stage partial mapping

Merge main：

```text
b39fe14b491d9155b8c12ba73763a9cc8e6d8428
```

冻结的安全映射不是一条完整 GDD→四阶段曲线：

```text
R1 / silking point is within MID
R6 / physiological maturity is within LATE-safe territory
post-silking and pre-R6 interval remains {MID, LATE}
```

因此：

```text
full_continuous_gdd_to_four_stage_mapping = forbidden
silking threshold as MID/LATE boundary = forbidden
physiological maturity threshold as MID/LATE-start boundary = forbidden
```

唯一允许的 deterministic positive thermal implication：

```text
conservative accumulated Base-50 GDD lower bound >= 2608
```

并且还必须满足 backward-6h stability 与 harvest/termination guard。

### 4.4 PR #3054 — final bounded P0306Q Base-50 GDD qualification

Exact head：

```text
80e30cca53072949aec6be2845dac004de053e9e
```

Merge main：

```text
1d72c9d49050c01544d21f8cb1791245d8eb31d3
```

Focused run：

```text
31501053847
```

Artifact：

```text
9105035816
sha256:4f623fa25124a399288b2ad847d34d6d6bb72279a773de8caab0049ff21ed287
```

#### KBS 561 source qualification

Source：

```text
KBS002-014.142
Campbell 107 probe at 3m
direct daily maximum / minimum air temperature
```

Live export 不是 header-first CSV，而是：

```text
metadata preamble + CSV table
```

Governed parser 只允许：

```text
search first 64 rows
find exactly one header containing exact columns:
date
air_temp_107_max
air_temp_107_min
```

Live header：

```text
zero-based row index = 21
```

Duplicate date 处理：

```text
identical extrema -> deduplicate
conflicting extrema -> entire day becomes uncertain [0,36] GDU
never select one conflicting row
```

#### Final 2026 current-season bounded GDD result

Authority snapshot：

```text
latest valid daily extrema date = 2026-08-10
planting date = 2026-05-11
complete local days = 92
valid exact days = 89
missing / invalid / uncertain days = 3
```

Conservative accumulated Base-50 GDD：

```text
lower = 1714.626
upper = 1828.917
bounded LATE minimum = 2608
```

关键事实：

```text
maximum accumulated GDD < 2608 = true
```

所以甚至最乐观的保守上界也未达到允许的 deterministic LATE threshold；harvest guard 不需要执行。

Final adjudication：

```text
CURRENT_SEASON_FOUR_STAGE_AUTHORITY_NOT_ESTABLISHED_UNDER_BOUNDED_GDD_PROXY
```

Negative reason：

```text
CONSERVATIVE_ACCUMULATED_GDD_LOWER_BOUND_BELOW_2608
```

Authority effect：

```text
current_season_stage_authority_established = false
current_season_2026_recovery_reopened = false
new_natural_season_created = false
successor_epoch_selected = false
all write counts = 0
Formal = 0/24
```

这条 Amendment-10 bounded-GDD current-season salvage 已 terminal。不得继续添加新的 related-product / RM / point-threshold 假设来绕过 #3054；若要重开必须有新的独立 qualifying authority 或新的正式 Amendment。

---

## 5. 当前唯一正确 primary frontier

现在 primary crop/season line 是真实的外部时间门：

```text
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION
```

当前没有可合法创建的新 natural season，也没有可合法选择的 successor Formal epoch。

下一次只有在以下条件出现时才重跑 EA9B：

```text
KBS Aglog 出现 observation_date > 2026-05-11
且 area 属于 T1 / T1R1 范围
且 observation 类型为新的 planting authority candidate
且公开可机器检索
```

新 candidate 出现后仍必须重新做：

```text
new immutable season_id
actual crop authority
actual planting/emergence authority
fresh field/source binding
fresh bootstrap
fresh whole-window viability scan
```

不能把 `season_2026_corn` 自动搬到下一季。

---

## 6. 当前唯一立即可推进的 parallel frontier

Primary line 目前被现实时间门阻塞，所以 repository 内当前唯一立即可执行的实质线是：

```text
S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08
```

workflow：

```text
mcft-cap-09-ea5e2-operational-activation-live
```

需要在 GitHub Actions 对 protected `main` 使用 `workflow_dispatch`。

Activation run 必须证明：

- exact protected-main subject；
- critical activation boundary unchanged；
- required R2 / Neon secrets present；
- private transient R2 smoke + cleanup；
- KBS raw-hourly freshness；
- 真实 future T；
- pre-boundary provider phase；
- metadata-only interphase proof；
- real wall-clock delayed exact-hour phases；
- zero Formal writes during qualification。

如果 provider freshness 不满足，应 fail closed，不得替换来源、重标时间或伪造 observation。

成功 workflow run 之后还需要新的 evidence-freeze/effectiveness PR；只有那一层合并后，才能把：

```text
ea5e2_operational_activation_qualified = true
```

---

## 7. Formal 24h 仍未开始

当前必须保持：

```text
successor_epoch_selected = false
ea5e3_effective = false
Formal O00–O23 started = false
Formal execution = 0/24
MCFT-CAP-09 complete = false
```

不得：

- rescue 旧 A06A epoch；
- shift/relabel 旧 24h window；
- 对缺失小时 backfill 后声称 Formal 完成；
- 在没有新 crop/season authority 时选择 epoch；
- 因 EA5E2 implementation qualified 就声称 operational activation effective。

---

## 8. 下一对话接手时必须先确认的事实

按顺序确认：

```text
1. protected main 是否仍 >= 1d72c9d49050c01544d21f8cb1791245d8eb31d3
2. 本 handoff 是否已 merge 到 protected main
3. 是否有新的 KBS Aglog T1/T1R1 post-2026-05-11 planting candidate
4. EA5E2 operational activation workflow 是否已被人工 dispatch
5. 若已 dispatch，读取 exact run / job / artifact；不得只看 workflow 颜色
6. 若 activation PASS，冻结 evidence/effectiveness；若未 PASS，保持 false
7. 只有 crop/season authority + activation effectiveness 都满足后，才重新进入 successor epoch / EA5E3 / Formal 24h
```

---

## 9. 不得误读的历史状态

以下都不能被当成当前 frontier：

- PR #3035 pre-Amendment-08 EA5E2；
- PR #3040 duplicate EA5E2；
- PR #3044 early successor scanner；
- 旧 A06A epoch `2026-08-11T17:00Z .. 2026-08-12T16:00Z`；
- #3049 的 exact-threshold terminal 不能单独覆盖 Amendment-10 后的 bounded adjudication；
- #3051 的 `SUPPORTED` 只表示允许进入 bounded-policy review，不是 stage authority；
- #3052 的 bounded intervals 不是 exact P0306Q thresholds；
- #3053 的 partial mapping 不是完整 GDD→四阶段模型；
- #3054 是 current-season bounded-GDD 最终裁决，结果为 negative terminal；
- 旧 handoff 中 `S6-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-UNDER-AMENDMENT-08` 已被 Amendment-09/EA9A/EA9B 后续 adjudication supersede。

---

## 10. 一句话恢复状态

```text
MCFT-CAP-09 Formal 仍为 0/24；2026 current-season direct-stage、exact-threshold 和 Amendment-10 bounded-GDD salvage 均已在 protected main 上走完且未建立 four-stage authority，EA9B 也尚未观察到 post-2026-05-11 的新 T1/T1R1 planting candidate，因此 primary frontier 真实地 time-gated 在 S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION；唯一立即可执行的 parallel frontier 是 EA5E2 operational activation workflow_dispatch，且在 activation evidence/effectiveness 合并前 operational activation 必须保持 false。
```
