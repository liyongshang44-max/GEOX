# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-16

Status: **CONVERSATION HANDOFF ONLY — NOT REPOSITORY AUTHORITY**

> 本 handoff 用于下一对话恢复 MCFT-CAP-09 工程上下文。它不制造新的 authority、effectiveness、activation、Formal write、crop-stage、database、scheduler、EA5E2 GO 或 MCFT-CAP-09 completion 权限。
>
> 权威顺序：current Master Task Line / MCFT-CAP-09 Taskbook / effective Amendments → protected `main` → exact workflow run / immutable artifact / Formal Neon topology → 本 handoff。若冲突，以更高权威事实为准。

---

## 0. 下一对话先读这一节

当前唯一正确 frontier：

```text
EA5E2_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
```

不是：

```text
KBS <=6h freshness
KBS daily-batch publication research
future-T long-horizon waiting
crop-stage ambiguity
T1R1/T3R1 scope selection
Formal A0 bootstrap
Formal DB creation
scheduler start
O00-O23 execution
```

当前仓库基线：

```text
repository:
liyongshang44-max/GEOX

protected main:
d385f47286037cc0504c49c088861591a5699e3b

latest critical merge:
PR #3182 — MCFT-CAP-09: reject cross-scope rolling producer candidates
merge SHA:
d385f47286037cc0504c49c088861591a5699e3b

current activation orchestration:
ROLLING_PREBOUNDARY_BATCH_INTERSECTION

future-T long-wait activation authority:
false

fixed T+432 normative authority:
false

<=6h freshness late-admission authority:
false

Formal execution:
0/24

EA5E2 operational activation effectiveness:
NOT YET PROVEN

Formal O00:
NOT STARTED
```

当前最重要的 live run：

```text
workflow:
mcft-cap-09-ea5e2-rolling-operational-activation-live

run:
31928115749

subject SHA:
d385f47286037cc0504c49c088861591a5699e3b

conclusion:
FAILURE

first substantive failure:
MCFT_CAP09_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
```

失败前已经 PASS：

```text
static-contract
exact protected-main boundary
successor V3 exact-head qualification
private bindings
T3R1 Formal A0 + scheduler-zero read-only snapshot
crop-legal rolling KBS intersection discovery
selected immutable T3R1 producer candidate download
```

失败后没有继续执行：

```text
exact-T KBS rainfall + historical ET0 / exact five
crop consensus
pre-observer current-main boundary recheck
DB-only observer
activation candidate proof freeze
```

下一对话第一动作不是重新 dispatch，而是：

1. 对 producer artifact `9246513491` 与 current rehydrator 做字段级 canonical semantic diff。
2. 证明 mismatch 属于 serialization、schema/version compatibility、transport-only metadata，还是实际语义差异。
3. 不得删除 semantic-hash equality、不得直接改 expected hash、不得把 mismatch 降级成 warning。
4. 修复后新增 deterministic immutable-producer rehydration pre-dispatch gate。
5. PR / exact-head qualification / merge 后新建 workflow dispatch；不要 Re-run `31928115749`。

---

# 1. 本轮任务是什么

本轮接手 MCFT-CAP-09 的目标仍是尽快完成 S6 / EA5E2 / Stage 1B：

> 用真实 KBS / GFS external evidence，在独立 T3R1 Formal scope 上证明同一 canonical Twin Runtime 可以进行真实 shadow-online 24h qualification；不创建第二套 Twin kernel，不伪造 provider 时间，不跨 scope 拼 canonical state，不用 replay/simulation 证据冒充 live Formal evidence。

本对话起点是 2026-08-15 handoff 的：

```text
T3R1_ZERO_STATE_FORMAL_DATABASE_CREATION_AND_QUALIFICATION
```

本轮已经推进为：

```text
zero-state T3R1 Formal DB
→ fresh T3R1 bootstrap
→ persisted A0 authority
→ exact-main timing requalification
→ Amendment-11 FreshHour / provider-watermark semantic correction
→ rolling pre-boundary capture
→ actual KBS daily-batch intersection
→ crop-legal oldest exact-T selection
→ T3R1 producer scope gate
→ current frontier:
   rolling candidate rehydration semantic equality
```

