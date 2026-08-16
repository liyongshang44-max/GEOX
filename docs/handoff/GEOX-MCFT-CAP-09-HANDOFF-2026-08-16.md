# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-16

Status: **CONVERSATION HANDOFF ONLY — NOT REPOSITORY AUTHORITY**

> 本 handoff 用于下一对话恢复 MCFT-CAP-09 / S6 / EA5E2→EA5E3 工程上下文。
>
> 它不制造新的 authority、effectiveness、EA5E3 authorization、Formal O00 start、scheduler start、provider authority、crop-stage authority 或 MCFT-CAP-09 completion claim。
>
> 权威顺序始终是：current Master Task Line / MCFT-CAP-09 Taskbook / effective Amendments → protected `main` → exact PR / workflow run / immutable artifact / Formal Neon state → 本 handoff。若冲突，以更高权威事实为准。

---

## 0. 下一对话只要先读这一节

当前唯一正确 frontier：

```text
T3R1_SUCCESSOR_FORMAL_DB_PREFLIGHT_AND_IMMUTABLE_WINDOW_INPUT_MANIFEST_V2
```

自然语言描述：

> 对已经选定、已经生成、已经正式持久化的 T3R1 successor 24h Runtime Config chain 做最后一次 Formal DB 只读 preflight，并冻结一个不可变 Window Input Manifest V2。这个 manifest 只绑定即将用于 24h Formal run 的精确输入集合；它不启动 scheduler，也不执行 O00。

当前 protected main：

```text
repository:
liyongshang44-max/GEOX

protected main:
2fade4617dadae81a779b80f35332545e817ff0a

latest critical merge:
PR #3192 — MCFT-CAP-09: persist T3R1 successor Runtime Config chain v2

#3192 head:
2402a95ce54b16610d0273974cc8b8bc7a0b2c58

#3192 merge SHA:
2fade4617dadae81a779b80f35332545e817ff0a

#3192 merged_at:
2026-08-16T08:20:53Z
```

当前 Formal Neon：

```text
project:
delicate-glade-62464340

branch:
br-cold-dust-a6j6aymz

database:
geox_mcft_cap09_s6_formal_t3r1_24h

scope:
tenant_id  = tenant_mcft_external
project_id = project_mcft_cap09
group_id   = group_public_research
field_id   = field_kbs_mcse_t3r1
season_id  = season_2026_corn
zone_id    = zone_kbs_mcse_t3r1_crop_formal_v1
```

当前 Formal DB 的已复核事实：

```text
total facts                         = 59
Runtime Config facts                = 49
successor Runtime Configs added     = 24
persisted A0 logical_time           = 2026-08-15T10:00:00Z
persisted A0 runtime_config_ref     = external_formal_runtime_config_49959a28cfc9eb357bf18f9d
persisted A0 runtime_config_hash    = sha256:5f11788fd049a3eae190d566e6faa28f428637e11f2c90b4e0aaea67e6f14e48
A0 changed                          = false
scheduler slots                     = 0
scheduler cursors                   = 0
Formal execution                    = 0/24
Formal window started               = false
EA5E3 authorized                     = false
MCFT-CAP-09 completed                = false
```

这正是当前预期状态：

```text
24 successor Runtime Configs = FORMAL PERSISTED FACTS
scheduler                     = NOT STARTED
Formal O00                    = NOT STARTED
execution                     = 0/24
```

选定 successor epoch 不需要重选：

```text
epoch_id:
mcft_cap09_external_formal_window_epoch_20260817t200000z_v2

O00:
2026-08-17T20:00:00Z

O23:
2026-08-18T19:00:00Z

selection effectiveness deadline:
2026-08-16T08:00:00Z

selection actually merged:
2026-08-16T07:40:52Z

EA5E3 readiness deadline:
2026-08-17T08:00:00Z
```

所以：

```text
selection deadline = ALREADY SATISFIED
selected epoch      = EFFECTIVE
current deadline    = EA5E3 readiness at 2026-08-17T08:00:00Z
```

不要因为 handoff 时间变化重新选 epoch，除非更高权威事实明确证明当前 epoch 已失效。

下一对话的第一件事：

1. 从 `main @ 2fade461...` 建独立 implementation branch。
2. 读取 #3190 / #3191 / #3192 的 effective authority 文件和 immutable proof identity。
3. 对 Formal Neon 做 **READ ONLY** preflight，确认：59 facts、49 configs、A0 原样、24 successor chain exact、scheduler 0/0、Formal 0/24、database identity exact。
4. 构建 `Window Input Manifest V2`，只冻结精确输入，不启动 scheduler。
5. manifest 必须至少绑定：
   - #3190 的 24 个 crop-context hashes；
   - #3191 的 24 个 Runtime Config refs/hashes；
   - persisted A0 ref/hash/logical_time；
   - Formal DB project/branch/database/six-key identity；
   - #3190/#3191/#3192 immutable predecessor proof identity；
   - selected epoch/O00–O23；
   - scheduler-zero / Formal 0/24 preflight state；
   - Amendment-11 temporal semantics。
6. 做 exact-head governance / focused workflow，fail-closed。
7. merge 后才进入 EA5E3 readiness / authorization；**不要在 manifest PR 里启动 O00。**

---

