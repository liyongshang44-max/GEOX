# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-15

更新时间：2026-08-15 15:06（UTC+8）

Status: **CONVERSATION HANDOFF ONLY — NOT REPOSITORY AUTHORITY**

> 本 handoff 用于下一对话恢复工程上下文，不制造新的 authority、effectiveness、activation、Formal write、crop-stage、lifecycle、database、scheduler 或 EA5E2 GO 权限。
>
> 若本文与 current Master Task Line、MCFT-CAP-09 Taskbook、effective Amendments、protected `main`、exact workflow run、immutable artifact、Neon 实际拓扑或后续 merged evidence 冲突，以更高权威事实为准。
>
> 本文刻意区分：**仓库已合并事实**、**live/read-only qualification 事实**、**当前 UI/权限等待状态**。尤其是 Neon：截至本 handoff，用户界面正在等待一次 SQL 权限批准；目标 T3R1 Formal database 必须仍按 **NOT YET PROVEN CREATED** 处理，直到工具实际执行成功并重新核验 authoritative primary branch 上的 database topology。

---

## 0. 下一对话先读这一节

当前唯一正确 frontier：

```text
T3R1_ZERO_STATE_FORMAL_DATABASE_CREATION_AND_QUALIFICATION
```

不是：

```text
KBS provider research
Sentinel-2 research
Sentinel-1 research
T1R1 crop authority rescue
T3R1 lifecycle research
T3R1 geometry research
T3R1 runtime rebind
```

这些主线已经完成或被明确降级。

当前保护分支基线：

```text
repository:
liyongshang44-max/GEOX

protected main:
b6f2883789d48aeed717263f8fb43152fd34c57e

latest critical merge:
PR #3158 — MCFT-CAP-09: rebind active Formal runtime scope to T3R1
merge SHA = b6f2883789d48aeed717263f8fb43152fd34c57e

active Formal runtime scope:
T3R1

formal execution:
0/24

EA5E2 operational activation:
NOT YET AUTHORIZED
```

当前最前沿现场状态：

```text
Neon project:
delicate-glade-62464340

authoritative branch frozen by Fresh Formal DB V2:
br-cold-dust-a6j6aymz

target new database:
geox_mcft_cap09_s6_formal_t3r1_24h

target secret name:
GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL

old T1 Formal DB forbidden as T3 storage:
geox_mcft_cap09_s6_formal_24h

simulation branch forbidden:
br-falling-cake-a6lfsdak

latest verified target-database existence:
NOT PRESENT

latest verified admin role:
neondb_owner
CREATEDB = true
CREATEROLE = true

current operator/UI state:
ChatGPT/Neon permission dialog is waiting for user approval to execute SQL intended to create
geox_mcft_cap09_s6_formal_t3r1_24h

IMPORTANT:
permission dialog != database created
"temporary branch" wording in the permission UI != authoritative primary branch identity
```

下一对话的第一动作：

1. 看用户是否已经点击 Neon 弹窗里的 **允许一次**。
2. 如果已允许，读取工具执行结果。
3. 无论执行结果看起来如何，重新列举 Neon project / branch / database topology。
4. 只有当 `geox_mcft_cap09_s6_formal_t3r1_24h` 被证明存在于 authority 冻结的 `br-cold-dust-a6j6aymz`，才能进入 schema bootstrap。
5. 如果数据库只存在于 connector 创建的临时 branch，不得把它当 Fresh Formal DB V2 target；必须重新裁决创建方式。

---

# 1. 这次对话到底在做什么

本对话最初接手的是 MCFT-CAP-09 S6 / EA5E2，目标仍然是：

> 在不创建第二套 Twin kernel、不伪造 provider 时间、不跨 scope 拼 canonical state 的前提下，把已经证明的 Replay Runtime 语义推进为同一 canonical Runtime 的真实 Shadow-online Stage 1B Formal 24h qualification。

对话开始时，问题看起来像：

```text
KBS daily publication
-> current crop authority
-> Kc
-> EA5E2 无法开始
```

随后问题不断收敛：

```text
KBS provider timing
↓
rolling capture / rehydration
↓
five-family real-data CAP04 consumption
↓
signed ET0
↓
current crop authority
↓
T1R1 stage/Kc ambiguity
↓
T3R1 alternative Formal scope
↓
lifecycle persistent-state semantics
↓
T3R1 lifecycle / geometry / stage / Kc
↓
Formal successor authority
↓
active runtime scope rebind
↓
CURRENT FRONTIER:
zero-state T3R1 Formal DB
```