现在已经不是“有没有数据”的问题，而是：

```text
immutable producer artifact
→ retained raw evidence
→ current rehydrator
→ isolated DB
```

这一链路重新 canonicalize 后，semantic hash 还没有证明与 producer freeze 完全相同。

---

# 2. 已完成：独立 T3R1 zero-state Formal DB 与 fresh bootstrap

当前 Formal Neon：

```text
project:
delicate-glade-62464340

branch:
br-cold-dust-a6j6aymz

database:
geox_mcft_cap09_s6_formal_t3r1_24h

simulation branch reused:
false
```

Formal six-key scope：

```text
tenant_id  = tenant_mcft_external
project_id = project_mcft_cap09
group_id   = group_public_research
field_id   = field_kbs_mcse_t3r1
season_id  = season_2026_corn
zone_id    = zone_kbs_mcse_t3r1_crop_formal_v1
```

Fresh bootstrap 已实际完成。关键 persisted A0：

```text
ref:
external_formal_runtime_config_49959a28cfc9eb357bf18f9d

hash:
sha256:5f11788fd049a3eae190d566e6faa28f428637e11f2c90b4e0aaea67e6f14e48
```

Run `31928115749` 再次 read-only 复核：

```text
crop_a0_formal_scope_consistent = true
pointer_graph_validated          = true
scheduler_slot_count             = 0
scheduler_cursor_count           = 0
access_mode                      = READ_ONLY
transaction_mode                 = READ_ONLY
database_write_count             = 0
provider_request_count           = 0
formal_window_started            = false
```

结论：**不要重做 DB、bootstrap 或 A0。**

---

# 3. FreshHour / `<=6h` 语义变更——必须按这一版理解

这是本轮最容易被下一位接手者误读的地方，必须明确区分：

```text
observation resolution
publication cadence
online freshness diagnostic
late exact-T evidence authority
candidate retention / expiry
engineering attempt budget
```

它们不是同一件事。

## 3.1 KBS 的真实数据生产方式

已经确认：

```text
observation resolution = HOURLY
publication cadence    = DAILY_BATCH
```

也就是说，KBS 数据本身是一小时一条 observation，但 provider 不是每小时发布；它每天批量发布一段约 24 小时的 hourly rows。

因此：

```text
latest row age
```

主要描述“当前批次离现在有多久”，不能直接等价于“某个 exact historical interval 是否仍有 authority”。

## 3.2 旧逻辑错在哪里

旧路径曾把：

```text
latest KBS age <= 6h
```

当成 delayed exact-T evidence 的硬 authority / admission predicate，并出现过这类命名和逻辑：

```text
AUTHORITY_MAX_AGE_HOURS = 6
authority_pass = age <= 6h
scheduler_may_dispatch = authorityPass && ...
remaining_authority_headroom
```

这会产生一个错误结果：

> 同一条已经真实发布、same-source、exact-T、质量合法的 observation，只因为 wall clock 又过去了一段时间，就从 authoritative 变成 non-authoritative。

对 DAILY_BATCH provider 来说，这个 authority model 是错误的。

## 3.3 Amendment-11 后，6h 还保留吗？

保留，但角色彻底改变。

当前正确命名是：

```text
HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS = 6
```

当前 `MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE_V1.cjs` 已经明确输出：

```text
historical_online_freshness_diagnostic_pass
remaining_diagnostic_headroom_minutes
diagnostic_headroom_pass
diagnostic_only = true
evidence_admission_effect = false
scheduler_dispatch_effect = false
authority_effect = false
```

并且 cadence intelligence 本身明确：

```text
scheduler_dispatch_authority = false
scheduler_dispatch_decision = NOT_PROVIDED_BY_CADENCE_INTELLIGENCE
activation_readiness = NOT_DETERMINED_BY_CADENCE_INTELLIGENCE
cadence_intelligence_used_as_authority = false
```

所以现在的 6h 只回答：

> “按历史 online-freshness 视角，这批数据现在看起来新不新？”

它不回答：

> “这个 exact-T row 是否能被 late authoritative admission 接受？”

## 3.4 delayed exact-T authority 现在由什么决定

核心 authority 已改为：