# 1. 这一整轮对话实际做了什么

本对话不是简单修了一个 CI。它完成了从“EA5E2 rolling activation 失败”到“successor 24h Formal window 的输入配置已经正式落库”的整条状态迁移：

```text
旧 handoff frontier:
EA5E2_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH

→ rehydration deterministic proof restored
→ Amendment-11 observer snapshot wiring corrected
→ runtime dependency graph rebound
→ protected-main full live activation PASS
→ exact-T KBS evidence metadata exported
→ EA5E2 operational activation evidence freeze merged
→ EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true
→ T3R1 current-season whole-window scan
→ earliest legal successor epoch selected
→ T3R1 successor Runtime Config pure builder qualified
→ exact 24 successor Runtime Configs append-only persisted
→ current frontier:
   T3R1 successor Formal DB preflight + immutable Window Input Manifest V2
```

所以当前问题已经完全不是：

```text
KBS fresh 不 fresh
rehydration 能不能过
observer 能不能跑
crop stage 有没有窗口
Runtime Config 能不能生成
Runtime Config 能不能写入
```

这些都已经越过。

当前问题是：

> 在真正允许 EA5E3 / Formal scheduler 开始之前，把这次 24h Formal run 将使用的精确输入集合冻结成一个可审计、可重放、不可漂移的 manifest。

---

# 2. 必须继续冻结的 FreshHour / Amendment-11 语义

这是整个 MCFT-9 当前最容易发生 semantic regression 的地方。下一对话不要重新讨论“是不是 6h 改成 24h/36h”。结论已经冻结。

## 2.1 KBS 的真实时序模型

```text
observation resolution = HOURLY
publication cadence    = DAILY_BATCH
```

KBS 是小时 observation，但 provider 每日批量发布约 24 条 hourly rows。

## 2.2 `<=6h` 仍然存在，但只作为 diagnostic

正确常量语义：

```text
HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS = 6
```

必须继续保持：

```text
freshness_is_late_authoritative_admission_gate = false
```

也就是说：

```text
age <= 6h
```

只能描述历史 online-freshness diagnostic，不能控制：

```text
late exact-T evidence authority
scheduler dispatch
EA5E2 / EA5E3 admission
```

## 2.3 late exact-T authority

当前 authority 是：

```text
PROVIDER_AVAILABILITY_WATERMARK_V1
+ same-source exact-T identity
+ exact interval identity
+ real provider availability / first-seen chronology
+ real retrieved_at / available_to_runtime_at / ingested_at
+ quality
+ raw-retention-first
+ duplicate/conflict fail-closed
+ no future leakage
+ no interpolation
+ no persistence fill
+ no source substitution
```

## 2.4 明确不是 `6h → 24h`

错误：

```text
authority_pass = age <= 6h
```

同样错误：

```text
authority_pass = age <= 24h
```

`24h` 只是 cadence engineering observation window，不是 KBS late-admission authority。

## 2.5 明确不是 `6h → 36h`

`36h` 在当前 successor 线里有两个合法角色：

```text
rolling candidate retention/expiry
successor epoch minimum selection lead
```

它不是：

```text
KBS freshness authority
```

不要出现：

```text
age <= 36h => evidence authoritative
```

## 2.6 禁止恢复旧 fixed-lag normative authority

Amendment-11 已经 supersede 这些旧值作为 normative authority：

```text
scheduler_eligibility_lag_hours = 7
late collector                  = T+06:30
exact evidence cutoff           = T+07:12
runtime observer                = T+07:17
```

它们可以作为历史诊断/旧证据记录存在，但不能再控制 current scheduler/observer/admission。

当前真实时间链必须由 actual execution / provider chronology 证明。

---

# 3. 旧 handoff 的 rehydration mismatch 是怎么被关闭的

旧 #3183 停在：

```text
EA5E2_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
```

这个 frontier 已经关闭，不能再从这里恢复。

## 3.1 PR #3184 — diagnostic，不放宽 semantic equality

```text
PR #3184
MCFT-CAP-09: diagnose current rolling rehydration mismatch

base:
d385f47286037cc0504c49c088861591a5699e3b

head:
7519f33fef50f0d4fe3e6bc7d6ce9f9ec34ad7f2

merge:
3b2dd78c6c57425ba031d28de2500da833765b9c
```

它只增加 family-only diagnostic：

```text
record_type
source_record_id
record_semantic_sha256
```

没有：

```text
relax equality
replace expected hash
provider refetch
Formal write
scheduler start
```

## 3.2 immutable producer candidate

关键 producer：

```text
artifact:
9246513491

producer SHA:
481f46358056abc592c9e5691d3463487261dafa

target T:
2026-08-15T12:00:00Z
```

调查中排除了：

```text
canonicalizer version drift
decoder version drift
T3R1 scope/config drift
captured_at / phase_canonicalized_at loss
major dependency version drift
```

standalone rehydration 在 protected main 上连续通过，证明当前代码并不存在持续性 semantic mismatch。

重要教训：

> 不能因为一次 rehydration mismatch 就改 canonical hash、做浮点 rounding 或降低 equality。先复现和证明真正漂移字段。

---

# 4. PR #3185：observer 必须使用 Amendment-11 actual evidence snapshot

full activation 后续第一处真实 blocker 转成 rolling observer。

