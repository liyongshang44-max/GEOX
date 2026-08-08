# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-08

更新时间：2026-08-08 23:08（UTC+8）

```text
repository:
liyongshang44-max/GEOX

protected_main_at_handoff:
99b45720fbe9130acecc790136c5046966387597

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md

current_taskbook_version:
Complete Taskbook v0.3 — Stage 1B Design Freeze / S6 Amendment-01 + Amendment-02 Bound

current_frontier:
MCFT-CAP-09.S6 / S6-EA1O

next_legal_sub_lifecycle:
EA1O_B_LIVE_SFLUX_SOURCE_AND_SPATIAL_QUALIFICATION

formal_window_started:
false

mcft_cap09_complete:
false

handoff_authority_class:
CONTINUATION_CONTEXT_ONLY

candidate_declaration:
NONE
```

---

## 0. 这份 handoff 的定位与接手规则

本文用于下一对话继续推进 `MCFT-CAP-09 — Shadow-Online Promotion` 的最后一个 capability slice：`S6 Formal 24-hour closure`。

本次对话开始时，用户要求重新检查并理解四方：

```text
1. 总任务书 / Stage 1B 目标
2. MCFT-CAP-09 Taskbook / 任务线
3. protected main 仓库事实
4. handoff
```

并明确指出旧 handoff 可能落后，同时给出一版新的 S6 External Public Evidence Authority 设计。

本轮不是简单继续跑旧 Formal workflow，而是先证明旧 S6 Formal authority 本身存在设计缺陷，再通过 S6-only Architecture Amendment 修正，并沿着 External Site / Source / Crop / Forecast authority 逐项 fail-closed qualification。

### 0.1 权威优先级

下一位接手者必须继续使用以下顺序：

```text
1. Master / Stage design / MCFT-CAP-09 Taskbook / Delivery Policy
2. protected main 上的 Registry / authority / status / workflow / acceptance
3. 当前 PR / run / artifact / commit 的实时 GitHub 事实
4. handoff
```

handoff 只用于恢复上下文。它不能覆盖 protected main，也不能把 Candidate snapshot 自动升级成 effective authority。

尤其注意：仓库很多 `*-STATUS-V1.json` 是“Candidate 创建时快照”，即使后来对应文件已经进入 protected main，status 内仍可能保留：

```text
record_status = CANDIDATE_NOT_EFFECTIVE
```

这不是当前 main 事实的否定。是否 effective 必须结合：

```text
protected-main presence
+ Taskbook binding
+ current Delivery Policy
+ exact-SHA / focused proof where required
```

### 0.2 旧 handoff #2943

旧 PR：

```text
#2943
docs(mcft-cap09): refresh S5 continuation handoff
```

它基于：

```text
main = 9a7e61bc306161c256a43469ab37185c524d1cd8
current task = S5
```

截至本 handoff 时已经严重过期。它的方法论部分（authority priority / 不把 handoff 当 SSOT）仍有价值，但所有 S5 当前状态、SHA、PR 和 blocker 都不能再作为 continuation fact。

本 handoff 应替代 #2943 作为下一对话的 continuation document。

---

# 1. 当前真实仓库状态

截至本 handoff：

```text
protected main:
99b45720fbe9130acecc790136c5046966387597

commit meaning:
Merge PR #2975
MCFT-CAP-09 S6 EA1O-A v2: Amendment-02 GFS solar-radiation source authority
```

当前 Taskbook 顶层状态：

```text
document_id:
GEOX-MCFT-CAP-09-TASK-V0.3-STAGE-1B-S6-AMENDMENT-01-02-BOUND

document_status:
STAGE_1B_DESIGN_FROZEN_WITH_S6_AMENDMENT_01_AND_02

minimum_complete_field_twin_complete:
false
```

S6 最终目标没有变化：

```text
actual UTC O00 ... O23
24 persisted scheduler slots
24 resolved tick outcomes
actual database Evidence ingress frozen at each tick boundary
no future Evidence leakage
controlled restart
missed-slot ordered backfill
stale Evidence degradation
late/out-of-order append-forward handling
State / Forecast readback
Scenario only from COMPLETED 72-point Forecast
zero automatic Recommendation / Approval / AO-ACT / Dispatch / Model Activation
exact-SHA / R2 closure
```