```text
PROVIDER_AVAILABILITY_WATERMARK_V1
```

late exact-T admission 必须继续满足：

```text
same-source exact-T identity
exact interval identity
real provider availability / first-seen chronology
real retrieved_at / available_to_runtime_at / ingested_at
raw retained before canonicalization
valid quality
no duplicate ambiguity
no identity conflict
no future leakage
no interpolation
no persistence fill
no source substitution
```

关键布尔值：

```text
freshness_is_late_authoritative_admission_gate = false
```

这意味着：

```text
age > 6h
```

本身不能把一条已经被 provider-watermark 证明存在的 exact-T row 判成 non-authoritative。

## 3.5 这不是把 `6h` 改成 `24h`

这一点必须特别写死：

```text
OLD WRONG:
late authority = age <= 6h

ALSO WRONG:
late authority = age <= 24h

CURRENT:
late authority = provider availability watermark + exact-T semantic/causal checks
```

没有建立：

```text
24h production authority
24h late-admission authority
```

`ENGINEERING_OBSERVATION_WINDOW_HOURS = 24` 仍可能出现在 cadence intelligence 里，但它只是工程观察窗口，用于 provider cadence diagnostics / late classification，不是 evidence authority。

## 3.6 `candidate_retention_hours = 36` 也不是 FreshHour authority

rolling capture candidate 当前会带：

```text
candidate_retention_hours = 36
candidate_expires_at = ...
```

例如当前选中的 candidate：

```text
T = 2026-08-15T12:00:00Z
candidate_expires_at = 2026-08-17T00:00:00Z
```

这个 36h 是 immutable pre-boundary candidate 的保留/消费生命周期。

它表示：

> 这个 candidate artifact 允许被 rolling intersection / rehydration 消费到什么时候。

它不表示：

```text
KBS freshness authority = 36h
```

也不表示：

```text
age <= 36h => evidence authoritative
```

## 3.7 当前 PR / merge 链是怎么完成 FreshHour 纠正的

### PR #3176 — `honor Amendment-11 KBS freshness semantics`

完成 timing 路径第一步：

```text
<=6h hard gate
→ historical online-freshness diagnostic only
```

并把 timing target selection 改为：

```text
PROVIDER_AVAILABILITY_WATERMARK_V1
```

同时加入静态 guard，禁止重新出现：

```text
Number(value.latest_age_hours) > 6
```

这种 timing hard gate，也禁止回到 legacy freshness-gated late decoder。

### PR #3177 — `settle T3R1 EA5E2 successor V2`

把同一语义接回 current T3R1 successor / live chain：

```text
six_hour_freshness_role = HISTORICAL_ONLINE_DIAGNOSTIC_ONLY
six_hour_freshness_is_late_authoritative_admission_gate = false
```

并冻结成功的 exact-main Timing V2：

```text
workflow run = 31890174183
status       = PASS
collector max elapsed = 22290 ms
collector 2x safety   = 44580 ms << 1500000 ms budget
observer max elapsed  = 1368 ms
observer 2x safety    = 2736 ms << 300000 ms budget
Formal writes         = 0
scheduler writes      = 0
```

Timing V2 明确记录：

```text
provider_temporal_semantics.authority = PROVIDER_AVAILABILITY_WATERMARK_V1
publication_cadence                   = DAILY_BATCH
six_hour_freshness_role               = HISTORICAL_ONLINE_DIAGNOSTIC_ONLY
six_hour_freshness_is_late_authoritative_admission_gate = false
```

### PR #3179 — `restore Amendment-11 rolling EA5E2 orchestration`

进一步清掉残留 semantic debt：

```text
AUTHORITY_MAX_AGE_HOURS
status/field names implying 6h authority
scheduler dispatch semantics derived from freshness
```

当前 cadence intelligence 已明确使用 diagnostic terminology，并输出：

```text
scheduler_dispatch_authority = false
authority_effect = false
```

PR #3179 同时把最终 activation orchestration 恢复为 rolling capture + actual batch intersection，并把 #3178 long-horizon future-T path 降级为 engineering probe only。

### PR #3182 — `reject cross-scope rolling producer candidates`

#3182 处理的是 T1R1/T3R1 scope，不是 freshness。