PR #3185：

```text
MCFT-CAP-09: honor Amendment-11 snapshot in rolling observer

base:
3b2dd78c6c57425ba031d28de2500da833765b9c

head:
ab9d8c846ee01f9e3cc3fa359805968cdc528036

merge:
f2e31a6e18729e844e1779c22e0aa0001d83d1cf
```

根因：

> rolling observer 前半段已经按 Amendment-11 使用 actual execution evidence snapshot 读取 exact-five DB evidence，但后面误调用 historical fixed-lag CAP04 candidate seam，内部仍使用 legacy T+432 exact-interval cutoff，从而把本来已经合法的 exact rainfall row 又过滤掉。

修复：

```text
rolling observer
→ public Amendment-11 candidate execution seam
→ caller supplied evidence_snapshot_time
```

没有改 interval policy、source authority、semantic equality 或 persistence rule。

以后若 observer 又出现 exact-T evidence missing，第一检查点是：

```text
是否又绕回 fixed-lag / T+432 seam
```

而不是 FreshHour。

---

# 5. PR #3186：runtime dependency graph 的 EOF newline 坑

PR #3186：

```text
MCFT-CAP-09: rebind rolling runtime dependency graph after observer snapshot wiring

base:
f2e31a6e18729e844e1779c22e0aa0001d83d1cf

head:
ca37509f6593739212e5818f810de5c02f4079c4

merge:
5abab5d4936b7274ba461bbb3adde7d46c177b00
```

当时 runtime graph：

```text
93 paths
missing dependencies = 0
uncovered static paths = 0
manual live dispatch preserved
```

预期 digest：

```text
sha256:a6088259500f0b6b5db9d42bea19e27e3595ac38c4812d62c86534d95229c8a2
```

最容易误判的坑：

一开始看起来像“carrier 自引用 hash”，但仓库其实已经对 marker 做 self-normalization。

真正导致 digest 漂移的是：

```text
carrier EOF no-newline
→ 被无意改成 EOF newline
```

marker 会被 normalization 排除，但尾部字节不会。

所以以后 rebind runtime graph：

1. 不要随手用会自动追加 newline 的写法覆盖 carrier。
2. 先确认 marker normalization 已存在。
3. graph digest mismatch 不等价于 runtime logic mismatch。
4. 保持 carrier 的精确 EOF 字节形态。

关键成功证据：

```text
PR-head runtime dependency graph run:
31930633495 — PASS

PR-head successor qualification:
31930633457 — PASS

protected-main successor qualification:
31930995955 — PASS
```

---

# 6. EA5E2 full live activation 已经真正通过

在 `main @ 5abab5d...` 上，full live：

```text
run:
31931206958

result:
PASS
```

这不是 static qualification，而是真正穿过：

```text
exact-main
→ private bindings
→ Formal A0 snapshot
→ rolling intersection
→ immutable producer download
→ 3-family rehydration
→ exact-T KBS five-family canonicalization
→ exact-five isolated DB
→ actual observer
→ A1 disposition
→ COMPLETED forecast
→ 72 forecast points
```

但这次成功 run 暴露一个“证据包装”问题：

> runtime 成功不等于 evidence-freeze metadata 足够。

当时 five-family artifact 没导出：

```text
2 exact-T KBS record semantic hashes
shared private raw-retention receipt metadata
```

因此不能直接做 effectiveness freeze。

---

# 7. PR #3187：只补 evidence metadata，不改 runtime

PR #3187：

```text
MCFT-CAP-09: export exact-T KBS evidence-freeze metadata

base:
5abab5d4936b7274ba461bbb3adde7d46c177b00

head:
286aed7676f8677b6c74b31692cfaf63c26aba8e

merge:
5f7e534b2db41e1a6e8bc793d0fa5d87c1639289
```

只导出：

```text
2 exact-T KBS record semantic hashes
private restricted raw-retention receipt:
  digest
  bytes
  ref metadata
  retained_at
```

没有改变：

```text
provider authority
canonical semantics
freshness admission
scheduler
observer
Formal side effects
```

### runtime graph 再次需要 rebind

因为 five-family critical file 发生 metadata-only 改动，93-file graph digest 也变了。

新 digest：

```text
sha256:3c1c67159495705bd3018ff397d2f9020d88e660b57deaebb4ee2135cafde736
```

这次正确做法是：

```text
先让 graph gate 报真实 digest
→ 只改 carrier marker
→ 保持 EOF no-newline
```

---

# 8. 新 protected-main full live：run 31932747954

#3187 合并后重新做 full live，必须用新 protected main，而不是把旧 `31931206958` 当成新 metadata authority。

成功 run：

```text
workflow:
mcft-cap-09-ea5e2-rolling-operational-activation-live

run:
31932747954

subject:
5f7e534b2db41e1a6e8bc793d0fa5d87c1639289

trigger:
workflow_dispatch

result:
PASS
```

它重新通过：

```text
exact-main
A0 / scheduler-zero
rolling intersection
producer proof
rehydration
exact-T KBS enriched five-family
actual observer
A1
COMPLETED
72 points
```

并提供了 freeze 所需 exact-T KBS hashes / raw retention metadata。

重要：