当前仍然禁止声称：

```text
NO_FORMAL_O00_O23_COMPLETE
NO_STAGE_1B_CLOSURE_COMPLETE
NO_MCFT_CAP09_COMPLETE
NO_PRODUCTION_DEPLOYMENT
NO_FIELD_VALIDITY_PROVEN
```

---

# 2. 本对话做的核心任务

本对话实际完成了三层工作。

## 2.1 四方重新对齐并确认旧 S6 Formal authority 设计缺陷

旧 Formal helper 同时存在以下事实：

```text
A. scope / Reality Binding 继承 MCFT-00 controlled synthetic Replay identity
B. crop context 读取 synthetic / fixture / replay configuration
C. Formal helper 自身又拒绝 synthetic / fixture / replay crop context
D. Source Binding 仍包含 fixture devices / replay weather / replay ET0
```

因此旧 S6 不是“再补一个 Postgres secret 就能跑”的状态，而是 authority graph 自相矛盾。

本轮明确裁决：

```text
CAP-08 semantic predecessor authority
!=
CAP-08 Replay scope identity authority
```

CAP-08 继续锁定 canonical kernel / transactions / persistence / replay semantics；S6 Formal Reality / source / crop authority 必须 fresh bootstrap。

禁止：

```text
reuse field_c8_demo as real field
cross-scope canonical stitching
promote replay fixture to formal truth
```

## 2.2 把用户的 S6 External Public Evidence 设计修订成可落库治理结构

本轮接受并修订用户的核心方向：

```text
不新增 S6-PRE capability slice
不新增 S7/S8
不重开 S0-S5
External Evidence qualification 作为 S6 internal sub-lifecycle
```

内部工作序列收敛为：

```text
EA0  Architecture Amendment / Taskbook correction
EA1  Site / source qualification
EA2  Formal Reality / Source / Crop authority freeze
EA3  Collector + Canonicalizer
EA4  live exact-head source qualification
EA5  Formal authority + DB preflight
then existing S6 O00-O23
then final exact-SHA / R2
```

本轮大部分工作都仍属于 `S6-EA1` 深化，不是新 capability slice。

## 2.3 实际推进并合并了一系列 External Evidence authority PR

下面是本轮最重要的已生效结果。

---

# 3. 已完成并进入 protected main 的关键 authority

## 3.1 EA0 — Amendment-01：External Public Evidence Authority

首个重要结果是 S6-only Architecture Amendment。

核心冻结：

```text
EXTERNAL_SCOPE_FRESH_BOOTSTRAP_REQUIRED = YES
CROSS_SCOPE_CANONICAL_STITCHING_FORBIDDEN = YES
CAP08_SEMANTIC_PREDECESSOR_REUSED = YES
CAP08_REPLAY_SCOPE_IDENTITY_REQUIRED = NO
RUNTIME_PROVIDER_FETCH = FORBIDDEN
```

External Site / Reality / Crop / Source 先作为：

```text
GOVERNANCE_INPUT / SUPPORTING_AUTHORITY
```

没有新增 canonical object family，没有修改 Runtime kernel。

## 3.2 EA1 初始 site/source qualification

protected main 上当前 site authority snapshot 仍明确：

```text
qualified_formal_site = null
preferred_candidate = KBS_MCSE_T1R1
overall_status = INCOMPLETE_AUTHORITY
```

当前候选优先级：

```text
1. KBS_MCSE_T1R1
2. US-KM1
US-Ne1 = NOT_QUALIFIED for 2026
```

### KBS_MCSE_T1R1 为什么成为首选

已证明：

```text
2026 MCSE plot map -> T1 R1 = Corn
KBS Aglog -> T1 planted corn on 2026-05-11
authoritative MCSE plot geometry exists
near-site KBS meteorological sources exist
```

但仍不能声明：

```text
QUALIFIED_FORMAL_SITE
```

因为 formal consolidation 尚未完成，KBS use-right 仍未最终解决。

### US-Ne1

正式排除：

```text
2026 current crop = soybean
current GEOX model scope = corn
=> NOT_QUALIFIED
```

不要重新把 US-Ne1 加回候选。