现在已经不再是“数据源有没有”或“crop authority 有没有”的问题。

当前真正剩下的是：

```text
create distinct empty T3R1 Formal DB
→ apply current-main schema only
→ prove zero-state
→ bind exact secret
→ fresh T3R1 bootstrap
→ exact-head full readiness blocker set
→ blocker = 0 => GO
→ EA5E2
```

---

# 2. 这次对话最重要的架构修正：persistent lifecycle semantics

## 2.1 原问题

旧逻辑事实上把：

```text
没有新的 positive crop observation
```

误读成：

```text
current season lifecycle 无法继续存在
```

这把 persistent management state 当成了 weather / soil moisture 一类 snapshot state。

用户提出的核心修正是：

```text
PROVIDER SILENCE IS NOT LIFECYCLE EVIDENCE
```

但同时：

```text
AN ALREADY AUTHORITATIVE ACTIVE STATE MAY PERSIST
UNDER A GOVERNED TRANSITION CONTRACT
```

两者并不矛盾。

## 2.2 Amendment-16

PR #3153 已合并：

```text
PR #3153
MCFT-CAP-09: define persistent current-season lifecycle semantics
merge SHA:
80c45add8ae96d58ac2b4f090cae8229752efdb7
```

冻结三层状态模型：

```text
season_lifecycle = {
  domain_state:
    NOT_ESTABLISHED | ACTIVE | TERMINATED,

  authority_status:
    RESOLVED | UNRESOLVED | CONFLICTED,

  authority_validity:
    VALID | EXPIRED
}
```

关键规则：

```text
provider silence does NOT establish lifecycle
provider silence does NOT refresh observation
provider silence does NOT terminate lifecycle

persistent ACTIVE creates no new provider observation
persistent ACTIVE does not rewrite event_time
persistent ACTIVE does not refresh biological freshness

support events do not renew horizon
horizon may truncate persistence
horizon may never create ACTIVE

phenology/GDD/FAO stage may not establish crop existence
lifecycle, stage and Kc remain separate authority axes
```

A01–A17 自动验收全部 PASS。

尤其保留：

```text
NONE_FOUND
!=
PROVED_NO_TERMINATION_OCCURRED
```

---

# 3. T3R1 为什么替代 T1R1 成为当前 Formal completion target

这是本对话做过一次专门复核后的结论，不是 sunk-cost decision。

## 3.1 T1R1 的优点

T1R1 更适合作为长期 conventional reference：

```text
historical Formal site wiring already exists
whole scope simpler
Conventional treatment
less awkward than T3 prairie-strip geometry
```

因此：

> T1R1 仍是更好的长期参考/历史 Formal predecessor。

## 3.2 但 T1R1 当前不能快速完成 MCFT-9

真正 blocker 不是 lifecycle，而是 scalar Kc。

当前冻结 stage authority 下：

```text
T1R1 allowed stage set = {MID, LATE}
MID Kc = 1.15
LATE Kc = 0.60
```

所以：

```text
legal Kc set = {1.15, 0.60}
```

不能合法产生一个 scalar Kc。

T1R1 bounded thermal/GDD rescue 也已经明确失败：

```text
KBS bounded GDD:
1714.626 – 1828.917

conservative LATE-safe threshold:
2608
```

NOAA cross-validation证明 thermal trajectory 很可信，但无法产生 unique four-stage authority。

因此 T1R1 剩下的是：

```text
epistemic / natural-evidence blocker
```

不是代码 blocker。

## 3.3 T3R1 的优势

T3R1：

```text
same KBS MCSE
same 2026 corn season
same hybrid Pioneer P0306Q
planting = 2026-05-20
```

在冻结六套 FAO maize-grain stage-length variant、完整 planting-time uncertainty、T-6h 和 T+30h guard 下，形成 unique：

```text
stage = MID
Kc = 1.15
```

并且合并 successor authority 时仍有 >=24h contiguous legal window。

因此 T3R1 剩余问题是工程 rebind，而不是等待自然生育进程。

最终决策：

```text
MCFT-9 current completion target = T3R1
T1R1 = preserved historical Formal predecessor / long-term reference
```

禁止把历史 T1R1 evidence/canonical state 重标成 T3R1。

---

# 4. T3R1 lifecycle 已完成

PR #3154 已合并：

```text
PR #3154
MCFT-CAP-09: adopt T3R1 persistent current-season lifecycle on exact main
merge SHA:
4e84011e380333b2c0c56f2481661d44284a2f4e
```