> 如果需要证明当前 main 的 live 行为，必须 new dispatch exact main；不要 `Re-run` 一个旧 SHA 的 workflow run，然后把它冒充 current-main proof。

---

# 9. PR #3188：EA5E2 operational activation evidence freeze

PR #3188：

```text
MCFT-CAP-09: freeze EA5E2 operational activation evidence

base:
5f7e534b2db41e1a6e8bc793d0fa5d87c1639289

head:
0625843f4ecd2abe875494379fbaf01e8bba0288

merge:
68af52d1c6df8a32edad231e0425421ecfe31b4d

merged_at:
2026-08-16T07:12:24Z
```

它冻结：

```text
successful live run + artifact digest
exact-head successor qualification
immutable rolling producer artifact
exact-five semantic hashes
KBS/GFS/soil private-retention hash metadata
same-cycle GFS identity
single-T crop context hash
A1 / COMPLETED / 72-point CAP04 result
all forbidden side-effect counts = 0
```

Private R2 retention refs 没有直接公开，只冻结其 SHA-256。

最重要的 effectiveness：

```text
EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED = true
```

但 #3188 明确没有授权：

```text
EA5E3
Formal O00
successor epoch selection
MCFT-CAP-09 completion
```

所以从 #3188 起，EA5E2 已经结束；不要再把当前 frontier 叫 EA5E2 activation。

---

# 10. PR #3189：T3R1 whole-window scan V2

PR #3189：

```text
MCFT-CAP-09: scan T3R1 successor whole-window viability v2

base:
68af52d1c6df8a32edad231e0425421ecfe31b4d

head:
92eb820faec5e5f3cbce6a33478aff72c4427bcb

merge:
53cf1e48b7e105477e64c8b1e69afbb53e78be00

merged_at:
2026-08-16T07:23:27Z
```

focused proof：

```text
run:
31933393595

artifact:
9259939190

digest:
sha256:fea96c41d4690e1ddffbcdd1855642a3f31a6426743aa0cf6b260ac5d0d59014
```

结果：

```text
current season successor window exists = true
legal complete 24-slot MID candidates  = 75
```

最早候选：

```text
O00 = 2026-08-17T20:00:00Z
O23 = 2026-08-18T19:00:00Z
```

最晚完整当前季候选：

```text
O00 = 2026-08-20T22:00:00Z
O23 = 2026-08-21T21:00:00Z
```

这个结论非常重要，因为之前仓库里存在历史 T1R1 scanner 的：

```text
NO_CURRENT_SEASON_SUCCESSOR_EPOCH
```

那个结果只适用于旧 T1R1 planting authority，不能用于当前 T3R1。

**不要复用 T1R1 whole-window scan result。**

当前 T3R1 authority：

```text
site_id              = KBS_MCSE_T3R1
hybrid_product_code  = P0306Q
planting window      = 2026-05-20T04:00Z .. 2026-05-21T04:00Z
all selected slots   = MID
backward stability   = 6h
forward guard        = 30h
```

---

# 11. PR #3190：最早合法 T3R1 successor epoch 已正式选择

PR #3190：

```text
MCFT-CAP-09: select earliest legal T3R1 successor epoch v2

base:
53cf1e48b7e105477e64c8b1e69afbb53e78be00

head:
2489319aed5cea9a5cbf3844bbe8c5921b3f6df0

merge:
c268d3ff037a01fee51061bc82daeda9309d6e85

merged_at:
2026-08-16T07:40:52Z
```

selection：

```text
epoch:
mcft_cap09_external_formal_window_epoch_20260817t200000z_v2

O00:
2026-08-17T20:00:00Z

O23:
2026-08-18T19:00:00Z

minimum lead:
36h

selection effectiveness deadline:
2026-08-16T08:00:00Z

EA5E3 readiness deadline:
2026-08-17T08:00:00Z

all slots:
MID

minimum forward-guard clearance across window:
75h
```

selection authority path：

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json
```

其中已经冻结完整 24 个 crop context hash：

```text
O00 hash = sha256:a4f6ae8753073ceb7d87207f86a95a3ca7cfd4d8591467c3c1fcf5f465ce300f
...
O23 hash = sha256:0d124ad03deb26f427f1edad0e4bf991b4e9c67d739030e649d3f8c2a084ab13
```

下一步 manifest 不要手工重新生成另一套 crop-context list；直接以 #3190 effective authority 为 predecessor，并独立 re-verify hashes。

## #3190 的一个踩坑

focused gate 最初失败，但不是窗口失效。

根因：

> workflow 漏了 `EA5E3 readiness deadline = 2026-08-17T08:00Z` 的显式 fail-closed literal binding。

修复后：

```text
governance gate PASS
#3189 immutable scan proof PASS
24 crop context hashes independent recompute PASS
Formal Neon READ ONLY A0 PASS
scheduler slots/cursors = 0/0
```

以后不要把“focused gate 静态断言失败”立刻解释为 epoch 失效；先确认是 contract typo 还是事实层 failure。

---

# 12. PR #3191：T3R1 successor Runtime Config builder V2 已资格化

PR #3191：

```text
MCFT-CAP-09: qualify T3R1 successor Runtime Config builder v2

base:
c268d3ff037a01fee51061bc82daeda9309d6e85

head:
090a3c539e8830fac2fae71b33dd4f1abbe2cb8d