### US-KM1

仍可作为 research candidate，但不是当前首选：

```text
continuous-corn history = strong
exact 2026 crop corroboration / soil source authority = weaker than MCSE path
```

不要为了已有 AmeriFlux identity 而退回 US-KM1。

---

# 4. 当前 KBS observation / crop authority 已证明什么

## 4.1 Soil moisture：机器访问不等于 field truth

本轮找到 KBS Current Weather 的 10 cm soil moisture machine-access path。

它只能保持：

```text
OBSERVED
POINT / NEAR_SITE_POINT_SUPPORT
~100 mm depth
NEAR_SITE_METEOROLOGICAL_SUPPORT

direct_field_equivalence = false
direct_root_zone_equivalence = false
```

禁止升级成：

```text
T1R1 field soil moisture truth
root-zone truth
field-calibrated state
```

REX rainfall-manipulation footprint 也明确不能当 ordinary ambient-field truth。

## 4.2 KBS raw-hourly meteorology live proof

EA1H 已证明 KBS raw-hourly source 是真实 live source，而不是历史网页：

```text
latest observation at proof:
2026-08-08T04:00:00Z

source age:
~4.195 h

recent distinct hours:
31 in 30h window

rain / solar / wind / air continuity:
PASS
```

raw provider data 不提交仓库；只保留 hash / timing / coverage / qualification result。

## 4.3 ET0 observed-input authority — EA1I

EA1I 使用 KBS 自身 cross-table reconciliation，而不是靠“数值看起来像”猜单位。

已证明：

```text
Solar:
6945 complete matching days
median relative error ~0.0528%
=> raw SolRad AVG = W/m^2

Wind:
6945 matching days
median relative error ~0.0881%
=> raw wind = m/s at 10m

10m -> 2m frozen factor:
0.747951075

AH / vapor partial pressure:
23 recent valid comparisons
median relative error ~2.4898%
=> AH authority in kPa accepted

Pressure:
raw barometer NOT used
survey elevation = 286.43m
ASCE elevation pressure ~= 97.959724 kPa
```

这关闭了 observed hourly ASCE ET0 输入的主要技术 authority 缺口。

仍未在 Formal database 中生成 ET0 Evidence。

## 4.4 Crop-water-use stage — EA1J

没有冒充 observed biological V/R stage。

对象语义保持：

```text
FORMAL_DERIVED_CROP_WATER_USE_STAGE_CONTEXT_V1
```

基于：

```text
KBS planting authority
+ planting-day timestamp uncertainty
+ FAO grain-maize stage-duration envelope
```

不使用 future PhenoCam observation，不做 full-season hindsight normalization。

exact-head proof 结果：

```text
derived_stage_code = MID

backward guard = 6h
forward guard = 30h

all frozen maize-grain variants agree = MID
minimum next-transition margin ~= 138.516h (~5.77d)
```

因此当时可作为保守 model water-use-stage authority candidate。

---

# 5. GFS future authority 链：EA1K -> EA1N

这是本对话技术工作最多、也最容易在下一对话被误解的一段。

## 5.1 EA1K — exact-cycle / 72h chronology authority

禁止硬编码：

```text
f001 ... f072
```

正确规则：

```text
for tick T:
valid times = T+1h ... T+72h

select newest COMPLETE cycle
whose every required production object was genuinely available before T

map target valid times back to actual forecast leads
```

实测：

```text
at tick ~09:00Z:
06z incomplete -> rejected
00z selected
actual leads f010 ... f081

later at tick ~10:00Z:
06z complete
06z selected
actual leads f005 ... f076
```

证明 cycle selection 不是硬编码，且不会 wait for future files。

## 5.2 EA1L — temporal normalization structural authority

EA1K inventory 显示：

```text
TMP / RH / U / V = instantaneous
DSWRF = 1-6h average families
APCP = multiple accumulation records
PRATE = instantaneous + average records
```

因此不能把所有 GFS values 直接当 1h values。

EA1L structurally证明：

```text
DSWRF:
12 direct 1h
60 rolling-window weighted-difference candidates

PRATE average:
12 direct 1h
60 rolling-window weighted-difference candidates
```

并引入：

```text
support_lead = canonical_lead_start - 1
```