live exact-main qualification：

```text
establishment:
KBS AgLog observation #6966
2026-05-20
corn / Pioneer P0306Q
T3 scope with R1 applicability

continuity support:
#7100
2026-07-01
Herbicide Application

known termination:
NONE_FOUND

known contradiction:
NONE_FOUND

provider completeness proven:
false

provider silence used as evidence:
false

horizon end:
2026-11-17T03:59:59.999Z

horizon creates ACTIVE:
false

lifecycle:
domain_state = ACTIVE
authority_status = RESOLVED
authority_validity = VALID
authority_mode = GOVERNED_PERSISTENT_STATE
```

重要：

```text
ACTIVE
```

在这里表示：

> 根据截至 authority evaluation 可合法消费的 authoritative transition set，managed-season authoritative state 为 ACTIVE。

不表示：

> GEOX 已经证明现实中绝对没有发生未记录 harvest。

---

# 5. T3R1 crop-only geometry 已完成

T3 的 whole plot 不能直接当 corn polygon，因为 central prairie strip 存在。

旧 #3147 是早期 proof；真正 current-main adoption 是 #3155。

```text
PR #3155
MCFT-CAP-09: adopt T3R1 crop-only geometry on current main
merge SHA:
868d3e6b6bcc9af12f7a1866a39061ea92d5c190
```

保守 crop-only subzone：

```text
construction:
BILINEAR_INTERIOR_RECTANGLE_FROM_PROVIDER_MAIN_QUADRILATERAL_V1

short-axis fractions:
0.15 – 0.30

long-axis fractions:
0.25 – 0.75

semantic hash:
sha256:4672b5f28484a05e00d93de8c53b9c7b2bdbcc250f48959a4b85b768d2ed3f3a

area:
693.022 m²

minimum center-strip clearance:
15.116 m

minimum outer-boundary margin:
13.17 m

minimum end-boundary margin:
26.049 m
```

必须保留：

```text
whole T3R1 plot assumed crop-only = false
prairie strip excluded = true
prairie-strip WKT invented = false
raw/derived coordinates emitted publicly = false
```

---

# 6. Sentinel / NOAA 路线做了什么，以及为什么已经退出 critical path

## 6.1 NOAA GDD

独立 NOAA station：

```text
GHCND:USW00014815
BATTLE CREEK KELLOGG AIRPORT
~15.2 km
```

exact common-day cross-validation：

```text
common valid days = 85
KBS cumulative GDU = 1628.235
NOAA cumulative GDU = 1621.500
delta = 6.735 GDU = 0.415%
daily mean bias = +0.079 GDU/day
MAE = 0.809
RMSE = 1.053
correlation = 0.98761
```

结论：

```text
KBS thermal trajectory strongly corroborated
```

但：

```text
authority_effect = NONE for lifecycle/stage/Kc
```

不再投入。

## 6.2 Sentinel-2

CDSE OAuth/Statistics/Catalog 坑已跑完。

真正 strict clean T3R1 optical history：

```text
2026-07-30:
clear land = 1
vegetation / clear land = 1
mean NDVI = 0.8226154446601868
PASS

2026-08-01:
cloud / no clear land
FAIL

2026-08-04:
cloud / no clear land
FAIL

2026-08-09:
cloud / no clear land
FAIL

2026-08-14:
thin cirrus / no strict clear land
FAIL
```

所以最近 strict positive direct optical anchor = 2026-07-30。

不能从 7/30 optical observation + 后续 cloud silence 直接建立 current lifecycle。

## 6.3 Sentinel-1

exact T3R1 crop-only SAR discovery：

```text
2026-07-31 S1C ASCENDING:
coverage 1.0
VV -11.153 dB
VH -15.672 dB
VH/VV 0.353229

2026-08-12 S1C ASCENDING:
coverage 1.0
VV -10.620 dB
VH -14.272 dB
VH/VV 0.431354

2026-08-13 S1D ASCENDING:
coverage 1.0
VV -8.518 dB
VH -15.440 dB
VH/VV 0.203110
```

7/31→8/12 是 same-repeat-viewing-geometry candidate：

```text
same mission S1C
same sensing clock
12 day spacing
absolute orbit difference 175
```

但 SAR mapping adjudication正确停止在：

```text
structural continuity candidate
```

而不是：

```text
crop present
no harvest
lifecycle ACTIVE
phenology
Kc
```

PR #3151 / #3152 仍是旧-base Draft/open，不是当前 critical path，也不应直接 merge。

