# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-15

更新时间：2026-08-15 00:40（UTC+8）

> 本 handoff 只恢复工程上下文，不制造新的 authority、effectiveness、activation、crop-stage、season、Formal write 或 operational GO 权限。若本文与 current Master Task Line、MCFT-CAP-09 Taskbook、effective Amendments、protected `main`、exact workflow run、immutable artifact 或后续 merged evidence 冲突，以更高权威事实为准。
>
> 本 handoff 还记录了 2026-08-15 用户本地完成的 NOAA CDO thermal cross-validation 和已打通的 Copernicus Sentinel-2 接口准备状态。这两部分目前是 **OUT-OF-REPO DISCOVERY / CANDIDATE EVIDENCE ONLY**，除非后续经过独立 exact source/spatial/time/crop/mapping qualification 并被正式治理边界采纳，否则不具有 Runtime/readiness/phenology/Kc/EA5E2 authority effect。

## 0. 当前快照

```text
repository:
liyongshang44-max/GEOX

master_authority:
docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md
version = V2.3 / CURRENT

current_taskbook:
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md
version = Complete Taskbook v0.5 — Stage 1B Design Freeze / S6

target:
STAGE_1B_SHADOW_ONLINE_CLOSURE

protected_main:
23f224c701dbe0b8bd56eceff3741cb1c3dc1f78

latest_merge:
PR #3142 — MCFT-CAP-09: adjudicate KBS public current-crop source gap
merge = 23f224c701dbe0b8bd56eceff3741cb1c3dc1f78
focused run = 31815710994 PASS

current_repository_frontier:
CURRENT_CROP_ALTERNATIVE_SOURCE_AUTHORITY_DESIGN_REVIEW

real KBS five-family data path:
QUALIFIED / FROZEN ON MAIN

real five-family -> Amendment-11 CAP04 exact-main witness:
run = 31789305745
subject = 839d320b118d37a51b659730d0a9e2a1058e433b
result = SUCCESS

engineering/static readiness blockers after #3130:
closed

current readiness blocker class:
CURRENT_SEASON_LIFECYCLE_UNRESOLVED

required unresolved axes:
season lifecycle = UNRESOLVED
phenology stage = UNRESOLVED
crop model parameter / Kc = UNRESOLVED / null

ea5e2_operational_activation_qualified:
false

formal O00-O23:
0/24

full_operational_go:
false

local external thermal corroboration:
NOAA CDO / GHCND cross-validation = STRONG PASS AS DISCOVERY EVIDENCE ONLY
repository authority effect = NONE

satellite discovery connection:
Copernicus OAuth Client = CREATED
OAuth token = PASS
Sentinel Hub Catalog collections = PASS
sentinel-2-l2a = AVAILABLE
T1R1 scene/NDVI extraction = NOT YET RUN
```

---

## 1. 我们现在在做什么

总任务没有变化：MCFT-CAP-09 正在把已经证明的 Replay Runtime 语义推进到同一 canonical Runtime 的 Shadow-online Stage 1B，不创建第二套 Twin kernel。

当前问题已经从 KBS weather/provider/cadence、five-family transport、CAP04 consumer、signed ET0、evidence-snapshot transport 等工程问题，收敛为 **current formal crop authority**：

```text
season_2026_corn
field = field_kbs_mcse_t1r1
formal site = KBS_MCSE_T1R1
crop = corn
hybrid = P0306Q / 103 RM

need:
1. current season lifecycle authority
2. current phenology -> governed water-use stage authority
3. governed crop-model parameter / Kc
4. only then can a future legal T and EA5E2 operational activation be reconsidered
```

Effective Amendment-13已经把过去错误耦合的三件事拆开：

```text
season_lifecycle_authority
phenology_stage_authority
crop_model_parameter_authority
```

因此“当前季仍存在”不能由“stage 能否被 thermal proxy 唯一确定”来替代；反过来，即使 lifecycle 最终为 ACTIVE，没有合法 phenology/Kc 也仍然不能进入 CAP04 Formal tick。

当前 protected-main #3142 已正式结束“继续从 KBS 公开页面找 direct T1R1 current crop fact”这一轮循环，下一 legal frontier 是：

```text
CURRENT_CROP_ALTERNATIVE_SOURCE_AUTHORITY_DESIGN_REVIEW
```