注意：EA1L 只证明 reconstruction graph 存在，不等于 value-level DSWRF authority 最终成立。

## 5.3 EA1M — pgrb2 spatial authority

Transient 读取当前 KBS MCSE T1/R1/main polygon；raw polygon/centroid 不进入 artifact。

结果：

```text
polygon unique vertices = 4
polygon diameter ~= 137.334m

all vertices + centroid select same nearest GFS pgrb2 0.25 node:
lat = 42.5
native_lon = 274.75
signed_lon = -85.25

centroid -> grid ~= 13.955km
max vertex -> grid ~= 14.023km
```

冻结：

```text
interpolation = NONE_NEAREST_GRID_POINT
direct_field_equivalence = false
support = NEAR_SITE_MODEL_GRID_POINT_SUPPORT
```

非常重要：**这个 grid authority 只属于 pgrb2.0p25，不得自动复用于 sflux。**

## 5.4 EA1N — value-level proof 最终 fail-closed pgrb2 DSWRF

EA1N pinned decoder：

```text
Python 3.12
eccodes 2.47.0
eccodeslib 2.47.3.23
python -m eccodes selfcheck
```

production chronology / decoder / grid read 都通过。

### Precipitation

PRATE rolling path 在 value level 出现负小时降水，被拒绝；没有 clipping。

随后 APCP qualification 发现：

```text
exact independent 1h accumulation only 12/72
```

不能把它当 72 个独立 1h APCP。

最终保留给 successor work 的 precipitation candidate 是：

```text
APCP_6H_BLOCK_CUMULATIVE_DIFFERENCE
WITH_NCEP_SEMANTIC_DUPLICATE_COLLAPSE
```

要求同一 block 起点、单调 cumulative、无负差、无 first-record-wins。

### DSWRF — decisive rejection

pgrb2 rolling-average weighted difference 在 `F020` 产生负小时 DSWRF。

本轮没有做：

```text
max(0, x)
zero threshold
silent imputation
```

进一步追到 production GRIB 原 message，而不是 Grib Filter 单点重编码，仍复现该 ambiguity。

EA1N exact-head decisive evidence：

```text
subject_sha:
42faed8f246b19caf0a4140599bce09f92ec6d77

workflow_run_id:
31257010218

job_id:
93101818088

selected_cycle:
2026-08-08T06:00:00Z

failure_lead:
20

F019:
step = 18-19h avg
packing = grid_complex_spatial_differencing
bits_per_value = 17
binary_scale_factor = 1
decimal_scale_factor = 2

F020:
step = 18-20h avg
packing = grid_complex_spatial_differencing
bits_per_value = 17
binary_scale_factor = 4
decimal_scale_factor = 3
```

使用 GRIB2 reconstruction / quantization bound 后证明：

```text
derived value sign = NEGATIVE
negative magnitude < 1e-2 W/m^2
negative magnitude lies inside propagated quantization uncertainty
physical zero also lies inside that interval
```

结论不是“辐射真的为负”，而是：

```text
pgrb2 rolling averages
DO NOT IDENTIFY ONE UNIQUE EXACT HOURLY SCALAR
under no-clipping / no-thresholding policy
```

因此 protected main 已正式冻结：

```text
PGRB2_0P25_ROLLING_AVERAGE_WEIGHTED_DIFFERENCE
=
REJECTED_AS_EXACT_HOURLY_SCALAR_AUTHORITY
```

同网格 `pgrb2b.0p25` 也实测：

```text
F020 surface DSWRF count = 0
```

不是 escape hatch。

---

# 6. 本轮发现并修复的 lifecycle routing 缺陷 — PR #2974

在第一次 Amendment-02 PR 上发现：旧 EA0 workflow 和 S0 workflow 会把“任何后续 Taskbook 修改”错误解释成它们自己的历史 exact-boundary Candidate。

结果表现为：

```text
EA0 exact-six gate
tries to validate EA1O 5-file successor amendment
=> false failure
```

这不是 Amendment-02 内容错误，而是 shared Taskbook successor lifecycle routing defect。

修复 PR：

```text
#2974
merge SHA:
3d46d38206f27d5d7abe2ec24577979ab29c68f8

changed files = 2 workflows only
```