---

# 7. T3R1 Formal successor authority 已完成

PR #3156 已合并：

```text
PR #3156
MCFT-CAP-09: qualify T3R1 Formal successor authority
merge SHA:
52885f0353ab0258388cd518aa9e27e3189a7826
```

Amendment-17 / V2 authorities：

```text
site:
KBS_MCSE_T3R1

field:
field_kbs_mcse_t3r1

season:
season_2026_corn

zone:
zone_kbs_mcse_t3r1_crop_formal_v1

crop:
corn

hybrid:
Pioneer P0306Q

planting observation:
6966

planting local date:
2026-05-20

crop-only geometry hash:
sha256:4672b5f28484a05e00d93de8c53b9c7b2bdbcc250f48959a4b85b768d2ed3f3a
```

focused proof re-derived：

```text
stage = MID
Kc = 1.15
>=24 contiguous legal hourly targets at qualification boundary
```

T1R1 V1 site/reality/crop authorities仍保留为 immutable historical predecessor。

---

# 8. Runtime atomic rebind 已完成

## 8.1 为什么不能只改 field_id

active consumer 不止一个：

```text
external_formal_runtime_config_v1.ts
external_formal_bootstrap_authority_bundle_v1.ts
EA5E2 crop consensus
live-window viability
full-chain preflight
dependency graph
current-main activation boundary guard
```

若只改 runtime config，会制造：

```text
docs = T3
runtime = T1
```

或：

```text
runtime = T3
bootstrap authority = T1
```

这种 authority split。

## 8.2 historical gate routing repair

旧 EA5B3 / EA5D1 workflow 有 exact historical base assertion。

新 T3 successor PR 触发它们时会在真实 compatibility test 前先被旧 authority base 拒绝。

不能把旧 base 改成新 base，否则篡改历史 qualification。

因此 PR #3159 做了 exact-file-set routing repair：

```text
PR #3159
merge SHA:
0498a9529b6cb79ba0ab8e55d1b9a8b7d479a3ba
```

只对 exact 8-file T3 runtime-rebind boundary：

```text
historical authority gate = non-applicable
```

但仍真实执行：

```text
EA5B3 runtime compiler/resolver/CAP04 compatibility
EA5D1 isolated PostgreSQL bootstrap compatibility
```

EA5D1 isolated compatibility 已证明：

```text
exact hourly runtime configs = 24
exact total runtime configs = 25
canonical facts = 34
idempotent retry writes = 0
provider requests = 0
Formal Neon writes = 0
```

## 8.3 #3158 runtime rebind

PR #3158 已合并：

```text
PR #3158
MCFT-CAP-09: rebind active Formal runtime scope to T3R1
merge SHA:
b6f2883789d48aeed717263f8fb43152fd34c57e
```

当前 active runtime scope 已切到：

```text
tenant_id = tenant_mcft_external
project_id = project_mcft_cap09
group_id = group_public_research
field_id = field_kbs_mcse_t3r1
season_id = season_2026_corn
zone_id = zone_kbs_mcse_t3r1_crop_formal_v1
```

bootstrap authority pins 已切到：

```text
Formal Site Authority V2
Formal Reality Binding V2
Formal Crop Context Authority V2
Fresh Formal Database Preflight V2
```

T1R1 historical authority/data仍保留，禁止 cross-scope stitching。

#3158 合并前：

```text
dependency graph PASS
missing = 0
uncovered = 0
successor runner PASS
live-window hardening PASS
EA5B3 compatibility PASS
EA5D1 isolated bootstrap compatibility PASS
CI PASS
Delivery Policy PASS
Main Ruleset PASS
```

因此 active runtime rebind 已经不是当前 blocker。

---

# 9. Fresh Formal DB V2 authority — 当前最关键文件

仓库已冻结：

```text
docs/digital_twin/mcft/cap_09/
GEOX-MCFT-CAP-09-EA5A-FRESH-FORMAL-DATABASE-PREFLIGHT-V2.json
```

目标 database identity：

```text
provider = NEON_POSTGRES
project_id = delicate-glade-62464340
branch_id = br-cold-dust-a6j6aymz
database_name = geox_mcft_cap09_s6_formal_t3r1_24h
connection_secret_name = GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL
```

明确禁止：

```text
simulation branch:
br-falling-cake-a6lfsdak

reuse old T1 Formal DB as T3 storage:
geox_mcft_cap09_s6_formal_24h

copy T1 canonical rows into new T3 DB
cross-scope canonical stitching
```