这允许设计/发现独立真实农艺来源，但任何 NOAA、卫星、scouting、extension、第三方或其他 treatment/replicate 证据都必须先独立做 source/spatial/time/crop/mapping qualification，不能因为“看起来合理”直接进入 readiness。

---

## 2. 已完成什么

### 2.1 KBS real-data path 已经完成，不应继续把 crop blocker 误称为“KBS 还没测完”

Protected main 已经冻结独立 KBS five-family live qualification：

```text
future_weather_assumption_v1
future_et0_assumption_v1
soil_moisture_observation_v1
observed_rainfall_v1
historical_et0_estimate_v1
```

真实链路已经证明：

```text
rolling pre-boundary producer
-> immutable producer artifact / private R2
-> cross-head producer-bound rehydration of 3 pre-T families
-> one real KBS DAILY_BATCH GET
-> raw retention before decode
-> exact-T rainfall + historical ET0
-> exactly five families in isolated PostgreSQL
```

`KBS_EXTERNAL_FIVE_FAMILY_DATA_PATH_QUALIFIED=true` 已由 #3123 冻结。

### 2.2 signed ET0 consumer mismatch 已关闭

#3128 / Amendment-12 冻结：canonical signed ET0 不修改，只在 nonnegative soil-water consumption seam 做：

```text
model_water_loss_demand_mm = max(canonical_signed_et0_mm, 0)
```

#3129 实现 adapter，且只对真正 negative ET0 点附加 projection provenance；nonnegative path 必须保持 determinism/hash no-op，避免 CAP05 currentness 回归。

### 2.3 real five-family -> CAP04 已真实 PASS

Exact protected-main workflow：

```text
run = 31789305745
workflow = mcft-cap-09-cap04-amendment11-real-five-family-consumption
head = 839d320b118d37a51b659730d0a9e2a1058e433b
result = SUCCESS
```

这证明真实 KBS evidence 已经进入 GEOX actual compute chain。这里应把“数据源/计算链能不能跑”与“当前 crop authority 是否够资格 operational activation”严格分开。

### 2.4 evidence_snapshot transport migration 已关闭

#3130 完成 Amendment-11 已授权但尚未完全迁移的 callsite：

```text
evidence_snapshot_time
```

成为 PostgreSQL evidence source 的正式 public input seam，旧 `exact_interval_availability_cutoff_time` transport alias 从 active path 移除。

#3130 branch proof 把 readiness blocker set 从 2 个降为仅剩 crop authority blocker。

### 2.5 Amendment-13 三轴 authority 已生效并绑定 readiness

#3131：分离 lifecycle / phenology / crop-model-parameter authority。

#3132 live current-crop requalification：

```text
run = 31795122787 PASS
lifecycle = UNRESOLVED
phenology = UNRESOLVED
Kc = UNRESOLVED / null
```

#3133 把这个三轴结果绑定进 EA5E2 readiness；旧 blocker：

```text
CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET
```

被禁止继续使用。当前 exact blocker 改为：

```text
CURRENT_SEASON_LIFECYCLE_UNRESOLVED
```

并同时保留 diagnostics：

```text
ACTIVE_LIFECYCLE_NOT_PROVEN_BY_PROVIDER_SILENCE
REQUIRED_PHENOLOGY_STAGE_UNRESOLVED
REQUIRED_CROP_MODEL_PARAMETER_AUTHORITY_UNRESOLVED
```

### 2.6 KBS current-season source inventory / lifecycle anchor 研究已经完成并正确收口

#3134：公共 current-season source inventory；证明 KBS public data 不是 globally stale，但 formal T1R1 direct fact 不足。

#3135 / #3136：合法建立了一个 **historical positive ACTIVE anchor**：

```text
planting #6931 -> season origin + corn/P0306Q identity
management observation #6977 -> positive T1 all-replicate managed activity
qualified ACTIVE event window = 2026-05-27T18:35Z .. 20:40Z
```

Amendment-14 只证明那一段历史 event window 为 ACTIVE，不把 event_time 回写成 current time，也不自动 carry-forward 到今天。

### 2.7 absence/carry-forward 路线已经被纠正并关闭

#3137 最初尝试把“positive historical anchor + no published reset” carry-forward 到 provider snapshot。