merge:
775c5e6f1f43666c9d4fe46e14b07abcb8cfc6d0

merged_at:
2026-08-16T07:53:50Z
```

focused proof：

```text
run:
31934715011

artifact:
9260304898

digest:
sha256:38f5d2cbd2d0ac169e8ac1ef4e709d2a16f37fbd252348dee03bee36123508c3
```

注意 digest 最后有一个 `3`，不要截断成：

```text
...123508c
```

这是后面 #3192 实际踩过的坑。

Builder V2 的边界：

```text
pure builder
no filesystem
no DB
no provider
no scheduler
no wall clock
no env
no persistence
```

输入：

```text
exact persisted T3R1 A0 canonical Runtime Config
+
#3190 frozen 24 crop-context hashes
```

focused acceptance 对 Formal Neon 只做 READ ONLY：

```text
persisted baseline Runtime Configs = 25
A0 exact                         = PASS
scheduler                         = 0/0
```

然后做：

```text
24-config chain build #1
24-config chain build #2
exact deterministic equality
canonical validation
exact parent ref/hash chain
exact slot/context hashes
persisted baseline collision = 0
```

builder qualification authority：

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-RUNTIME-CONFIG-BUILDER-QUALIFICATION-V2.json
```

#3191 本身不持久化 Runtime Config，也不授权 EA5E3/O00。

---

# 13. PR #3192：24 个 successor Runtime Config 已正式 append-only 持久化

PR #3192：

```text
MCFT-CAP-09: persist T3R1 successor Runtime Config chain v2

base:
775c5e6f1f43666c9d4fe46e14b07abcb8cfc6d0

head:
2402a95ce54b16610d0273974cc8b8bc7a0b2c58

merge:
2fade4617dadae81a779b80f35332545e817ff0a

merged_at:
2026-08-16T08:20:53Z
```

persistence authority：

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-RUNTIME-CONFIG-PERSISTENCE-V2.json
```

workflow：

```text
.github/workflows/mcft-cap-09-t3r1-successor-runtime-config-persistence-v2.yml
```

executor：

```text
scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_PERSISTENCE_V2.ts
```

governance gate：

```text
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_PERSISTENCE_V2.cjs
```

## 13.1 写入模型

它复用仓库已有 generic crash-safe append-only persistence service。

允许：

```text
only exact frozen 24 successor Runtime Config chain
append-only
verified contiguous prefix recovery
idempotent second pass
```

禁止：

```text
Evidence write
A0 rewrite
state write
lineage write
checkpoint write
forecast write
scheduler slot write
scheduler cursor write
provider request
raw object write
recommendation write
approval write
AO-ACT write
dispatch
model activation
```

## 13.2 预期 pristine transition

```text
facts:
35 → 59

Runtime Config:
25 → 49

successor configs:
+24
```

当前已实际复核为：

```text
facts          = 59
Runtime Config = 49
new successor  = 24
```

所以 persistence 已经完成，不要重做。

## 13.3 crash-safe prefix

如果历史 run 在写入中途失败，允许：

```text
verified_prefix = N
first pass writes = 24 - N
```

但必须满足：

```text
prefix contiguous
all existing refs/hashes exact match
no foreign selected-epoch config
no non-contiguous suffix
```

这也是以后遇到重试时不能“先删了再重写”的原因。

## 13.4 #3192 的两个实际坑

### 坑 1：builder artifact digest 少最后一位

最初新 authority/gate/workflow 把：

```text
sha256:38f5d2cbd2d0ac169e8ac1ef4e709d2a16f37fbd252348dee03bee36123508c3
```

误写成少最后一个 `3` 的 digest。

结果：

```text
immutable builder proof step fail
DB preflight not reached
persistence not executed
```

这是好的 fail-closed。

修复只改 artifact identity，不改 DB/persistence 规则。

教训：

> GitHub artifact digest 必须逐字符复制/验证；不要肉眼截断长 SHA-256。

### 坑 2：READ ONLY preflight fail 必须先证明具体断言

第二轮失败发生在：

```text
READ ONLY Formal DB preflight
```

并且 persistence step 被 skip，所以仍零写入。

处理原则：

```text
先读真实 DB inventory
→ 判断 identity/count/A0/scheduler/prefix/range 哪条不成立
→ 不猜
→ 不放宽 preflight
```

最终 #3192 合并前已经把数据库恢复/证明到精确预期，并完成 append-only persistence。

---

# 14. 当前 Formal 数据库到底代表什么

现在数据库里有：

```text
原 fresh bootstrap / A0 chain
+
24 个 selected successor Runtime Config facts
```

但：

```text
A0 仍是 pre-window current state authority
```

A0 没有因为“写入未来 Runtime Config”而向前跳。

当前 A0：

```text
logical_time:
2026-08-15T10:00:00Z

ref:
external_formal_runtime_config_49959a28cfc9eb357bf18f9d