qualification sequence：

```text
1. CREATE_DISTINCT_EMPTY_DATABASE_WITHOUT_COPYING_T1R1_CANONICAL_ROWS
2. APPLY_REQUIRED_SCHEMA_ONLY
3. RUN_READ_ONLY_ZERO_STATE_PREFLIGHT
4. BIND_SECRET_TO_EXACT_DATABASE_IDENTITY
5. ONLY_THEN_AUTHORIZE_T3R1_FRESH_BOOTSTRAP
```

zero-state requirement至少包括：

```text
facts = 0
twin_lineage_v1 = 0
twin_state_estimate_v1 = 0
twin_forecast_v1 = 0
twin_runtime_checkpoint_latest_index_v1 = 0
twin_shadow_online_scheduler_slot_v1 = 0
T1R1 scope rows = 0
T3R1 rows before bootstrap = 0
```

---

# 10. Neon 当前真实拓扑与最新权限状态

这是对话结束前最新工作，下一对话必须从这里继续。

## 10.1 已验证 project / branch / DB

V2 authority target：

```text
project:
delicate-glade-62464340

primary branch:
br-cold-dust-a6j6aymz
```

最新只读 topology：

```text
databases already present on authoritative branch:
postgres
neondb
geox_mcft_cap09_s6_formal_24h   # OLD T1R1 Formal DB

expected T3 target:
geox_mcft_cap09_s6_formal_t3r1_24h

latest existence check:
TARGET DOES NOT EXIST
```

这正好满足 fresh-create 前置条件。

## 10.2 旧 T1 Formal DB 绝不能复用

旧 Formal DB 已被只读核验：

```text
facts = 60
60/60 are T1R1 scope
```

并已有：

```text
lineage
state
forecast
checkpoint
lease / scheduler/runtime state
```

所以：

```text
new Neon branch cloned from old DB
!=
fresh zero-state T3 DB
```

也不能 truncate old T1 DB 后假称它从来是 fresh T3。

正确方式是保留 T1 history，创建 distinct empty T3 database。

## 10.3 admin role

Neon connector 对 management `postgres` database 查询返回过 404。

这不是 Neon project 故障；只是 connector 不能直接把该管理库作为该接口查询 target。

改用已有 Formal DB 读取 admin role 后已确认：

```text
role = neondb_owner
CREATEDB = true
CREATEROLE = true
```

因此权限能力本身没有 blocker。

## 10.4 当前正卡在哪

最新 UI 截图显示：

```text
Neon Postgres permission prompt
```

内容意图：

```text
执行 SQL，创建 database:
geox_mcft_cap09_s6_formal_t3r1_24h
```

用户尚需点击：

```text
允许一次
```

当前必须按：

```text
DATABASE NOT YET PROVEN CREATED
```

处理。

### 特别注意“临时分支”字样

权限 UI 文案提到：

```text
在 Neon 的临时分支上为项目执行 SQL
```

而 V2 authority 冻结的是：

```text
branch_id = br-cold-dust-a6j6aymz
```

所以下一步绝对不能：

```text
用户点允许
=> 直接宣布 target DB ready
```

必须：

```text
允许
→ tool actual SQL success
→ re-list project/branch/database topology
→ prove DB identity is on authoritative branch or otherwise legally maps to it
```

如果 connector 只在临时 branch 创建 database：

```text
DO NOT continue bootstrap
```

先裁决如何在 authoritative branch 创建，或是否需要独立 authority amendment。

---

# 11. Schema bootstrap 已经研究到什么程度

仓库没有一个现成的远程 dispatch：

```text
"create new Formal database and initialize everything"
```

但仓库有正式 migration implementation：

```text
runSqlMigrations()
```

它按照：

```text
apps/server/db/migrations/*.sql
```

对空 database 做 current-main schema bootstrap。

已经确认的原则：

```text
DO NOT hand-copy 40+ table DDL
DO NOT CREATE DATABASE ... TEMPLATE old_formal_db
DO NOT copy T1 canonical rows
```

Fresh DB V2 authority 本身只要求 runtime 核心 schema preconditions，不要求复制旧 Formal DB 全部 41 张表的历史内容。

标准 one-shot bootstrap 路线应复用 repository migration runner：

```text
empty target DB
→ current-main runSqlMigrations()
→ required runtime schema
→ read-only zero-state proof
```

仓库还存在对 legacy/CAP07 visibility migration 与 runtime ACL 重申的已有处理；下一对话应复用正式 runner，而不是自己发明 migration order。