随后发现关键语义错误：

```text
HTTP retrieval time != T1R1 scope completeness watermark
```

#3138 / #3139 / #3140 逐步纠正并关闭：

```text
retrieval_timestamp_is_scope_coverage_watermark = false
scope-specific completeness = not established
publication-lag upper bound = not established
complete-through event-time watermark = unresolved
future_forward_validity_hours = 0
```

因此不能从 provider silence 制造 `ACTIVE valid through retrieval`，也不能再制造 `+3h` future lifecycle lease。

### 2.8 direct current KBS source search 已终止为 public formal-scope source gap

#3141 live discovery：

```text
run = 31811734761 PASS
latest T1R1 reviewed = #7095 / 2026-06-25
latest global AgLog reviewed = #7148 / 2026-08-13
near-current direct positive T1/T1R1 crop-bound candidate = 0
provider-direct phenology candidate = 0
```

#3142 进一步 live review 其他 KBS public crop/biomass/yield/phenology surfaces，focused run `31815710994` PASS。

结论：

```text
reviewed_public_kbs_current_2026_data_exists = true
reviewed_public_kbs_p0306q_2026_data_exists = true
reviewed_public_kbs_t1r1_direct_current_crop_authority_established = false
reviewed_public_kbs_t1r1_direct_phenology_authority_established = false
reviewed_public_kbs_t1r1_current_crop_model_parameter_authority_established = false
```

正式结论：

```text
KBS_PUBLIC_CURRENT_SEASON_DIRECT_T1R1_CROP_AUTHORITY_GAP_ESTABLISHED_FOR_REVIEWED_PUBLIC_SURFACES
```

特别注意：#3142 找到了 current 2026/P0306Q public positive control（Main Site T3，2026-05-20 planting），所以不能把问题描述成“KBS 数据过期”。问题是 **formal T1R1 scope direct current fact gap**。T3 不得替代 T1R1。

---

## 3. 当前卡在哪

现在的 blocking frontier 已经非常窄：

```text
KBS weather / temporal semantics          CLOSED
KBS daily-batch transport                  CLOSED
raw retention / exact identity             CLOSED
rolling producer / intersection            CLOSED
cross-head rehydration                     CLOSED
five-family isolated DB                    CLOSED
signed ET0 consumption seam                CLOSED
real five-family -> CAP04                   PASS
evidence_snapshot callsite migration       CLOSED
static engineering blockers                CLOSED

current season lifecycle authority         UNRESOLVED
current phenology authority                UNRESOLVED
current Kc/model parameter authority        UNRESOLVED
EA5E2 operational activation               BLOCKED
Formal                                     0/24
```

最重要的判断：

**现在卡住的不是 KBS weather 数据，也不是 GDD 算法，也不是 CAP04 Runtime 链。现在卡的是“用什么真实证据合法建立当前 T1R1 crop biological/lifecycle state，并进一步映射到 governed stage/Kc”。**

因此不要继续扩展 KBS cadence/timing test，也不要再在 AgLog silence 上做更多 carry-forward 研究。

---

## 4. 2026-08-15 本地 NOAA CDO thermal cross-validation

### 4.1 状态

用户已取得 NOAA CDO token，并从 `GHCND` Daily Summaries 拉取 KBS 周边三个站点：

```text
USC00203504  GULL LAKE BIOLOGICAL STATION
USC00200552  BATTLE CREEK 5 NW
USW00014815  BATTLE CREEK KELLOGG AIRPORT
```

Gull Lake 空间最近但 2026 当前季 TMIN/TMAX 缺测过多；Battle Creek 5 NW 也有较大缺口。`USW00014815` 数据连续性最好，因此用作独立 thermal cross-check 主站。

### 4.2 NOAA full-window bounded result

窗口：

```text
2026-05-11 -> 2026-08-10
```

Airport station：

```text
complete days = 88 / 92
missing days = 4
missing dates = 2026-07-25 .. 2026-07-28
planting-day GDU = 6.0
```

按照仓库已有 Pioneer Base-50 frozen semantics：

```text
Tmax cap = 86 F
Tmin floor = 50 F
max daily GDU = 36
planting-day lower = 0
missing-day lower/upper = 0 / 36
```

用户本地得到：

