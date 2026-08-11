# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-11

更新时间：2026-08-11 22:35（UTC+8）

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

本 handoff 只用于恢复工程上下文，不制造 effectiveness、activation、crop/season authority、stage authority、epoch 或 Formal write authority。

必须按以下顺序认定事实：

```text
1. 当前 Taskbook + protected-main effective Amendments + Delivery Policy
2. protected main repository fact
3. exact PR head / workflow run / immutable artifact / live read-only proof
4. 本 handoff
```

如果本 handoff 与 protected main 冲突，以 protected main 为准。

准确 repository base：

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

Formal 24h 尚未开始。进入新 Formal epoch 前至少还必须同时成立：

```text
A. 合法 crop / season / four-stage authority + successor epoch
B. EA5E2 operational activation effectiveness
C. EA5E3 Formal Authority V3 effectiveness
```

当前 A、B 均未成立，所以：

```text
Formal = 0/24
```

---

## 2. Amendment-08：implementation 与 operational activation 必须分开

Amendment-08 已冻结：

```text
IMPLEMENTATION_QUALIFIED != OPERATIONAL_ACTIVATION_QUALIFIED
```

当前：

```text
ea5e2_implementation_qualified = true
ea5e2_operational_activation_qualified = false
```

EA5E2 runner / fixed-lag implementation 已通过 repository-controlled qualification，不得因为 operational activation 尚未发生而写回未完成。

---

## 3. Crop / season / stage authority 主线

### PR #3047 — Amendment-09

Merge main：

```text
c5a0110e1cff3fd91d3a205315b73d16ac7d6bd7
```

裁决：

```text
Branch A = current-season contemporaneous phenology reproof
Branch B = new natural season fallback
```

Current-season 允许的 authority 角色：exact direct stage、qualified exact-spatial image phenology、或在 exact hybrid/material + governed thermal authority 下成立的 GDD。Management operations 不能单独确定 stage。

禁止 future observations、full-season hindsight normalization、invented LATE、cross-season stitching。

### PR #3048 — exact current-season hybrid

Merge main：

```text
565e2a59cfd34b18185998744b8380c1101ea45b
```

KBS Aglog planting #6931：

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

### PR #3049 — thermal threshold authority

Merge main：

```text
87eab32bfade35f2d2e9ab945031a61288e20adf
```

结论：Pioneer Base-50 method semantics qualified，但 exact P0306Q GDU-to-silk / GDU-to-physiological-maturity authority 均未建立。

禁止：

```text
RM -> GDU conversion
related-product point threshold transfer
```

### PR #3050 — EA9B natural season adjudication

Merge main：

```text
f54fd1c235898041aff50ac342d3ee6ad5a87b00
```

Live KBS Aglog：

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

这是 time-gated snapshot，不是 global absence claim。

Primary frontier：

```text
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION
```

Trigger：

```text
A_NEW_KBS_AGLOG_T1_OR_T1R1_PLANTING_OBSERVATION_WITH_OBSERVATION_DATE_AFTER_2026_05_11_BECOMES_PUBLICLY_RETRIEVABLE
```

不得根据 rotation 推断下一季 crop，不得仅因进入未来年份就创建 season，不得自动 rollover，不得 cross-season stitch。

---

## 4. Amendment-10 bounded thermal salvage：#3051–#3054

### PR #3051

Merge main：

```text
9e9f358bc57799c7ec1a29d177076b7256bf163f
```

新 P0306 related evidence 足以进入 bounded-policy review，但不足以把 secondary point values 变成 P0306Q truth。

### PR #3052 — Amendment-10

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

### PR #3053 — partial thermal landmark → four-stage mapping

Merge main：

```text
b39fe14b491d9155b8c12ba73763a9cc8e6d8428
```

安全映射：

```text
R1 / silking point is within MID
R6 / physiological maturity is within LATE-safe territory
post-silking and pre-R6 interval remains {MID, LATE}
```

因此禁止完整 continuous GDD→four-stage curve、禁止把 silking 直接当 MID/LATE boundary、禁止把 physiological maturity 当 LATE-start boundary。

唯一 deterministic positive thermal implication：

```text
conservative accumulated Base-50 GDD lower bound >= 2608
```

并要求 backward-6h stability 与 harvest/termination guard。

### PR #3054 — final bounded P0306Q Base-50 GDD qualification

Exact head：

```text
80e30cca53072949aec6be2845dac004de053e9e
```

Merge main：

```text
1d72c9d49050c01544d21f8cb1791245d8eb31d3
```

Focused run / artifact：

```text
run = 31501053847
artifact = 9105035816
artifact digest = sha256:4f623fa25124a399288b2ad847d34d6d6bb72279a773de8caab0049ff21ed287
```

KBS 561 source：

```text
KBS002-014.142
Campbell 107 probe at 3m
direct daily maximum / minimum air temperature
```

Live export 格式：

```text
metadata preamble + CSV table
header zero-based row index = 21
```

Governed parser 只在前 64 行寻找唯一包含 exact columns 的 header：

```text
date
air_temp_107_max
air_temp_107_min
```

Duplicate date policy：identical extrema 可 deduplicate；conflicting extrema 整日降级为 uncertain `[0,36] GDU`，不得选其中一行。

2026 current-season live result：

```text
latest valid daily extrema date = 2026-08-10
planting date = 2026-05-11
complete local days = 92
valid exact days = 89
missing / invalid / uncertain days = 3

conservative accumulated Base-50 GDD:
lower = 1714.626
upper = 1828.917

bounded LATE minimum = 2608
maximum accumulated GDD < 2608 = true
```

因此 harvest guard 不触发。

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

Amendment-10 bounded-GDD current-season salvage 已 terminal。不得继续叠加 related-product / RM / point-threshold 假设绕过 #3054；重开必须来自新的独立 qualifying authority 或新的正式 Amendment。