修复规则：

```text
if PR modifies the historical lifecycle's owned files:
    run original exact gate
else if Taskbook is changed only by a recognized successor lifecycle:
    classify NOT_APPLICABLE / successor-taskbook-change
    do not force historical exact-boundary
```

后续 Amendment-02 v2 已用真实 successor PR 证明：

```text
EA1O focused gate = PASS
EA0 old gate = correct NOT_APPLICABLE
S0 old gate = correct successor-lifecycle PASS
```

**不要回滚 #2974 的 routing logic。**

---

# 7. 当前最新生效架构：Amendment-02 / EA1O-A — PR #2975

PR：

```text
#2975
MCFT-CAP-09 S6 EA1O-A v2: amend solar-radiation source authority

base:
3d46d38206f27d5d7abe2ec24577979ab29c68f8

head:
2bbe1a22b0bc80d477699d06ecf498950051f8e4

merge SHA / current main:
99b45720fbe9130acecc790136c5046966387597

changed files:
5
```

Taskbook 当前已升级为 v0.3，并正式绑定：

```text
Amendment-01
+
Amendment-02
```

## 7.1 Amendment-02 只改一个角色

Amendment-01 保持：

```text
GFS pgrb2.0p25 remains primary future-weather authority family
```

Amendment-02 只允许一个条件性例外：

```text
FUTURE_ET0_SOLAR_RADIATION_INPUT_ONLY
```

候选 source product：

```text
NOAA/NCEP GFS
gfs.tCCz.sfluxgrbfFFF.grib2
surface DSWRF
required semantics = DIRECT_PRECEDING_ONE_HOUR_AVERAGE
unit = W/m^2
```

FH001 静态 inventory 同时存在：

```text
surface DSWRF | 0-1 hour ave
surface DSWRF | 1 hour fcst
```

只允许：

```text
0-1 hour ave
```

禁止把 `1 hour fcst` 偷换成 interval-average solar input。

## 7.2 Amendment-02 不改什么

明确无变化：

```text
Runtime contract
canonical object contract
Runtime forcing selector
transaction families
migration
DB schema
```

future weather canonical object 仍只消费 governed precipitation；future ET0 canonical object只消费最终 ET0，不要求 Runtime 直接读 solar。

因此 mixed GFS product provenance 可以在 collector/derivation 层表达，而不需要改 canonical schema。

## 7.3 Same-cycle invariant 不变

硬规则：

```text
future_weather_assumption.source_cycle
==
future_et0_assumption.source_cycle
```

禁止：

```text
cross-cycle solar substitution
wait for newer radiation cycle
valid-time rewrite
issue-time rewrite
```

## 7.4 sflux spatial authority 必须重新冻结

最重要的 successor constraint：

```text
EA1M pgrb2 node 42.5,-85.25
MUST NOT be silently reused as sflux node
```

sflux 是独立产品，当前尚未证明：

```text
current live geometry
72h object availability
record uniqueness
native grid point
spatial extraction rule
```

因此当前：

```text
sflux_source_authority_qualified = false
sflux_spatial_authority_qualified = false
future_et0_solar_role_authorized_for_formal = false
```

---

# 8. 当前真正卡在哪里

当前不是卡在 Runtime、Postgres、scheduler、S2-S5 integration。

当前 exact frontier 是：

```text
S6-EA1O-B
LIVE SFLUX SOURCE AND SPATIAL QUALIFICATION
```

也就是：

> 在 Amendment-02 已生效后，用真实当前 GFS cycle 和 production `sfluxgrbfFFF.grib2` 对象，证明 direct 1h-average DSWRF 是否能作为 future ET0 solar input，并重新冻结 sflux native-grid spatial authority。

### EA1O-B 必须证明

对一个真实 tick boundary `T`：

```text
1. 使用与 pgrb2 future weather 完全相同的 GFS cycle
2. T+1 ... T+72 所需 sflux objects 在 freeze boundary 前已全部发布
3. 不 wait for future files
4. 每个 target interval 恰好一个 eligible surface DSWRF direct preceding-1h-average
5. 明确排除 `N hour fcst` record
6. live production GRIB geometry 被实际解析
7. spatial selection/interpolation rule 被重新冻结
8. 72 target intervals exactly correspond to T+1 ... T+72
9. values finite / physically valid
10. no negative clipping / zero threshold / imputation
11. raw object and decoded values not published in artifact
12. only hash / timing / metadata / qualification result leaves runner
```