它明确保持：

```text
<=6h diagnostic-only rule unchanged
```

所以不能因为 #3182 又出现新 selector，就误以为 FreshHour authority 被改回来了。

## 3.8 现在代码里看到这些字段时怎么解释

如果看到：

```text
provider_latest_age_hours
historical_online_freshness_diagnostic_le_6h
historical_online_freshness_diagnostic_pass
remaining_diagnostic_headroom_minutes
engineering_observation_window_hours
```

它们都是 observability / diagnostics / engineering planning 信息。

如果看到：

```text
freshness_is_late_authoritative_admission_gate = false
```

这才是当前 authority boundary 的关键声明。

如果未来有人重新引入：

```text
authority_pass = age <= 6
scheduler_may_dispatch = freshnessPass
late evidence rejected solely because age > 6h
```

应直接视为 Amendment-11 semantic regression。

## 3.9 当前 live run 的 age 只是旁证，不是 gate

Run `31928115749` 的 rolling intersection 恰好记录：

```text
provider_latest_timestamp = 2026-08-16T04:00:00.000Z
provider_latest_age_hours = 0.899444
historical_online_freshness_diagnostic_le_6h = true
freshness_is_late_authoritative_admission_gate = false
```

这次 intersection PASS 的关键不是 `0.899444 < 6`，而是：

```text
actual exact KBS intersection exists
crop legality passes
producer is exact T3R1 scope
candidate is unexpired
provider watermark semantics pass
```

下一次即使 diagnostic age > 6h，也不能仅凭 age 把 exact-T row 判死；必须按 provider-watermark / exact-T contract 重新判断。

---

# 4. Amendment-11 rolling orchestration 已恢复为最终主方案

#3178 一度引入：

```text
choose future T up to 24h ahead
→ T-20h
→ T-15h
→ T-10h
→ T-5h
→ T-175m
→ pre-boundary
→ predicted-batch late poll
```

它安全上 fail-closed，但重新依赖 predicted future-T / predicted batch timing。

最终裁决：

```text
#3178 long-horizon path = engineering probe only
```

当前 normative activation orchestration：

```text
rolling pre-boundary capture
→ retain causal candidates
→ detect actual KBS daily batch
→ exact KBS-T intersection
→ crop legality intersection
→ oldest eligible T
→ rehydrate original pre-T causal package
→ exact five
→ DB-only observer
→ metadata-only activation candidate proof
```

Run `31928115749` 的 exact-main boundary proof：

```text
final_activation_orchestration = ROLLING_PREBOUNDARY_BATCH_INTERSECTION
future_t_long_wait_activation_authority = false
fixed_t_plus_432_normative_authority = false
six_hour_freshness_late_admission_authority = false
```

---

# 5. fixed-lag / T+432 已降级为 engineering attempt budget

Amendment-07 旧的：

```text
T+06:30
T+07:12
T+07:17
```

不再是 normative evidence authority。

当前若代码仍有：

```text
T+407
T+432
T+437
```

只能表示：

```text
qualification_attempt_deadline
qualification_attempt_end
engineering processing reservation
runner budget
```

不能再解释为：

```text
frozen evidence cutoff
normative evidence cutoff
```

runner 超预算可以使“这一次 qualification attempt”失败，但不能让一个已经按 provider-watermark / exact-T contract 成立的 evidence 自动失去 authority。

---

# 6. rolling capture 的 T-5 结构缺口已修复

真实 failure 曾证明 shared provider runner 在 `T-5` 停止 soil poll，与 Amendment-11 causal boundary 不一致。

正确边界：

```text
soil observation identity ∈ [T-15m, T]
available_to_runtime_at <= T
ingested_at <= T
```

PR #3180 的正确修法：

```text
shared / Timing V2 runner:
保持历史行为，不为 rolling-only bug 改 blob

dedicated rolling pre-boundary runner:
允许 poll 到 T
```

仍然 fail-closed：

```text
available_to_runtime_at > T => reject
ingested_at > T            => reject
observation outside T-15..T => reject
```

以后不要为了 rolling-only 行为再修改 shared Timing V2 runner。

---

# 7. crop legality 必须先参与 intersection