---

## 5. 当前唯一正确 primary frontier

```text
S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION
```

当前没有可合法创建的新 natural season，也没有可合法选择的 successor Formal epoch。

只有出现新的公开 KBS Aglog T1/T1R1 post-2026-05-11 planting authority candidate 才重跑 EA9B。

新 candidate 出现后仍必须 fresh 建立：

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

## 6. 当前唯一立即可推进的 parallel frontier：EA5E2 operational activation

```text
S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08
```

这里必须区分 workflow **文件路径** 与 GitHub Actions **显示名称**：

```text
workflow file:
.github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml

workflow UI name:
mcft-cap-09-ea5e2-operational-activation-live
```

Runner qualification authority：

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-RUNNER-QUALIFICATION-V1.json
```

它明确冻结：

```text
live_workflow_path = .github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml
protected-main live run authorized = true
workflow_dispatch retry on same exact main SHA allowed = true
runner merge does not make operational activation effective
```

该 workflow 同时支持 `workflow_dispatch`，无 inputs；不得通过修改 critical activation boundary 来制造 push 触发。

在 GitHub Actions 中应选择显示名称：

```text
mcft-cap-09-ea5e2-operational-activation-live
```

并在 protected `main` 上 Run workflow。

Required private bindings 由 workflow 读取：

```text
GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT
GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET
GEOX_MCFT_CAP09_FORMAL_RAW_S3_REGION
GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID
GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY
GEOX_MCFT_CAP09_S6_DATABASE_URL
```

不得输出 secret values。

Activation workflow 必须证明：

- subject 是 protected main；
- critical activation boundary 未漂移；
- private R2 / Formal DB bindings 存在；
- transient R2 round-trip + cleanup；
- KBS Raw Hourly `<=6h` freshness；
- 一个与 Formal epoch 无关的真实未来 exact UTC target T；
- pre-boundary real-provider phase；
- metadata-only interphase proof；
- real wall-clock delayed phases；
- exact same-cycle GFS；
- no source substitution / time relabel / cross-cycle substitution / accelerated clock；
- qualification 期间 Formal DB/raw-prefix/scheduler/canonical writes 均为 0。

如果 provider freshness 不满足，应 fail closed。

即使 live workflow PASS，也只是 candidate evidence。下一合法 successor：

```text
S6-EA5E2-OPERATIONAL-ACTIVATION-EVIDENCE-FREEZE-UNDER-AMENDMENT-08
```

只有单独 exact-head evidence/effectiveness PR 合并后，才能把：

```text
ea5e2_operational_activation_qualified = true
```

---

## 7. Formal 24h 仍未开始

必须保持：

```text
successor_epoch_selected = false
ea5e3_effective = false
Formal O00–O23 started = false
Formal execution = 0/24
MCFT-CAP-09 complete = false
```

不得 rescue/shift/relabel 旧 A06A epoch，不得通过 backfill 把缺失小时包装成 Formal，不得在没有新 crop/season authority 时选 epoch，也不得把 implementation qualification 写成 operational activation effectiveness。

---

## 8. 下一对话接手顺序

```text
1. protected main 是否仍 >= 1d72c9d49050c01544d21f8cb1791245d8eb31d3
2. 本 handoff 是否已 merge
3. 是否有新的 KBS Aglog T1/T1R1 post-2026-05-11 planting candidate
4. GitHub Actions / mcft-cap-09-ea5e2-operational-activation-live 是否已 workflow_dispatch
5. 若已 dispatch，读取 exact run / jobs / immutable artifacts；不得只看 workflow 颜色
6. activation PASS 后，先冻结 evidence/effectiveness，再改变 operational activation 状态
7. 只有 crop/season authority + activation effectiveness 都满足后，才进入 successor epoch / EA5E3 / Formal 24h
```

---

## 9. 不得误读的历史状态

- PR #3035 pre-Amendment-08 EA5E2 已 supersede；
- PR #3040 duplicate EA5E2 已关闭；
- PR #3044 early successor scanner 已 supersede；
- 旧 A06A epoch `2026-08-11T17:00Z .. 2026-08-12T16:00Z` 不可 rescue；
- #3051 `SUPPORTED` 只是 bounded-policy review 入口，不是 stage authority；
- #3052 intervals 不是 exact P0306Q thresholds；
- #3053 partial mapping 不是完整 GDD→four-stage model；
- #3054 是 current-season bounded-GDD 最终 negative terminal；
- 旧 handoff 的 `S6-CROP-CONTEXT-SEASON-ARCHITECTURE-ADJUDICATION-UNDER-AMENDMENT-08` 已被 Amendment-09 / EA9A / EA9B 后续 adjudication supersede；
- `.github/workflows/mcft-cap-09-ea5e2-operational-activation-live.yml` 不是当前仓库文件路径；它是对 UI name 的错误路径化。正确 workflow file 是 `.github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml`。

---

## 10. 一句话恢复状态

```text
MCFT-CAP-09 Formal 仍为 0/24；2026 current-season direct-stage、exact-threshold 和 Amendment-10 bounded-GDD salvage 均已走完且未建立 four-stage authority，EA9B 尚未观察到 post-2026-05-11 新 T1/T1R1 planting candidate，所以 primary frontier time-gated 在 S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION；唯一立即可执行的 parallel frontier 是对 protected main workflow_dispatch GitHub Actions workflow `mcft-cap-09-ea5e2-operational-activation-live`，其实际文件为 `.github/workflows/mcft-cap-09-ea5e2-live-provider-two-phase-readiness.yml`，且在后续 activation evidence/effectiveness 合并前 operational activation 必须保持 false。
```