如果某项失败：

```text
FAIL CLOSED
NO fallback to rejected pgrb2 DSWRF
```

### 建议 transport

本轮已确认 NOMADS Grib Filter 公开清单主要覆盖 pgrb2 系列；sflux 不应假定有 Filter endpoint。

优先验证：

```text
production HTTPS directory
+ sflux .idx
+ exact message byte Range
+ pinned ecCodes decoder
```

如果 provider 不支持 Range，再重新裁决 transport；不要默默下载/提交全球 raw GRIB。

---

# 9. EA1O-B 之后的计划

只有 EA1O-B source + spatial qualification 成功后，继续：

## Step A — sflux value-level solar proof

如果 EA1O-B 只做 source/geometry，不要在同一 PR 顺手把 future ET0 全做完。

单独证明：

```text
72 direct preceding-one-hour DSWRF values
same exact GFS cycle
correct target intervals
no clipping
physical sanity
normalized sequence hash
```

## Step B — complete 72h GFS value bundle

将已经保留的 pgrb2 roles 与新的 sflux solar role组合：

```text
pgrb2:
precipitation candidate
2m T
2m humidity
10m U/V

sflux:
direct 1h-average DSWRF
```

每个 input 保留独立：

```text
product family
object identity
lead
step semantics
native grid
selected point
availability
hash
```

但 cycle 必须完全一致。

## Step C — future ASCE hourly ET0

使用已冻结 EA1I authority：

```text
ASCE standardized short reference ET
wind 10m -> 2m factor 0.747951075
pressure from governed elevation path
solar W/m^2 -> energy conversion
```

输出：

```text
future_et0_assumption_v1
72 points
mm_per_hour
```

仍先在 no-write exact-head qualification 中证明，不直接进入 Formal DB。

## Step D — consolidate site/source/crop authority

当前 `qualified_formal_site=null` 的根 authority snapshot 尚未被 consolidated promotion 更新。

要把后续已通过的：

```text
KBS live met
soil machine support limitations
crop-water-use MID authority
GFS exact-cycle
GFS spatial / precipitation
sflux solar
future ET0
```

整合成新的 Formal Site / Reality / Source / Crop authority artifacts。

不要通过修改历史 Candidate snapshot 来“回写历史”。创建 successor authority。

## Step E — KBS source-use / IP settlement

这是一个尚未解决的治理 blocker。

目前 KBS 页面/数据包条款存在：

```text
publication requires lead investigator / project director permission
```

虽然某些上层 catalog metadata 曾显示较开放许可信号，但不能用 catalog-level license 自动覆盖具体 KBS package/site terms。

在 Formal ingress 前必须得到明确裁决：

```text
current use is legally/contractually allowed
raw data retention boundary is allowed
whether written permission is required
```

未解决前：

```text
KBS_FORMAL_DATA_USE_CLEARANCE = PENDING
```

如果最终需要用户获取 KBS 书面许可，再请求用户介入。

## Step F — Collector + Canonicalizer

只有 source authority 通过后再实现：

```text
External Source Collector
-> raw response hash / private retention
-> Governed Canonicalizer
-> restricted Formal Evidence writer
-> public.facts
-> DatabaseEvidenceAdapter
-> Twin Runtime
```

Runtime 继续禁止公网 fetch。

## Step G — EA4 / EA5 / Formal O00-O23

最后才进入：

```text
live exact-head source qualification
Formal authority V3 / DB preflight
actual UTC O00 ... O23
restart
missed-slot backfill
stale source
late/out-of-order
State / Forecast readback
zero actions
final exact-SHA / R2
```

不要因为外部 source qualification 很完整就提前声称 S6 complete。

---

# 10. 本轮踩过的坑——下一对话禁止重复

## 10.1 不要相信旧 handoff 比 main 新

#2943 就是实际例子。

每次接手第一步：

```text
read protected main
read current Taskbook
read latest PR/runs
then use handoff
```