旧 selector 曾经：

```text
先选 oldest exact KBS T
再看 crop 是否合法
```

这会让一个更老但 crop-illegal 的 T 挡住后面合法 T。

现在冻结：

```text
OLDEST_CROP_LEGAL_EXACT_TARGET_FIRST
```

即：

```text
retained candidate
∩ actual exact KBS-T
∩ crop legality
→ oldest eligible
```

current intersection proof：

```text
crop_authority_intersection_applied = true
crop_authority_effect               = NONE
future_crop_observations_used       = false
```

---

# 8. #3182：禁止 T1R1 producer 被 T3R1 consumer 消费

更早一次 live activation 选中了历史 T1R1 producer candidate。

candidate 的 exact-T / crop 本身可以合法，但 producer commit 当时的 Formal six-key scope 是：

```text
T1R1
```

current consumer 是：

```text
T3R1
```

Rehydration semantic equality 因 scope 不同正确失败。

根据 Amendment-17：

```text
No T1R1 fact, canonical state, forecast, runtime config,
database row, evidence artifact, or provider observation
may be relabelled as T3R1.

Cross-scope canonical stitching is forbidden.
```

PR #3182 没有削弱 semantic hash，而是在 selector 侧 fail-closed：

```text
对 producer SHA 读取 committed external Formal scope
只接受 exact T3R1 six-key producer
拒绝 T1R1 scope marker
```

#3182 已合并：

```text
merge SHA:
d385f47286037cc0504c49c088861591a5699e3b
```

post-merge selector 找到：

```text
T3R1 legal exact-T candidates = 10
```

当前选中：

```text
T                  = 2026-08-15T12:00:00.000Z
crop_stage         = MID
producer SHA       = 481f46358056abc592c9e5691d3463487261dafa
producer run       = 31881816156
producer artifact  = 9246513491
producer authority = T3R1_EXTERNAL_FORMAL_SCOPE_V1
candidate expires  = 2026-08-17T00:00:00.000Z
candidate digest   = sha256:6b5bd9a2bb48b2d8b9d4f904bbd00f200a82fc9fcb62163242a6d831fc6c9739
semantic manifest  = sha256:784be6f3f741dea1b8763309a39bb484b8f9143b3aec760f69a8e8096a1c010b
```

producer commit 已直接核验，其 six-key 确实是：

```text
field_kbs_mcse_t3r1
zone_kbs_mcse_t3r1_crop_formal_v1
```

不是 T1R1。

---

# 9. 当前最新 live run：31928115749

URL：

```text
https://github.com/liyongshang44-max/GEOX/actions/runs/31928115749
```

这是正确的新 dispatch：

```text
workflow_dispatch
branch  = main
subject = d385f47286037cc0504c49c088861591a5699e3b
```

## 9.1 已 PASS

```text
static-contract                                     PASS
exact protected-main + successor V3 exact-head    PASS
private secret bindings                            PASS
T3R1 Formal A0 / scheduler-zero read-only          PASS
rolling KBS intersection discovery                 PASS
immutable selected producer candidate download     PASS
```

Selected intersection：

```text
candidate_provenance_valid_count = 10
crop_legal_candidate_count       = 10
exact_kbs_intersection_count     = 10
provider_publication_cadence     = DAILY_BATCH
freshness gate                   = false
selected T                       = 2026-08-15T12:00:00.000Z
selected producer                = 481f46358056abc592c9e5691d3463487261dafa
```

## 9.2 first substantive failure

```text
Rehydrate original three pre-T evidence families into isolated DB
→ FAILURE

MCFT_CAP09_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
```

位置：

```text
scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts

exactSemanticMatch() ~ line 341
rehydrate() ~ line 405
```

失败 artifact：

```text
artifact id:
9258464958

artifact digest:
sha256:9aab7427358a558c8c0090451c0455dc667ff13d90ed9f0133058ef8eeaf05e8
```

该失败没有证明 exact-five / observer 已执行。

当前 side-effect 状态仍是：

```text
Formal A0 read only
scheduler slot/cursor = 0
Formal window started = false
no activation candidate proof
no O00 start
```

---

# 10. 当前 blocker 应如何诊断