hash:
sha256:5f11788fd049a3eae190d566e6faa28f428637e11f2c90b4e0aaea67e6f14e48
```

这是正确的：

> successor Runtime Config 是未来 24h Formal slots 的 frozen configuration facts，不是已经执行出的 Twin state。

所以绝对不要：

```text
把 latest Runtime Config 当 current A0 state
修改 A0 logical_time
提前生成 O00 state
把 config persistence 误判成 Formal execution
```

---

# 15. 当前 frontier：Formal DB preflight + immutable Window Input Manifest V2

下一阶段的目的不是再构建 config，而是冻结“Formal 24h run 到底允许消费什么”。

建议 frontier ID：

```text
S6-T3R1-SUCCESSOR-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST-V2
```

如果仓库已有更具体命名，以 existing Taskbook / authority 命名优先。

## 15.1 Manifest V2 必须包含的最小输入集合

### A. selected epoch identity

```text
epoch_id = mcft_cap09_external_formal_window_epoch_20260817t200000z_v2
O00      = 2026-08-17T20:00:00Z
O23      = 2026-08-18T19:00:00Z
24 slots = O00..O23 hourly
```

### B. #3190 crop-context authority

不要复制旧 T1R1 crop context。

来源：

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json
```

冻结：

```text
slot_id
logical_time
crop_stage_code = MID
crop_stage_context_hash
```

24 条必须 exact。

### C. #3191 Runtime Config builder proof

必须绑定 immutable #3191 proof：

```text
PR #3191
head 090a3c539e8830fac2fae71b33dd4f1abbe2cb8d
merge 775c5e6f1f43666c9d4fe46e14b07abcb8cfc6d0
run 31934715011
artifact 9260304898
digest sha256:38f5d2cbd2d0ac169e8ac1ef4e709d2a16f37fbd252348dee03bee36123508c3
```

Manifest 至少冻结：

```text
24 Runtime Config refs
24 Runtime Config determinism hashes
exact parent ref/hash chain
```

### D. #3192 persistence proof / database state

必须证明这 24 个 refs/hashes 已经真的存在于 Formal DB，而不是只存在 artifact。

预期：

```text
facts = 59
configs = 49
selected successor count = 24
```

并且 selected epoch range 内：

```text
foreign Runtime Config count = 0
missing selected Runtime Config count = 0
hash mismatch count = 0
```

### E. persisted A0

```text
logical_time:
2026-08-15T10:00:00Z

runtime_config_ref:
external_formal_runtime_config_49959a28cfc9eb357bf18f9d

runtime_config_hash:
sha256:5f11788fd049a3eae190d566e6faa28f428637e11f2c90b4e0aaea67e6f14e48
```

A0 ref/hash/time 必须原样。

### F. Formal DB identity

```text
project  = delicate-glade-62464340
branch   = br-cold-dust-a6j6aymz
database = geox_mcft_cap09_s6_formal_t3r1_24h
```

加 six-key scope exact match。

### G. predecessor proof chain

Manifest 需要 pin：

```text
#3190 selection authority / merge proof
#3191 builder qualification / run / artifact
#3192 persistence authority / merge / postflight proof
```

如果 manifest 还依赖 #3188/#3189，可以向上 pin，但不要把整个历史 PR 链无意义地全部重复一遍；关键是能证明 input lineage。

### H. pre-start invariants

Manifest PR / focused gate 必须确认：

```text
scheduler slots = 0
scheduler cursors = 0
Formal execution = 0/24
Formal window started = false
EA5E3 authorized = false   // 在 manifest merge 前
provider request count = 0 // manifest/preflight itself
DB write count = 0         // manifest/preflight itself
raw write count = 0
canonical runtime write count = 0
```

### I. Amendment-11 temporal authority

继续冻结：

```text
PROVIDER_AVAILABILITY_WATERMARK_V1
freshness_is_late_authoritative_admission_gate = false
```

不要在 Manifest V2 里重新引入：

```text
age <= 6
age <= 24
age <= 36
fixed T+432
T+06:30
T+07:12
T+07:17
```

作为 admission/scheduler authority。

---

# 16. 推荐的下一步实现顺序

下一对话建议严格按以下顺序，避免再扩散范围。

## Step 1 — exact-main read-only Formal preflight

从：

```text
main @ 2fade4617dadae81a779b80f35332545e817ff0a
```

开始。

先只读证明：

```text
database identity exact
facts = 59
configs = 49
A0 exact
24 selected configs exact
scheduler = 0/0
Formal = 0/24
```

如果这里失败：

> 停，不做 manifest effectiveness，不做 scheduler，不做 EA5E3。

## Step 2 — pure Window Input Manifest V2 builder

建议做 deterministic pure builder：

输入只来自：

```text
#3190 effective selection authority
#3191 immutable builder proof
#3192 persisted DB inventory proof
persisted A0
Formal DB identity
```

输出：

```text
24-slot immutable input manifest
```

builder 不碰：

```text
provider
DB write
scheduler
wall clock
R2 write
runtime execution
```

## Step 3 — focused exact-head qualification

focused workflow：

1. exact base/main pin；
2. predecessor immutable proof pin；
3. Formal DB READ ONLY preflight；
4. recompute/verify 24 crop-context hashes；
5. verify 24 persisted config refs/hashes；
6. verify A0；
7. verify scheduler zero；
8. verify deadline；
9. emit metadata-only manifest proof。

## Step 4 — PR + all required gates

仍保持：

```text
focused MCFT gate
Delivery Policy
Main Ruleset
build/typecheck/selfcheck
generic acceptance
Commercial MVP0 release gate
```