```text
NOAA governed lower = 1644.5 GDU
NOAA governed upper = 1794.5 GDU
```

现有仓库 KBS bounded result（historical #3054）：

```text
KBS lower = 1714.626 GDU
KBS upper = 1828.917 GDU
```

两个 uncertainty envelope 实质重叠，但 interval overlap 不是最终验证标准。

### 4.3 exact common-day KBS vs NOAA cross-validation

用户本地随后只取双方都具有合法 Tmax/Tmin 的共同日期，并使用同一个 Base-50 算法，未插值、未补缺测。

结果：

```text
Common valid days: 85

KBS common-day cumulative GDU:  1628.235
NOAA common-day cumulative GDU: 1621.500
Cumulative delta KBS-NOAA:       6.735 GDU
Cumulative delta:                0.415%

Daily mean bias KBS-NOAA:        +0.079 GDU/day
Daily MAE:                       0.809 GDU/day
Daily RMSE:                      1.053 GDU/day
Daily GDU correlation:           0.98761
```

最大单日差：

```text
2026-05-26
KBS = 20.81
NOAA = 16.50
Delta = +4.31 GDU
```

其余 top differences 约在 ±2 GDU/day 量级。

### 4.4 当前解释边界

这份本地结果强烈支持：

```text
KBS thermal trajectory is independently corroborated by nearby NOAA GHCND observations
```

但当前必须保持：

```text
repository evidence freeze = NOT YET
source qualification = NOT YET
readiness authority effect = NONE
lifecycle authority = NONE
phenology authority = NONE
Kc authority = NONE
EA5E2 effect = NONE
```

NOAA 的价值是关闭“KBS temperature/GDD 是否异常”这一怀疑，不是直接把累计 GDD 变成 P0306Q 当前 biological R-stage。

如后续要把 NOAA 变成正式 corroboration evidence，应单独创建 exact candidate artifact，至少冻结 station identity、距离/spatial scope、CDO dataset/datatype、query window、raw response digest、missing-day policy、Base-50 algorithm ref、common-day alignment、result metrics、retrieved_at，并保持 authority effect 为 NONE，除非另有治理裁决。

---

## 5. Copernicus / Sentinel-2 当前准备状态

### 5.1 已完成连接

用户已创建 Copernicus Data Space OAuth Client：

```text
flow = Client Credentials
```

本地 OAuth 验证：

```text
Token acquired = True
Token type = Bearer
expires_in = 1800 seconds
```

Sentinel Hub Catalog collection 验证：

```text
GET https://sh.dataspace.copernicus.eu/catalog/v1/collections
sentinel-2-l2a = AVAILABLE
```

因此目前接口层状态：

```text
Copernicus account / OAuth       PASS
Sentinel Hub authentication      PASS
Sentinel-2 L2A catalog           PASS
T1R1 exact AOI extraction        NOT YET RUN
scene search                     NOT YET RUN
SCL-masked NDVI statistics       NOT YET RUN
satellite authority qualification NOT STARTED
```

OAuth client secret/token 不得写入仓库、handoff、artifact 或日志。

### 5.2 下一步卫星 discovery 目标

第一目标不是“卫星直接判 R5”。第一目标应是：

```text
SATELLITE_CURRENT_CROP_LIFECYCLE_EVIDENCE_CANDIDATE
```

需要先从 KBS public MCSE plot polygon source（candidate: datatable 829）精确提取：

```text
treatment = T1
replicate = R1
subplot = main
```

然后用 exact polygon 做 Sentinel-2 L2A scene discovery，优先窗口：

```text
2026-07-01 -> current
```

场景级 cloud cover 只用于候选排序，不能直接视为 plot clear fraction。

### 5.3 第一阶段应取的卫星结果

对每个有用 acquisition，至少应保留：

```text
scene / item id
satellite sensing_time       <- observation/event time
retrieved_at                 <- real GEOX retrieval time
exact T1R1 polygon ref + digest
scene cloud cover
plot valid-pixel / clear fraction
SCL mask policy
resolution
B04 red
B08 NIR
NDVI mean / dispersion / percentiles
raw request digest
raw response digest
```

Cloud / invalid filtering至少要 fail-closed 排除 Sentinel-2 L2A SCL 中的：