下一对话需要继续找/复用：

```text
migration one-shot CLI / executable entry
```

如果没有直接 CLI，建立最窄 temporary/bootstrap invocation；不要手工 SQL migration-by-migration。

---

# 12. 数据链可行性预判 — 已经做过，不要再盲目研究

本对话在进入 rebind 前专门做过一次“是否值得继续”的预判。

结论：

```text
T3R1 -> Formal rebind -> fresh bootstrap -> EA5E2
= high-probability feasible
```

工程判断约：

```text
current legal window 内取得一次 EA5E2 GO:
~80% engineering estimate
```

不是统计概率，而是 risk assessment。

## 12.1 已经不是风险的部分

```text
T3R1 planting/crop/hybrid = resolved
T3R1 lifecycle = ACTIVE/RESOLVED/VALID
T3R1 crop-only geometry = resolved
T3R1 MID/Kc = resolved at qualified boundary
KBS five-family parsing = proven
CAP04 real five-family consumption = proven
signed ET0 consumer seam = fixed
soil T-15 phase = proven compatible
GFS pgrb2+sflux 72h path = previously proven and current availability looked healthy
runtime rebind = now merged
```

## 12.2 仍然最值得注意的 live risk

KBS Raw Hourly：

```text
observation cadence = hourly
publication behavior = CONFIRMED DAILY BATCH
~24 hourly observations per publication
```

不能再把它当 hourly publication provider。

EA5E2 target 必须 phase-aware，不能 blind exact-hour dispatch。

production freshness authority仍保留：

```text
<=6h
```

engineering validation和 production authority 必须分开。

## 12.3 soil timing

已经证明：

```text
T-15 / source minute :45
PROVEN_COMPATIBLE
observed lag ≈ 5.47 / 5.59 min
within derived 10 min budget
```

而：

```text
T-10 / :50
T-5 / :55
```

不兼容。

不要重新做 cadence research。

---

# 13. 本对话关闭的重要工程问题

不要重新打开，除非出现新反证。

## 13.1 KBS hourly observation != hourly publication

KBS Raw Hourly operating behavior：

```text
DAILY_BATCH
```

一次推进约 24h observations。

## 13.2 event_time != available_to_runtime_at

历史 batch observations 不得回写成当时已可用。

## 13.3 signed ET0

canonical Evidence 保留 signed value。

只有 model consumption seam：

```text
model_water_loss_demand_mm = max(canonical_signed_et0_mm, 0)
```

## 13.4 evidence_snapshot_time migration

已完成，不要重新打开。

## 13.5 KBS five-family -> CAP04 real-data path

已真实 PASS，不要再说“KBS 还没测试完成”。

## 13.6 lifecycle persistent semantics

已由 Amendment-16 解决。

不要退回：

```text
没有 fresh crop observation
=> lifecycle automatically UNRESOLVED
```

## 13.7 T1R1 scalar-Kc rescue

当前不是最短路径。

T1R1 保留历史 reference，但 MCFT-9 completion target 已明确选择 T3R1。

## 13.8 Sentinel/NOAA critical path

已经退出 critical path。

有新 observation 可以作为 corroboration，但不得阻塞 zero-state DB / bootstrap。

---

# 14. 本对话踩过的坑 — 必须避免

## 14.1 provider silence != lifecycle evidence

但：

```text
provider silence does not erase an already-authoritative persistent state
```

不要把这两个规则混成一个。

## 14.2 lifecycle horizon != positive evidence

180-day EA1J max envelope：

```text
truncation guard only
```

不是：

```text
crop must be alive for 180 days
```

support event 也不得续 horizon。

## 14.3 whole-page AgLog text classification 会被 UI 污染

KBS observation detail page chrome/global options里存在 `Harvest` 等词。

不能对整页 body 做 termination regex。

后来修为只消费 structured：

```text
Comment
Areas
Observation Type
```

并做 scope fail-closed。

## 14.4 datatable 694 是错误 provider surface

一度尝试 expanded-log datatable 694，确认不是当前 MCSE transition surface。

已经禁用。

## 14.5 T3 scope string classifier 不能看到任意 "T3" 就算 T3R1

其他 experiment 文字会出现 `T3&4`。

合法 applicability必须依赖：

```text
Areas exact T3R1
or
parent T3/LTER T3 + explicit R1 inclusion
```

## 14.6 Sentinel Hub Catalog `Accept: application/json` 会 406

实测：