不要因为 `2026-08-17T08:00Z` deadline 临近而绕过仓库 release policy。

如果真的错过 EA5E3 readiness deadline：

> fail closed，重新裁决当前 epoch 是否仍合法；不要硬启动。

## Step 5 — manifest merge 后才做 EA5E3 readiness/authorization

manifest merge ≠ O00 start。

下一 authority 应明确分开：

```text
Window Input Manifest effective
→ EA5E3 readiness qualified
→ EA5E3 authorization
→ scheduler start / Formal O00
```

不要把 3 个状态压在同一 PR 里，除非 Taskbook 已明确允许。

---

# 17. 当前选定 epoch 的 deadline 语义

这两个 deadline 不要混：

```text
selection effectiveness deadline:
2026-08-16T08:00:00Z
```

这是：

```text
O00 - 36h
```

#3190 已经在 `07:40:52Z` 合并，所以它已经满足，不再是 current blocker。

当前真正要守：

```text
EA5E3 readiness deadline:
2026-08-17T08:00:00Z
```

这是：

```text
O00 - 12h
```

不要把它解释成：

```text
KBS freshness deadline
scheduler must start time
provider publication time
```

它是 successor Formal readiness/authorization 的 governance deadline。

---

# 18. 不要重新打开的旧 frontier

下一对话不要再投入时间到以下问题，除非 protected main / live fact 出现新反证。

## 18.1 不要重新研究 KBS 是 hourly 还是 daily

已经冻结：

```text
observation = hourly
publication = daily batch
```

## 18.2 不要重新把 FreshHour 当 authority

已关闭。

## 18.3 不要重新做 T3R1 Formal DB creation

DB 已存在并被持续使用。

## 18.4 不要重做 fresh bootstrap / A0

A0 已 persisted 且仍是 current pre-window state authority。

## 18.5 不要重新调查 rolling rehydration semantic mismatch

当前 rehydration 已多次 exact PASS，且 full activation 已完成。

## 18.6 不要重新跑 old T1R1 whole-window scanner

当前是 T3R1/P0306Q authority。

## 18.7 不要重新选 epoch

当前 epoch #3190 已有效并已在 selection deadline 前合并。

除非 current authority 因新事实 fail-closed，否则继续 O00 `2026-08-17T20:00Z`。

## 18.8 不要重建 24 successor Runtime Config

#3191 已资格化，#3192 已正式持久化。

## 18.9 不要提前启动 scheduler

当前：

```text
slots=0
cursors=0
```

这是正确状态，不是“还没做完所以要赶紧启动”。

当前先完成 manifest + EA5E3 readiness。

---

# 19. 这一路最重要的工程坑

## 19.1 semantic hash mismatch 不能靠放宽 equality 修

正确顺序：

```text
immutable producer
→ actual rehydrator
→ expected/actual semantic tuple
→ field/family-level proof
→ narrow fix
```

错误：

```text
round floats without authority
replace expected hash
warn-only
skip mismatch
```

## 19.2 actual evidence snapshot 和 historical fixed lag 不要混

Amendment-11 observer 不能悄悄绕回 legacy T+432 seam。

## 19.3 runtime dependency graph carrier 的 EOF newline 会改 digest

这是非常隐蔽但已经真实发生过的坑。

## 19.4 evidence packaging 是正式 effectiveness 的一部分

runtime PASS 但 artifact 缺关键 metadata，不能直接宣布 effectiveness。

## 19.5 GitHub artifact digest 不要手抄漏字符

#3192 已真实发生：SHA-256 少最后一个 `3`，immutable-proof fail。

## 19.6 GitHub workflow log 有时只返回 `exit 1`

这种情况下：

```text
不要猜错误
```

优先：

```text
check-run annotations
immutable artifact
workflow metadata
Neon READ ONLY inventory
fail-closed diagnostic artifact
```

## 19.7 static gate failure 不等于事实 authority failure

#3190 初次 failure 是 workflow 漏 deadline literal，不是 epoch 不合法。

先分清：

```text
contract bug
vs
real DB/authority failure
```

## 19.8 old run 不能冒充 new protected-main run

merge 后如果需要 runtime effectiveness，必须 new exact-main dispatch。

## 19.9 current-main drift 每个关键 PR 前都要重核

尤其：

```text
base SHA
head SHA
artifact subject SHA
workflow run head_sha
```

不要把 PR-head 绿灯当 protected-main 证明。

## 19.10 Formal DB persistence 是 append-only，不是 mutable config table

successor config 已成为 facts。

不要 delete/rewrite 以“清理”。

---

# 20. 当前 authority / 文件索引

下一对话至少要直接读这些 current-main 文件。

## Temporal / Amendment

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md
```

## EA5E2 effectiveness freeze

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-EVIDENCE-FREEZE-V1.json
```

## T3R1 crop authority

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json
```

## Whole-window scan

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-WHOLE-WINDOW-SCAN-V2.json
```

## Selected epoch + 24 crop context hashes

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json
```

## Runtime Config builder qualification

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-RUNTIME-CONFIG-BUILDER-QUALIFICATION-V2.json
```

## Runtime Config persistence

```text
docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-RUNTIME-CONFIG-PERSISTENCE-V2.json
```

## Builder implementation