不要重新改 freshness、crop、provider cadence 或 scope。

producer artifact `9246513491` 已冻结三条 expected semantic rows：

```text
future_et0_assumption_v1
future_weather_assumption_v1
soil_moisture_observation_v1
```

current rehydrator 会从 retained raw 重新 decode / canonicalize，再比较：

```text
record_type
source_record_id
record_semantic_sha256
```

当前 producer 已确认 T3R1，所以这次 mismatch 不应再简单归因于 T1R1/T3R1 scope。

优先排查：

```text
A. producer vs current canonical serialization
B. producer vs consumer semantic schema/version compatibility
C. transport-only metadata 是否被错误纳入 semantic hash
D. timestamp / null / omitted / number representation drift
E. current decoder 是否真的重建出不同语义
```

若是真实语义差异，应继续 fail-closed。

---

# 11. 必须新增 deterministic pre-dispatch gate

修复不能只让下一次 live run 偶然通过。

至少新增：

```text
known-good immutable T3R1 producer artifact
→ current rehydrator
→ isolated DB
→ exact semantic equality PASS
→ Formal writes = 0
→ scheduler writes = 0
```

并增加负向：

```text
known T1R1 producer => scope gate rejects before rehydration
semantic tamper     => hash mismatch fail-closed
representation drift fixture
```

这个 gate 应绑定 current dependency graph / exact-head successor qualification，使相同问题在 live dispatch 前被捕获。

---

# 12. #3181 状态

另有 Draft：

```text
PR #3181
MCFT-CAP-09: harden final rolling static audit surface
state = OPEN / DRAFT / UNMERGED
head  = d3babe8129e331867bab835b173c584a33630ab3
base at creation = 29feae18539ed8848c29b549f565489bf08d10aa
```

其方向包括：

```text
rolling planner / assembler / dedicated runner dependency graph binding
successor critical blob pinning
dedicated runner typecheck
legacy phase cleanup
permanent final rolling static audit
```

方向有价值，但 protected main 已前进到 `d385f472...`，且现在新增 rehydration blocker。

不要直接按旧 base 强行 merge #3181。

优先完成 current blocker，再决定：

```text
rebase/adjudicate #3181
或把仍有效 hardening 合入 blocker-fix successor
或若已被 main 覆盖则关闭 superseded
```

---

# 13. 下一步执行计划

## Phase A — 立即诊断 rehydration semantic mismatch

1. producer artifact `9246513491`。
2. run `31928115749` artifact `9258464958`。
3. producer SHA `481f463...` 当时的 builder / decoder / canonical semantic contract。
4. current main `d385f472...` 的 rehydrator / decoder / canonicalizer。
5. 做字段级 semantic diff。

## Phase B — 修复，但不得削弱 authority

允许：

```text
统一 canonicalization
显式 versioned compatibility adapter
selector 跳过明确 incompatible producer generation
修复错误纳入 semantic hash 的 transport-only fields
```

禁止：

```text
删除 semantic hash check
直接替换 expected hash
把 mismatch 改 warning
source substitution
interpolation
persistence fill
future leakage
cross-scope relabel
```

## Phase C — deterministic gate

将 immutable-producer rehydration 加入 pre-dispatch / exact-head successor path。

## Phase D — PR / merge / fresh dispatch

修复 PR 全绿后 merge。

然后新建：

```text
https://github.com/liyongshang44-max/GEOX/actions/workflows/mcft-cap-09-ea5e2-rolling-operational-activation-live.yml
```

branch：

```text
main
```

不要 Re-run `31928115749`。

## Phase E — live activation qualification

```text
rehydration
→ exact five-family evidence
→ target crop consensus
→ current-main boundary recheck
→ DB-only observer at actual evidence_snapshot_time
→ metadata-only activation candidate proof
```

## Phase F — 后续 Formal 24h

只有 live activation qualification 全 PASS 后，才进入 task authority 允许的 EA5E2 activation / freeze / O00。

在明确授权前：

```text
EA5E2 effectiveness != proven
Formal O00 != started
scheduler != started
```

MCFT-9 最终完成仍要求真实 24/24 O00→O23 + closure/effectiveness 证据。

---