## 10.2 不要新增 S6-PRE

用户最初设计已明确修正：

```text
S0-S6 capability slices frozen
S6 is the Formal closure slice
```

External Evidence 工作必须作为 `S6-EA*` sub-lifecycle，不新增 capability slice。

## 10.3 不要把真实数据塞回 field_c8_demo

`field_c8_demo` 属于 synthetic Replay identity。

Formal external scope 必须 fresh bootstrap。

## 10.4 不要因地理距离近就升级 observation truth

KBS 10cm soil sensor：

```text
near-site point support
!=
T1R1 field truth
!=
root-zone truth
```

## 10.5 不要重新选 US-Ne1 2026

2026 crop mismatch，已排除。

## 10.6 不要退回 US-KM1 只因为 AmeriFlux identity 更熟

当前 MCSE T1R1 有更强的 exact-2026 crop + plot geometry authority。

## 10.7 不要使用 REX sensor 当普通环境场地真值

REX 是 rainfall-manipulation footprint。

## 10.8 AWDN / `network=enviro` 路线已经实测不成立

本轮发现：

```text
scqc60 general inventory exists
but target KBS/Hickory station match = 0
network=enviro list/active returned 400
```

不要继续靠修改 URL 参数反复磨这个已判定的数据面。

## 10.9 不要假设网站 `.csv` 就是稳定 machine feed

GLBRC/KBS 曾出现：

```text
web page has 2026 rows
complete table metadata says old update date
.csv endpoint protocol/size/format not suitable as assumed online feed
```

需要 browser/live probe 或正式 machine endpoint proof。

## 10.10 Crop stage 禁止 future leakage

禁止：

```text
full-season GCC hindsight
future PhenoCam observations
ex-post normalization
```

只允许 as-of inputs + explicit forward guard。

## 10.11 GFS 不能硬编码 f001-f072

必须按：

```text
tick T
selected cycle C
actual lead = valid_time - C
```

latest incomplete cycle 必须拒绝。

## 10.12 structural normalization graph != value authority

EA1L 曾证明 DSWRF rolling-difference graph结构可重建，但 EA1N value-level proof 最终否决了它。

不要看到 EA1L PASS 就重新使用 pgrb2 hourly solar。

## 10.13 不要对负 precipitation / radiation 做 clipping

禁止：

```text
max(0,x)
abs(x)
small negative -> zero without authority
```

本轮正是因为坚持 no-clipping 才发现 pgrb2 DSWRF quantization ambiguity。

## 10.14 不要把 Grib Filter 单点结果当 production packing authority

本轮发现 Grib Filter 单点 subset 会把 message 重新打包成 constant field：

```text
packing = grid_simple
bitsPerValue = 0
```

production message则是：

```text
grid_complex_spatial_differencing
bitsPerValue = 17
```

因此 issuance / packing / precision authority必须来自 production object，不来自 Filter 重编码。

## 10.15 不要把 pgrb2 spatial node 自动复用到 sflux

Amendment-02 已把这条写成 hard prohibition。

## 10.16 不要让 lower authority 静默覆盖 Taskbook Amendment

想从 pgrb2 换 sflux 时，必须先做 Amendment-02；EA1N supporting authority无权改 Amendment-01。

## 10.17 不要回滚 #2974 successor routing repair

否则后续任何合法 Taskbook amendment 都会重新误触历史 EA0/S0 exact-boundary gate。

## 10.18 不要把 status snapshot 的 `candidate_not_effective` 当成当前 main truth

例如 EA1O status 文件仍保留创建时 Candidate snapshot；现在 Amendment-02 已被 Taskbook v0.3 绑定并合并到 protected main。

## 10.19 不要提交 KBS raw payload / polygon / decoded forecast values

当前默认：

```text
private transient acquisition
hash-only public evidence
no raw redistribution
```

直到 use-rights 被正式裁决。

---

# 11. 当前重要 PR / merge 序列

以下是本轮 continuation 最重要的 merged milestones：