```text
A official-style no Accept => 200
B Accept: application/json => 406
C official-style + fields => 200
```

Catalog request不要再加那个 Accept header。

## 14.7 Sentinel-2 tile datetime spread不是 datatake identity

同一 datatake相邻 tile `properties.datetime` 可差约 14.6s。

不要再用 <=2s 判同一 acquisition。

正确 identity：

```text
mission + datatake start + relative orbit
```

## 14.8 SCL=7 不是 strict clear land

strict clear land：

```text
SCL in [4,5]
```

不要把 low-probability cloud/unclassified 算 clear。

## 14.9 scene cloud cover != exact plot clear fraction

必须 exact subzone + SCL/dataMask。

## 14.10 NDVI != phenology/Kc

高 NDVI 只能是 canopy/vegetation observation。

不能直接推 MID/LATE/Kc。

## 14.11 SAR不能直接建立 crop lifecycle

soil moisture / roughness / incidence / crop structure混杂很大。

S1C same-repeat continuity可 corroborate，不能自动推：

```text
no harvest
ACTIVE
stage
Kc
```

## 14.12 Sentinel-1 mission allowlist 曾过时

2026 window应接受正式 constellation：

```text
S1C
S1D
```

旧 `[ABC]` validator 会误拒 S1D。

## 14.13 exact-base historical workflow 不应被“更新到今天”

EA5B3 / EA5D1 historical exact-base gates是历史 authority proof。

新 successor boundary触发它们时，正确做法是 exact-file-set routing non-applicable，并继续执行 compatibility tests。

不能改历史 expected base。

## 14.14 dependency graph self-hash 会产生机械红灯

carrier变化后：

```text
missing=0
uncovered=0
```

但 digest mismatch仍会 fail。

正确顺序：

```text
先完成所有 upstream blob/pin 更新
再读 artifact expected digest
最后只回填 marker
```

否则会多跑一轮。

## 14.15 新 Neon branch != fresh database

如果从已有 T1 branch clone：

```text
new branch
```

也会继承 T1 rows。

不能把 branch freshness 和 DB zero-state混为一谈。

## 14.16 `CREATE DATABASE ... TEMPLATE old` 禁止

会复制 T1 schema + data/state，违反 no cross-scope stitching。

## 14.17 truncate old T1 DB != fresh T3 DB

T1 history必须保留。

Fresh T3是 distinct identity。

## 14.18 Neon permission UI != actual DB fact

必须在 approval 后重新查 topology。

尤其注意 UI 里的“临时分支”措辞与 authority frozen primary branch可能不是同一个 identity。

---

# 15. 旧/开放 PR 如何处理

## 15.1 #3143 — old handoff

```text
PR #3143
docs(mcft-cap09): refresh handoff for alternative crop-source frontier
base = 23f224c...
Draft / open
```

已经严重过时。

本 handoff 应 supersede #3143。

建议创建本次新的 docs-only Draft PR 后：

```text
close #3143 as superseded
```

不要让下一对话从 #3143 的 T1R1 Sentinel frontier 接手。

## 15.2 #3150 / #3151 / #3152

这些是旧-base Sentinel discovery/adjudication Draft PR。

它们记录有价值的 discovery，但不是当前 merge frontier。

不要直接 merge 到 current main。

可以后续统一 close/supersede，或保留为 diagnostic history。

## 15.3 #3160

```text
PR #3160
MCFT-CAP-09: wire current EA5E2 full-chain successor qualification
base = 0498a952...
Draft / open
```

它是 runtime rebind期间产生的两文件 control-plane wiring candidate。

当前 #3158 已经 merge，并且 current frontier 是 Fresh Formal DB。

因此 #3160 **不是当前 critical path**。

下一对话不要先去 merge #3160。

正确动作：等 zero-state DB / fresh bootstrap 靠近 full readiness时，再比较 current main 是否已经具备 #3160 所需 wiring；若已被 #3158/后续 main 等价吸收，则 close as superseded；若仍缺 exact trigger/wiring，再基于 current main重做，而不是直接 merge旧-base head。

---

# 16. 下一步必须怎么做

严格顺序：

## Step 1 — 完成 Neon permission-gated database creation

当前用户只需要在 UI：

```text
允许一次
```

但下一对话必须核实际执行结果。

SQL/创建原则：

```text
CREATE DISTINCT EMPTY DATABASE
NO TEMPLATE OLD_DB
NO T1 COPY
```

目标：

```text
geox_mcft_cap09_s6_formal_t3r1_24h
```