# 14. 本轮踩过的坑，下一对话不要重复

## Pitfall 1 — static PASS 不等于 live PASS

多次 static / dependency / successor 能 PASS，但真实 provider / rehydration 仍可失败。

## Pitfall 2 — 把 `<=6h` 偷偷重新升格成 authority

禁止：

```text
authority_pass = age <= 6
scheduler_may_dispatch = freshnessPass
```

6h 只允许 diagnostic semantics。

## Pitfall 3 — 把 6h 改成 24h 或 36h

都不对。

24h 是 engineering observation window；36h 是 rolling candidate retention；它们都不是 KBS evidence authority。

## Pitfall 4 — 再走 predicted future-T long wait

#3178 只能作为历史 engineering probe，不是 current activation authority。

## Pitfall 5 — 把 T+432 再叫 frozen evidence cutoff

runner budget != evidence validity。

## Pitfall 6 — 为 rolling-only bug 修改 shared Timing V2 runner

会破坏 frozen timing blob；rolling-only 行为应留在 dedicated rolling runner。

## Pitfall 7 — dependency graph digest repin 太早

正确顺序：

```text
代码稳定
→ static acceptance
→ dependency graph
→ 最后 repin digest
```

## Pitfall 8 — required checks 还 running 就强 merge

不要绕 ruleset。

## Pitfall 9 — live run 期间改变 protected main

exact-main run 会被判 stale。

## Pitfall 10 — main 变化后点旧 run Re-run

Re-run 仍绑定旧 SHA / code；必须 new workflow_dispatch。

## Pitfall 11 — T1R1/T3R1 cross-scope stitching

Amendment-17 明确禁止。

## Pitfall 12 — crop legality 在 oldest selection 之后判断

必须先做 crop legality intersection。

## Pitfall 13 — rolling soil 在 T-5 提前停

rolling dedicated runner可 poll 到 T，但 available/ingested > T 仍 reject。

## Pitfall 14 — semantic mismatch 用“兼容”名义绕过去

当前 blocker 正是 semantic equality；必须定位差异来源。

## Pitfall 15 — 把 Node 20 warning 当当前 blocker

GitHub Actions 的 Node runtime warning 是 future hygiene，不是 run `31928115749` 的第一 substantive failure。

---

# 15. 当前不可更改的安全边界

```text
interval_start/end 必须 exact T
event_time 不得改写
available_to_runtime_at 必须真实
ingested_at 必须真实
no future leakage
no interpolation
no persistence fill
no source substitution
raw retention before canonicalization
same-source exact-T identity
provider-watermark late authority
FreshHour <=6h diagnostic only
no T1R1 -> T3R1 relabelling
Formal qualification path read-only until explicitly authorized
no scheduler start before authority
```

---

# 16. 下一对话短接手提示

```text
接手 GEOX MCFT-CAP-09。先读取：
docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-16.md

protected main:
d385f47286037cc0504c49c088861591a5699e3b

latest live run:
31928115749

不要重新研究 KBS freshness、future-T long wait、T1R1 crop authority 或 zero-state DB。

FreshHour 关键语义：
<=6h 只保留为 HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS；
freshness_is_late_authoritative_admission_gate=false；
不要改成 <=24h/<=36h authority；
late exact-T authority 走 PROVIDER_AVAILABILITY_WATERMARK_V1 + exact-T/causal/quality/raw-retention checks。

当前唯一 substantive blocker：
MCFT_CAP09_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH

先对 producer artifact 9246513491 / producer SHA 481f46358056abc592c9e5691d3463487261dafa 与 current rehydrator exactSemanticMatch() 做字段级 canonical semantic diff。

不得弱化 semantic hash gate。修复后加 deterministic immutable-producer rehydration pre-dispatch gate；PR/merge 后重新 workflow_dispatch rolling operational activation；不要 Re-run 31928115749。
```

---

## 17. 当前 handoff 自身信息

```text
handoff date:
2026-08-16

handoff branch:
docs/mcft-cap09-handoff-2026-08-16-rehydration-semantic-hash

handoff PR:
#3183 — docs(mcft-cap09): hand off rolling rehydration frontier

repository authority:
none

frontier:
EA5E2_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
```