```text
NO_DATA
SATURATED/DEFECTIVE
CLOUD_SHADOW
MEDIUM/HIGH CLOUD
THIN_CIRRUS
SNOW/ICE
```

后续可扩展 B05/B06/B07 red-edge、B11 SWIR，但第一阶段不要扩大变量面。

### 5.4 第一阶段允许回答的问题

允许候选化：

```text
positive standing/vegetated crop evidence?
canopy still strongly green?
senescence trajectory?
sudden removal / bare-surface transition?
observation unusable because cloud/shadow?
```

不允许直接声称：

```text
NDVI X => P0306Q exact R-stage
imagery => direct phenology authority
imagery => Kc
imagery => EA5E2 GO
```

#3142 已明确：remote imagery 不得自动替代 direct phenology；任何 imagery authority 必须有独立 source/spatial/time/crop/mapping qualification。

---

## 6. 下一步计划

当前推进顺序应保持窄，不要重新扩散审计范围。

### Step 1 — 完成 Sentinel-2 discovery，不改 Runtime

```text
1. 获取并 digest exact KBS T1R1 polygon
2. Catalog search 2026-07-01 -> current Sentinel-2 L2A scenes
3. 选 clear-enough acquisitions
4. Statistical API / Process API 做 SCL-masked T1R1 10m statistics
5. 建立时序：clear fraction + NDVI/basic spectral trajectory
6. sensing_time 与 retrieved_at 分离
7. authority_effect = NONE
```

### Step 2 — 对 satellite 结果做 source-class adjudication

如果卫星结果清晰支持 current standing/green crop 或明确 removal transition，只进入：

```text
CURRENT_CROP_ALTERNATIVE_SOURCE_AUTHORITY_DESIGN_REVIEW
```

必须回答：

```text
source identity 是否稳定？
T1R1 polygon spatial binding 是否精确？
10m mixed-pixel / edge contamination 如何处理？
cloud/SCL mask 是否足够？
sensing chronology / publication availability 如何绑定？
观测能证明 lifecycle 到什么程度？
能否证明 biological phenology，还是只能证明 canopy state？
从 satellite state 到 water-use stage 的 mapping authority 是什么？
```

### Step 3 — NOAA 保持 corroboration，不抢占 satellite/current-crop authority 主线

NOAA cross-validation 已经足够强，暂时不要继续为 GDD 增加更多站点或插值模型。

如果要正式落仓：做一个独立 external-corroboration candidate artifact / acceptance，明确 `authority_effect=NONE`，不要把 NOAA thermal corroboration 伪装成 current phenology source。

### Step 4 — 只有 alternative source qualification 真正建立 current axes 后，才重跑 readiness

当且仅当后续 authority 能合法关闭：

```text
season lifecycle
phenology stage
Kc/model parameter
```

再重新跑 exact-head full readiness blocker set。

不要提前启动 Formal，不要只因为 KBS/NOAA/satellite 数据“看起来正确”就手工判 GO。

---

## 7. 已踩过的坑，必须避免

### 7.1 不要把 KBS DAILY_BATCH 误当 hourly publication

KBS observation resolution 可以是 HOURLY，但实际发布 cadence 已经坐实为 DAILY_BATCH。不要再把 6h/7h hourly freshness 逻辑当主线。

### 7.2 event_time / sensing_time 绝不能重写成 retrieval time

已经在 AgLog lifecycle 上付出过一次代价：

```text
HTTP retrieval time != provider completeness watermark
```

卫星同理：今天下载到 8 月 10 日的 Sentinel scene，其 biological observation time 是 satellite sensing time，不是今天。

### 7.3 provider silence 不能制造 ACTIVE

`no published harvest/reset` 最多是 provider snapshot context；没有 scope completeness/publication-lag authority 时不能变成 current lifecycle lease。

### 7.4 observation_id 不能当 physical chronology

AgLog ID 可用于 identity，不得未经证明用作真实 operation-time ordering；同日 ambiguity 必须 fail closed。

### 7.5 字符串 classifier 会误判真实语义

#3141 首版把 Planting #6931 comment 中设备品牌 `Harvest International Planter` 的 `Harvest` 误判成 harvest/reset。必须区分 observation_type semantics 与 free-text comment semantics，并有正/反 control。