```text
#2955
EA0 Amendment-01 / External Evidence Authority
protected-main result around:
5a7f2922bcf13c2cc4c76447862bc51d15c28c46

#2956
EA1 site/source qualification
main advanced to:
96a505e959895ac1e2f980cc2887d74177dcae2b

#2966
EA1H KBS raw-hourly live meteorology qualification

#2967
EA1I KBS ET0 input authority
main advanced to:
473d4529af0ee042bab9214d05f46bf8777428e1

#2968
EA1J crop-water-use stage authority
main advanced to:
6567d7826368a76bff72579d9ce1b81a6a036410

#2969
EA1K GFS exact-cycle 72h authority
main advanced to:
5a593fe9364e4593676e361af893d67e3cca7766

#2970
EA1L GFS hourly-normalization structural authority
main advanced to:
4612e616da11279fe70696176b1273e42927a907

#2971
EA1M pgrb2 spatial extraction authority
main advanced to:
58287db14bc0d6424219f6a91a08c3f12dfe4536

#2972
EA1N pgrb2 DSWRF value authority fail-close adjudication
merge SHA:
2c47df7d08d507b0f31f084cb047d2bd69210f73

#2974
successor Taskbook lifecycle routing repair
merge SHA:
3d46d38206f27d5d7abe2ec24577979ab29c68f8

#2975
EA1O-A v2 Amendment-02 solar-radiation source authority
merge SHA / current protected main:
99b45720fbe9130acecc790136c5046966387597
```

不要机械依赖这里的 intermediate main SHA；handoff 之后 main 可能继续前移。

---

# 12. 下一位接手者的第一组动作

不要先改代码。

严格按下面顺序：

```text
1. fetch latest protected main
2. verify main >= 99b45720fbe9130acecc790136c5046966387597
3. read Taskbook v0.3
4. read Amendment-01
5. read EA1N fail-close authority
6. read Amendment-02
7. verify no newer EA1O-B PR already exists
8. inspect current GFS production cycle / sflux objects
9. create EA1O-B source+spatial qualification from latest protected main
```

EA1O-B 建议保持小边界：

```text
source/spatial authority artifact
live probe
static governance acceptance
focused workflow
(+ only delivery routing delta if current policy machine-proves it is required)
```

不要在 EA1O-B 同时：

```text
create canonical Evidence
execute future ET0
write DB
start Formal window
change Runtime
change canonical schema
```

---

# 13. 当前 Nonclaims / 状态冻结

```text
NO_QUALIFIED_FORMAL_SITE_CONSOLIDATED_YET
NO_FIELD_SOIL_MOISTURE_TRUTH
NO_ROOT_ZONE_OBSERVED_TRUTH
NO_KBS_FORMAL_USE_CLEARANCE_YET
NO_SFLUX_LIVE_SOURCE_AUTHORITY_YET
NO_SFLUX_SPATIAL_AUTHORITY_YET
NO_72H_FUTURE_ET0_VALUE_AUTHORITY_YET
NO_EXTERNAL_COLLECTOR_FORMAL_ACTIVATION
NO_FORMAL_DATABASE_INGRESS_ACTIVATED
NO_FORMAL_O00_O23_STARTED
NO_STAGE_1B_SHADOW_ONLINE_CLOSURE
NO_MCFT_CAP09_COMPLETE
NO_FIELD_VALIDITY_PROVEN
NO_PRODUCTION_DEPLOYMENT
NO_AUTOMATIC_RECOMMENDATION
NO_AUTOMATIC_APPROVAL
NO_AO_ACT
NO_DISPATCH
NO_MODEL_ACTIVATION
```

---

# 14. 一句话接手结论

下一对话不要再回到 S5，也不要再尝试把 `pgrb2.0p25` rolling-average DSWRF 修成小时值。

当前唯一正确的 focused frontier 是：

```text
Amendment-02 已在 protected main 生效
        ↓
EA1O-B
live qualify NOAA/NCEP GFS sflux direct 1h-average DSWRF
        ↓
re-freeze sflux native-grid spatial authority
        ↓
then complete 72h value bundle / future ET0
        ↓
then consolidate Formal Site/Reality/Source/Crop authority
        ↓
resolve KBS use-right
        ↓
collector/canonicalizer + DB preflight
        ↓
actual UTC O00-O23
        ↓
final exact-SHA / R2
```

这就是当前 MCFT-CAP-09 S6 的准确 continuation point。