```text
apps/server/src/domain/twin_runtime/external_formal_window_epoch_rebase_bundle_v2.ts
scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_BUILDER_V2.ts
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_BUILDER_V2.cjs
```

## Persistence implementation

```text
scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_PERSISTENCE_V2.ts
scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_T3R1_SUCCESSOR_RUNTIME_CONFIG_PERSISTENCE_V2.cjs
.github/workflows/mcft-cap-09-t3r1-successor-runtime-config-persistence-v2.yml
```

---

# 21. 关键 PR / merge 演进链

从旧 #3183 frontier 往后：

```text
#3184 diagnose rolling rehydration mismatch
merge 3b2dd78c6c57425ba031d28de2500da833765b9c

#3185 honor Amendment-11 snapshot in rolling observer
merge f2e31a6e18729e844e1779c22e0aa0001d83d1cf

#3186 rebind runtime dependency graph
merge 5abab5d4936b7274ba461bbb3adde7d46c177b00

#3187 export exact-T KBS evidence-freeze metadata
merge 5f7e534b2db41e1a6e8bc793d0fa5d87c1639289

#3188 freeze EA5E2 operational activation evidence
merge 68af52d1c6df8a32edad231e0425421ecfe31b4d

#3189 scan T3R1 successor whole-window viability v2
merge 53cf1e48b7e105477e64c8b1e69afbb53e78be00

#3190 select earliest legal T3R1 successor epoch v2
merge c268d3ff037a01fee51061bc82daeda9309d6e85

#3191 qualify T3R1 successor Runtime Config builder v2
merge 775c5e6f1f43666c9d4fe46e14b07abcb8cfc6d0

#3192 persist T3R1 successor Runtime Config chain v2
merge 2fade4617dadae81a779b80f35332545e817ff0a
```

这条链描述了当前事实演化，不要跳回中间节点继续开发。

---

# 22. 关键 live / focused runs

必须知道的少数 run：

```text
31928115749
old rolling activation failure
frontier at old handoff = rehydration semantic mismatch

31928996304
standalone rehydration exact-main PASS
证明 current rehydrator 可 exact reproduce frozen candidate

31930633495
runtime dependency graph PASS

31930633457
PR-head successor qualification PASS

31930995955
protected-main successor qualification PASS

31931206958
first complete protected-main full live activation PASS
但 evidence packaging 尚不够 freeze

31932747954
post-#3187 enriched full live PASS
用于 #3188 evidence freeze

31933393595
T3R1 whole-window scan V2 PASS
artifact 9259939190

31934715011
T3R1 Runtime Config builder V2 PASS
artifact 9260304898
```

不要无目的重跑这些历史 run。

---

# 23. 当前不允许做什么

在 `Window Input Manifest V2` / EA5E3 readiness 生效前，禁止：

```text
create scheduler slots
create scheduler cursors
start Formal O00
write O00 Twin state
write O00 lineage/checkpoint/forecast as if execution occurred
perform provider fetch for manifest construction unless explicit authority says so
change persisted A0
replace successor Runtime Config facts
change selected epoch
claim 1/24 execution
claim EA5E3 authorized
claim MCFT-CAP-09 completed
```

manifest/preflight 阶段应该是：

```text
READ ONLY DB
immutable predecessor proof reads
pure manifest construction
metadata-only artifact
zero runtime side effects
```

---

# 24. 下一对话的 GO / NO-GO 规则

## GO to manifest candidate

只有全部成立：

```text
protected main == expected exact base
Formal DB identity exact
facts == 59
configs == 49
24 selected successor refs/hashes exact
A0 unchanged
scheduler == 0/0
Formal execution == 0/24
#3190 proof valid
#3191 proof valid
#3192 persistence effective
current time < EA5E3 readiness deadline
```

才允许：

```text
build/freeze Window Input Manifest V2
```

## NO-GO

任何一个出现：

```text
foreign selected-epoch config
missing successor config
hash mismatch
A0 changed
scheduler slot/cursor > 0 before authorization
Formal execution > 0 before authorization
DB identity drift
protected-main drift not incorporated
predecessor artifact expired/unverifiable
readiness deadline missed
```

则：

```text
FAIL CLOSED
```

先裁决事实，不要启动 scheduler。

---

# 25. 当前状态的一句话定义

> **MCFT-CAP-09 已经完成 EA5E2 operational activation qualification，并为选定的 T3R1/P0306Q 当前季窗口冻结、生成并正式持久化了 24 个 successor Runtime Config；当前尚未授权 EA5E3 或启动 Formal O00。唯一正确下一 frontier 是对 `main @ 2fade461...` 的 Formal DB 做只读 preflight，并构建 immutable Window Input Manifest V2，以在 `2026-08-17T08:00Z` readiness deadline 前完成 EA5E3 前置资格。**

---

# 26. handoff 自身的治理状态

本文件：

```text
CONVERSATION HANDOFF ONLY
NOT REPOSITORY AUTHORITY
```

它应该单独存在于 docs branch / Draft handoff PR，不应该为了更新 handoff 而制造 protected-main drift，尤其当前存在 EA5E3 readiness deadline。

旧 handoff PR #3183 已停在错误 frontier：

```text
EA5E2_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
```

应标记为 superseded，下一对话不要从 #3183 恢复。