## Step 2 — re-read Neon topology

必须证明：

```text
database exists
correct project
correct authoritative branch identity
correct owner/admin semantics
```

若只在 temporary branch：停，不 bootstrap。

## Step 3 — schema-only bootstrap

复用 current-main：

```text
runSqlMigrations()
apps/server/db/migrations/*.sql
```

不要手抄 DDL。

不要复制旧数据库。

## Step 4 — zero-state proof

schema完成后、任何 fresh bootstrap前：

```text
facts = 0
lineage = 0
state = 0
forecast = 0
checkpoint = 0
scheduler slots = 0
T1 scope rows = 0
T3 scope rows = 0
```

另需验证 required runtime tables存在。

## Step 5 — bind exact secret

```text
GEOX_MCFT_CAP09_T3R1_S6_DATABASE_URL
```

必须确实指向 target DB，不要只复制旧 T1 secret。

## Step 6 — fresh T3R1 bootstrap

只在 zero-state proof PASS后执行。

禁止 cross-scope canonical stitching。

## Step 7 — exact-head full readiness blocker set

这是第一个硬发射门。

必须重新跑/读取 current-main exact-head：

```text
EA5E2 dependency graph
full-chain static preflight
successor runner qualification
crop consensus
live-window viability
fresh database preflight
bootstrap authority/currentness
```

如果：

```text
blocker_count = 0
```

立即判：

```text
GO
```

不要再扩展审计。

## Step 8 — target-specific live launch viability

GO之后才做一次真正 target-specific launch check：

```text
KBS daily batch phase viable
KBS production freshness <=6h
soil uses proven T-15 phase
GFS same-cycle pgrb2 + sflux 72h complete
crop MID/Kc still legal at target guard interval
```

PASS后直接启动 EA5E2。

不是：

```text
run 5 times and see which one passes
```

---

# 17. 什么情况下应该停止 T3R1 路线

用户和本对话已经明确避免 sunk-cost bias。

T3R1 当前被选中是因为：

```text
remaining risk is engineering / schedulable
```

而 T1R1 当前 risk是：

```text
stage/Kc natural-evidence ambiguity
```

但是 T3R1 也没有无限开发预算。

如果在：

```text
Fresh DB
→ bootstrap
→ exact full readiness
```

阶段出现一个新的、无法在当前合法 MID窗口内关闭的 substantive authority/provider blocker：

```text
STOP
```

不要围着 T3R1无限打补丁。

此时重新评估：

```text
T3R1 vs T1R1 vs alternative qualification target
```

当前没有看到这种 blocker。

---

# 18. 当前成功标准

短期成功：

```text
T3R1 zero-state Formal DB exists and is proven fresh
```

然后：

```text
fresh bootstrap PASS
```

然后：

```text
full readiness blocker_count = 0
```

最终：

```text
EA5E2 GO
```

Formal 24h successful execution后才进入后续 S6 closure。

当前仍不得声称：

```text
EA5E2 operational activation qualified
Formal O00-O23 started
MCFT-9 completed
```

截至本 handoff：

```text
Formal = 0/24
```

---

# 19. 下一对话推荐开场指令

可以直接用：

```text
接手 MCFT-9。先读 docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-15.md。
当前 protected main 应核到 b6f2883789d48aeed717263f8fb43152fd34c57e，#3158 已合并，active Formal runtime 已切 T3R1。
不要重新做 Sentinel/KBS crop authority research。
当前 frontier 是 T3R1 zero-state Formal DB。
先核 Neon permission prompt 的实际执行结果和 primary branch database topology；数据库只有在 br-cold-dust-a6j6aymz 上被证明存在且 zero-state 后才能做 schema bootstrap/fresh bootstrap。
随后按 Fresh DB V2 -> schema-only migrations -> zero-state proof -> secret binding -> fresh bootstrap -> exact-head full readiness blocker set 推进；blocker=0 直接 GO。
```

---

# 20. 最终一句话

这次对话已经把 MCFT-9 从：

> “为了证明今天田里还有玉米，不断找新的卫星/AgLog observation”

推进成：

> “用正确的 persistent lifecycle semantics 建立 T3R1 authority，完成 crop-only geometry、MID/Kc 和 active runtime atomic rebind；现在唯一主线是创建并证明一个真正 zero-state 的 T3R1 Formal database，然后 fresh bootstrap 并跑 full readiness。”

**下一对话不要重新研究作物存在性。继续把数据库和 launch gate做完。**