### 7.6 acceptance 不要用 brittle negated substring

#3140 首 run 因为 `forbidMarker()` 命中了正确的 negated sentence 而失败。治理 acceptance 应验证结构化正向过度声明，而不是用会撞 `NOT ...` 的裸 substring。

### 7.7 canonical identity 不能在 rehydration 时随意换 decoder/dataset id

此前 cross-head rehydration 因重新命名 decoder/dataset id 导致 semantic manifest hash 不可能相等。重放同 raw bytes 时必须保留 producer canonical identity，不能为了“rehydration”创造新身份。

### 7.8 signed canonical ET0 与 model consumption 必须分层

不要 source/canonical clipping negative ET0。canonical signed value 保留，nonnegative water-loss demand 只在模型 consumption seam 投影。

### 7.9 provenance 变化也会改变 determinism/hash

不要把新 policy ref 无差别附加到本来未变的 positive ET0 点；即使数值相同，provenance/hash drift 也会打断 CAP05 currentness。

### 7.10 NOAA / satellite 是 alternative evidence candidate，不是“看起来合理就 substitute”

NOAA 不能因为离 KBS 近就自动成为 formal weather authority；Sentinel-2 不能因为看到绿色冠层就自动成为 exact phenology authority。#3142 的 no-substitution boundary 继续有效。

### 7.11 不要把 thermal accuracy 与 phenology authority 混为一谈

当前 NOAA/KBS exact common-day GDD 高度吻合，已经足以说明 thermal trajectory 本身不是主要问题。剩余 epistemic gap 是：

```text
credible thermal state
+ current biological observation
-> governed phenology/water-use-stage mapping
-> governed Kc
```

继续优化温度源不会自动关闭这个 gap。

---

## 8. 当前 hard nonclaims

直到新的 alternative-source authority 被独立证明并合并：

```text
CURRENT_SEASON_ACTIVE = NOT ESTABLISHED
CURRENT_SEASON_TERMINATED = NOT ESTABLISHED
CURRENT_PHENOLOGY_STAGE = UNRESOLVED
CURRENT_CROP_MODEL_PARAMETER_KC = UNRESOLVED / null
SATELLITE_CURRENT_CROP_AUTHORITY = NOT ESTABLISHED
NOAA_CDO_RUNTIME_AUTHORITY = NOT ESTABLISHED
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = false
FORMAL_WINDOW_STARTED = false
FORMAL_EXECUTION_COUNT = 0/24
FULL_OPERATIONAL_GO = false
MCFT-CAP-09 completed = false
```

同时不要退回旧错误状态：

```text
KBS_EXTERNAL_FIVE_FAMILY_DATA_PATH_QUALIFIED = true remains true
real five-family -> CAP04 exact-main witness = PASS remains true
```

当前 crop authority blocker 不应重新描述成 KBS 数据链失败。

---

## 9. 下一次接手的第一步

不要从旧 2026-08-14 signed-ET0 handoff 或旧 `839d...` main 开始。

第一步按以下顺序核实：

```text
1. protected main 是否仍为 23f224c701dbe0b8bd56eceff3741cb1c3dc1f78
2. #3142 之后是否已有 CURRENT_CROP_ALTERNATIVE_SOURCE_AUTHORITY_DESIGN_REVIEW successor PR
3. 是否已有 NOAA external corroboration artifact/PR（当前 handoff 写入时没有）
4. 是否已有 Sentinel-2 T1R1 polygon / catalog / statistics candidate artifact（当前 handoff 写入时没有）
5. 若有新 alternative-source evidence，先审 exact source/spatial/time/crop/mapping boundary，再谈 readiness
6. 若仍无新 authority，不要启动 Formal，维持 EA5E2 BLOCKED / 0/24
```

当前恢复点应读取为：

```text
KBS data path + CAP04 real consumption = proven
engineering blockers = closed
KBS public direct T1R1 current-crop search = formally exhausted for reviewed surfaces
NOAA thermal cross-validation = strong local external corroboration, authority NONE
Copernicus Sentinel-2 connection = ready
next concrete experiment = exact T1R1 Sentinel-2 current-canopy trajectory
repository frontier = CURRENT_CROP_ALTERNATIVE_SOURCE_AUTHORITY_DESIGN_REVIEW
```
