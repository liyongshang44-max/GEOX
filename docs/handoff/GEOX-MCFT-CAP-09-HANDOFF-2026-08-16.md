# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-16

更新时间：2026-08-16 13:12（UTC+8）

Status: **CONVERSATION HANDOFF ONLY — NOT REPOSITORY AUTHORITY**

> 本 handoff 用于下一对话恢复 MCFT-CAP-09 工程上下文。它不制造新的 authority、effectiveness、activation、Formal write、crop-stage、database、scheduler、EA5E2 GO 或 MCFT-CAP-09 completion 权限。
>
> 权威顺序仍是：current Master Task Line / MCFT-CAP-09 Taskbook / effective Amendments → protected `main` → exact workflow run / immutable artifact / Formal Neon topology → 本 handoff。若冲突，以更高权威事实为准。

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

这些问题要么已经完成，要么已被 Amendment-11 / Amendment-17 明确降级或禁止作为当前主线。

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

失败位置：

```text
scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts

exactSemanticMatch() ~ line 341
rehydrate() ~ line 405
```

这次失败前已经 PASS：

```text
exact protected-main boundary
successor V3 exact-head qualification
private bindings
T3R1 Formal A0 + scheduler-zero read-only snapshot
crop-legal rolling KBS intersection discovery
selected immutable producer candidate download
candidate target / producer SHA / no-Formal-side-effect checks
```

这次失败后没有继续执行：

```text
exact-T KBS rainfall + historical ET0 / exact five
crop consensus
pre-observer current-main boundary recheck
DB-only observer
activation candidate proof freeze
```

因此下一对话第一动作不是重新 dispatch，而是：

1. 下载并检查 run `31928115749` 的失败 proof / selected candidate。
2. 对照 producer artifact `9246513491` 的 candidate semantic manifest 与 current rehydrator 的 `exactSemanticMatch()`。
3. 证明 mismatch 是 canonicalization / representation / version compatibility 的哪一类问题。
4. **不得删除 semantic-hash equality、不得直接改 expected hash、不得把 mismatch 当 warning。**
5. 修复后新增 deterministic producer-artifact rehydration gate，使该类错误在 live dispatch 前被捕获。
6. PR + exact-head CI + merge 后，必须发起新的 workflow dispatch；不要 Re-run `31928115749`。

---

# 1. 本对话在做什么

本轮接手 MCFT-CAP-09 的目标是尽快完成 S6 / EA5E2 / Stage 1B：

> 用真实 KBS / GFS external evidence，在独立 T3R1 Formal scope 上证明同一 canonical Twin Runtime 可以进行真实 shadow-online 24h qualification；不创建第二套 Twin kernel，不伪造 provider 时间，不跨 scope 拼 canonical state，不用 replay/simulation 证据冒充 live Formal evidence。

本对话起点仍是 2026-08-15 handoff 的：

```text
T3R1_ZERO_STATE_FORMAL_DATABASE_CREATION_AND_QUALIFICATION
```

随后已经推进成：

```text
zero-state T3R1 Formal DB
→ fresh T3R1 bootstrap
→ persisted A0 authority
→ timing requalification
→ Amendment-11 freshness correction
→ rolling pre-boundary capture
→ actual KBS daily-batch intersection
→ crop-legal oldest exact-T selection
→ T3R1 producer scope gate
→ current frontier:
   rolling candidate rehydration semantic equality
```

所以现在问题已经非常窄：**不是“数据有没有”，而是 retained pre-T evidence 从 immutable producer artifact 重新 materialize 到 isolated DB 时，current rehydrator 计算出来的 semantic hash 与 producer candidate 冻结值不一致。**

---

# 2. 已完成：独立 T3R1 zero-state Formal DB 与 fresh bootstrap

T3R1 已经从“替代 scope 设计”进入真实独立 Formal state。

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

Fresh bootstrap 已经实际完成，重要状态曾独立核验为：

```text
facts_total          = 35
twin_facts_total     = 34
runtime_config_total = 25
checkpoint_total     = 1
scheduler_cursor     = 0
scheduler_slot       = 0
T1R1 fact count      = 0
```

Persisted A0：

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

# 3. 已完成：KBS `<=6h` 从 authority 降级为 diagnostic

这是本轮最重要的语义修正之一。

旧实现曾把：

```text
latest KBS age <= 6h
```

当成 delayed exact-T evidence 的硬准入条件，造成同一条 exact authoritative row 因为过了几分钟就从“合法”变“不合法”。这与已经确认的 KBS 实际生产方式矛盾：

```text
observation resolution = HOURLY
publication cadence    = DAILY_BATCH
```

Amendment-11 的正确语义已经恢复：

```text
<=6h = historical / online-freshness diagnostic only
```

Delayed authoritative admission 应依赖：

```text
PROVIDER_AVAILABILITY_WATERMARK_V1
+ same-source exact-T identity
+ exact interval identity
+ raw retained before canonicalization
+ real first_seen / retrieved / available / ingested chronology
+ valid quality
+ no duplicate / identity conflict
```

并且：

```text
freshness_is_late_authoritative_admission_gate = false
```

不能把修复写成：

```text
<=6h -> <=24h
```

这只是换魔法数字，仍是错误 authority。

真实 exact-main timing qualification 已经用 >6h 的 KBS evidence PASS，证明该修正不是文档声明。

Timing V2 实测大致为：

```text
collector max ~5.81 s       << 25 min budget
observer max  ~26 ms        << 5 min budget
Formal writes = 0
scheduler writes = 0
```

---

# 4. 已完成：Amendment-11 rolling orchestration 恢复为最终主方案

一度为了绕过 daily batch，#3178 引入过：

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

这个方案安全上 fail-closed，但它重新依赖 predicted future-T / predicted batch timing，与 Amendment-11 已冻结的首选 orchestration 不一致。

最终裁决：

```text
#3178 long-horizon path = historical engineering probe only
```

当前 normative activation orchestration：

```text
rolling pre-boundary capture
→ retain causal candidates (~36h)
→ detect actual KBS daily batch
→ exact KBS-T intersection
→ crop legality intersection
→ oldest eligible T
→ rehydrate original pre-T causal package
→ exact five
→ DB-only observer
→ metadata-only activation candidate proof
```

Run `31928115749` 的 exact-main boundary proof 已明确：

```text
final_activation_orchestration          = ROLLING_PREBOUNDARY_BATCH_INTERSECTION
future_t_long_wait_activation_authority = false
fixed_t_plus_432_normative_authority     = false
six_hour_freshness_late_admission_authority = false
```

---

# 5. 已完成：fixed-lag / T+432 语义清理

Amendment-07 旧的：

```text
T+06:30
T+07:12
T+07:17
```

已经不再是 normative evidence authority。

如果某个 qualification runner 为了 GitHub 成本仍使用：

```text
T+390
T+407
T+432
```

它们只能叫：

```text
qualification_attempt_start
qualification_attempt_deadline
engineering processing reservation
runner budget
```

不能再叫：

```text
frozen evidence cutoff
normative evidence cutoff
```

尤其不能因为 exact-T row 到得晚于 T+432 就断言 evidence 本身不 authoritative。一次 runner 超预算可以 fail，本次 qualification 可以重跑；evidence authority 不由该 runner budget 创造或消灭。

---

# 6. 已完成：rolling capture 的 T-5 结构缺口被隔离修复

曾出现真实 pre-boundary failure：共享 provider runner 在 `T-5` 停止 soil poll，但 Amendment-11 的真实 causal boundary 是：

```text
soil observation identity ∈ [T-15m, T]
available_to_runtime_at <= T
ingested_at <= T
```

第一版修复错误地直接修改 shared timing runner，结果使 Timing V2 exact blob 漂移，破坏既有 timing authority。

正确修法已经采用：

```text
shared / Timing V2 runner:
保持原样

dedicated rolling pre-boundary runner:
允许 poll 到 T
```

且仍 fail-closed：

```text
available_to_runtime_at > T => reject
ingested_at > T            => reject
observation outside T-15..T => reject
```

**以后不要为了 rolling-only 行为再改 shared Timing V2 runner。**

---

# 7. 已完成：crop legality 必须先参与 intersection

旧 selector 有一个 subtle bug：

```text
先找 oldest exact KBS T
再判断该 T crop 是否合法
```

这样一个较老但 crop-illegal 的 T 会挡住后面合法 T。

现在冻结为：

```text
OLDEST_CROP_LEGAL_EXACT_TARGET_FIRST
```

也就是：

```text
retained candidate
∩ actual exact KBS-T
∩ crop legality
→ oldest eligible
```

current intersection proof 明确：

```text
crop_authority_intersection_applied = true
crop_authority_effect               = NONE
future_crop_observations_used       = false
```

---

# 8. #3182：彻底修掉 T1R1 producer 混入 T3R1 consumer

在更早一次 live activation 中，selector 选中了历史较老 candidate；candidate 本身 exact-T / crop 都合法，但其 producer commit 当时 active Formal scope 仍是 T1R1。

Rehydration semantic equality 正确失败，因为 scope 是 canonical semantic record 的一部分。

根据 Amendment-17：

```text
No T1R1 fact, canonical state, forecast, runtime config,
database row, evidence artifact, or provider observation
may be relabelled as T3R1.

Cross-scope canonical stitching is forbidden.
```

PR #3182 没有削弱 hash，而是在 selector 侧 fail-closed：

```text
对每个 producer SHA 读取 committed external Formal scope
只接受 exact T3R1 six-key producer
拒绝含 T1R1 scope marker 的 producer
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
T                    = 2026-08-15T12:00:00.000Z
crop_stage           = MID
producer SHA         = 481f46358056abc592c9e5691d3463487261dafa
producer run         = 31881816156
producer artifact    = 9246513491
producer authority   = T3R1_EXTERNAL_FORMAL_SCOPE_V1
candidate expires    = 2026-08-17T00:00:00.000Z
candidate digest     = sha256:6b5bd9a2bb48b2d8b9d4f904bbd00f200a82fc9fcb62163242a6d831fc6c9739
semantic manifest    = sha256:784be6f3f741dea1b8763309a39bb484b8f9143b3aec760f69a8e8096a1c010b
```

producer commit 已直接核验，其 six-key 是 T3R1，不是 T1R1。

---

# 9. 当前最新 live run：31928115749

URL：

```text
https://github.com/liyongshang44-max/GEOX/actions/runs/31928115749
```

这是正确的新 dispatch：

```text
workflow_dispatch
branch = main
subject = d385f47286037cc0504c49c088861591a5699e3b
```

不要对旧 run 做 Re-run；main 变动后必须新 dispatch，避免旧 SHA/code 继续执行。

## 9.1 已 PASS 的部分

```text
static-contract                                     PASS
exact protected-main + successor V3 exact-head    PASS
private secret bindings                            PASS
T3R1 Formal A0 / scheduler-zero read-only          PASS
rolling KBS intersection discovery                 PASS
immutable selected producer candidate download     PASS
```

Selected intersection artifact 记录：

```text
candidate_provenance_valid_count  = 10
crop_legal_candidate_count        = 10
exact_kbs_intersection_count      = 10
provider_latest_timestamp         = 2026-08-16T04:00:00.000Z
provider_latest_age_hours         = 0.899444
provider_publication_cadence      = DAILY_BATCH
freshness gate                    = false
selected T                        = 2026-08-15T12:00:00.000Z
selected producer                 = 481f46358056abc592c9e5691d3463487261dafa
```

## 9.2 当前唯一 substantive failure

```text
Rehydrate original three pre-T evidence families into isolated DB
→ FAILURE

Error:
MCFT_CAP09_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
```

stack：

```text
exactSemanticMatch()
RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts ~341

rehydrate()
~405
```

失败 artifact：

```text
artifact id:
9258464958

artifact digest:
sha256:9aab7427358a558c8c0090451c0455dc667ff13d90ed9f0133058ef8eeaf05e8
```

该 artifact 至少包含：

```text
MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.json
MCFT_CAP_09_ROLLING_KBS_INTERSECTION.json
```

注意：因为 rehydration 在写完整 proof 前抛错，所以 artifact 很小。这是正常失败形状，不代表后面的 exact-five/observer 已经执行。

## 9.3 side-effect 状态

截至失败：

```text
Formal A0 read only
scheduler slot/cursor = 0
Formal window started = false
no activation candidate proof
no O00 start
```

所以可以安全修复后重新 qualification；不要做数据库清理式“补救”。

---

# 10. 当前 blocker 应如何诊断

不要先猜 KBS，也不要再改 crop / freshness / scope。

应直接比较：

```text
producer artifact 9246513491
  MCFT_CAP_09_ROLLING_PREBOUNDARY_CANDIDATE.json
  raw refs / semantic manifest

vs

current main d385f472...
  RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts
  exactSemanticMatch()
```

优先检查以下几类 mismatch：

### A. canonical serialization 不一致

例如：

```text
object key order
undefined vs omitted
null vs absent
number vs numeric string
ISO timestamp Z vs .000Z
array ordering
```

### B. producer 与 consumer semantic schema/version 不一致

producer `481f...` 生成 candidate 时的 canonicalization contract 可能与 current rehydrator 不完全一致。

如果是版本兼容问题，正确做法是显式 compatibility/version gate，而不是弱化 equality。

### C. transport metadata 被错误纳入 semantic hash

例如：

```text
retrieved_at
artifact path
run id
upload metadata
first_seen transport metadata
```

需要裁决哪些字段属于 evidence semantics，哪些只是 transport provenance；producer 与 consumer 必须使用同一 contract。

### D. rehydration 从 raw 重建出的 canonical family 与 producer 当时冻结的 canonical family 真有语义差异

如果是真差异，应继续 fail-closed。不要为了赶窗口放行。

---

# 11. 必须新增的防回归测试

本次修复不能只让 live run 偶然过。

应新增一个 deterministic gate：

```text
给定 immutable historical T3R1 producer candidate artifact
→ current rehydrator 在 isolated DB 重建
→ semantic hashes exact-equal
→ zero Formal writes
→ zero scheduler writes
```

最好至少覆盖：

```text
1. known-good T3R1 producer
2. known T1R1 producer => scope gate rejects before rehydration
3. semantic tamper => hash mismatch fail-closed
4. timestamp representation normalization fixture
5. payload ordering / null-omission fixture
```

这样下次 live dispatch 前就能发现同类 mismatch。

---

# 12. #3181 的状态与处理建议

另有 Draft：

```text
PR #3181
MCFT-CAP-09: harden final rolling static audit surface
state = OPEN / DRAFT / UNMERGED
head = d3babe8129e331867bab835b173c584a33630ab3
base at creation = 29feae18539ed8848c29b549f565489bf08d10aa
```

它修的是静态覆盖面：

```text
rolling planner / assembler / dedicated runner dependency graph binding
successor critical blob pinning
dedicated runner typecheck
legacy phase / workflow-name conditional cleanup
permanent final rolling static audit
```

这些方向是合理的，但现在 protected main 已前进到 `d385f472...`，并且当前出现新的 rehydration mismatch。

建议：

```text
不要直接按旧 base 强行 merge #3181。
```

下一对话先完成 rehydration blocker 修复，然后：

- rebase/adjudicate #3181 against current main；或
- 把仍有价值的静态 hardening 合入新的 blocker-fix PR；或
- 若全部已被后续 main 覆盖，则关闭并标 superseded。

核心原则：**不要为了“清 PR”制造新的 exact-main drift。**

---

# 13. 下一步执行计划

## Phase A — 立即诊断 semantic mismatch

1. 下载 producer artifact `9246513491`。
2. 下载/读取 run `31928115749` artifact `9258464958`。
3. 在 producer SHA `481f463...` 读取当时 candidate builder / canonicalizer / semantic hash contract。
4. 在 current main `d385f472...` 读取 rehydrator `exactSemanticMatch()`。
5. 做字段级 diff，确定 mismatch 是：
   - serialization；
   - schema/version；
   - transport metadata；
   - 或真实语义差异。

## Phase B — 修复，但不得削弱 fail-closed

允许：

```text
统一 canonicalization
补 versioned compatibility adapter
selector 跳过明确 incompatible producer generation
修复错误纳入 hash 的 transport-only fields
```

禁止：

```text
删除 semantic hash check
只比较部分 hash 但不定义 authority
把 mismatch 改 warning
直接替换 expected hash
跨 scope relabel
source substitution
interpolation
persistence fill
future leakage
```

## Phase C — 加 deterministic pre-dispatch gate

至少做到：

```text
selected T3R1 immutable candidate
→ current rehydrator
→ isolated DB
→ exact semantic equality PASS
```

并绑定 dependency graph / successor exact-head。

## Phase D — PR / merge / fresh dispatch

修复 PR 全绿后 merge。

然后必须新建 workflow dispatch：

```text
https://github.com/liyongshang44-max/GEOX/actions/workflows/mcft-cap-09-ea5e2-rolling-operational-activation-live.yml
```

branch：

```text
main
```

**不要 Re-run `31928115749`。**

## Phase E — live activation qualification 应按以下顺序完成

```text
rehydration
→ exact five-family KBS/GFS evidence
→ target crop consensus
→ current-main boundary recheck
→ DB-only observer at actual evidence_snapshot_time
→ metadata-only activation candidate proof
```

如果任何一步 fail：按第一 substantive failure 收敛，不要扩大审计范围。

## Phase F — EA5E2 effectiveness / Formal O00

只有 live activation qualification 全 PASS 后，才进入 task authority 允许的 EA5E2 activation/freeze。

在明确授权之前：

```text
EA5E2 effectiveness != proven
Formal O00 != started
scheduler != started
```

如果/当 O00 合法启动，后续是真实 24h：

```text
O00 → O23
```

不能 accelerated clock。

MCFT-9 最终完成仍要求真实 24/24 + closure/effectiveness 证据，不是 activation candidate PASS 就结束。

---

# 14. 本轮踩过的坑，下一对话不要重复

## Pitfall 1 — 把 static PASS 当 live PASS

多次 static-contract / dependency graph / successor 都能 PASS，但真实 provider / rehydration 仍可能失败。

结论：

```text
static PASS ≠ live runtime PASS
```

## Pitfall 2 — 把 `<=6h` 偷偷重新升格为 authority

不要再出现：

```text
authority_pass = age <= 6h
scheduler_may_dispatch = authorityPass && ...
```

6h 只允许 diagnostic naming。

## Pitfall 3 — 把 6h 改成 24h

这是错误修法。Delayed exact-T authority 不应由 age 魔法数字决定。

## Pitfall 4 — 再走 predicted future-T long wait

#3178 可保留历史工程探针，但不能成为最终 activation authority。

## Pitfall 5 — 把 T+432 再叫 frozen evidence cutoff

Amendment-11 已 supersede。runner budget 不等于 evidence validity。

## Pitfall 6 — 为 rolling-only bug 修改 shared Timing V2 runner

这会使 timing blob drift，导致既有 Timing Evidence V2 失效。

rolling-only 行为必须在 dedicated rolling runner 解决。

## Pitfall 7 — dependency graph digest repin 太早

critical file 每改一次，digest 可能漂移。

正确顺序：

```text
代码稳定
→ static acceptance
→ dependency graph
→ 最后 repin digest
```

## Pitfall 8 — required checks 仍 running 时强 merge

`mergeable_state=blocked` 不一定是实现 blocker，可能只是 required check 尚未结束。

不要为了赶时间绕 ruleset。

## Pitfall 9 — live run 期间改 protected main

exact-main qualification 会被主动判 stale。

除非明确决定废弃该 run，否则不要在关键 live run 中途 merge main。

## Pitfall 10 — main 已变化后点旧 run 的 Re-run

Re-run 仍会使用旧 SHA / 旧 code。

要绑定新 main，必须 new `workflow_dispatch`。

## Pitfall 11 — 跨 T1R1 / T3R1 scope 拼证据

#3182 已证明最危险的不是 timestamp，而是 producer scope。

Amendment-17 明确禁止：

```text
cross-scope canonical stitching
```

selector scope gate 必须保留。

## Pitfall 12 — crop legality 在 oldest selection 之后判断

必须先 intersection crop legality，再选 oldest。

## Pitfall 13 — rolling soil 在 T-5 提前停

rolling dedicated runner允许 poll 到 T；但任何 available/ingested > T 仍必须 reject。

## Pitfall 14 — semantic hash mismatch 用“兼容”名义绕过去

当前 blocker 正是这个。

hash mismatch 的意义是：**producer 冻结的 evidence semantics 与 consumer 重建结果未被证明相同。**

必须找出差异来源，而不是让 gate 变松。

## Pitfall 15 — 把 Node 20 warning 当当前 blocker

GitHub Actions 正在提示 actions runtime 强制 Node 24；仓库工作负载仍显式 setup Node 20.11.1。

这是未来 hygiene，不是 run `31928115749` 的失败原因。

---

# 15. 当前不可更改的安全边界

继续保持：

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
Formal qualification path read-only until explicitly authorized
no T1R1 -> T3R1 relabelling
no scheduler start before authority
```

---

# 16. 下一对话可直接使用的短接手提示

```text
接手 GEOX MCFT-CAP-09。先读取：

docs/handoff/GEOX-MCFT-CAP-09-HANDOFF-2026-08-16.md

当前 protected main：
d385f47286037cc0504c49c088861591a5699e3b

最新 live activation run：
31928115749

不要重新研究 KBS freshness、future-T long wait、T1R1 crop authority 或 zero-state DB。

当前唯一 substantive blocker：
MCFT_CAP09_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH

先对 producer artifact 9246513491 / producer SHA 481f46358056abc592c9e5691d3463487261dafa 与 current rehydrator exactSemanticMatch() 做字段级 canonical semantic diff。

不得弱化 semantic hash gate。修复后加 deterministic immutable-producer rehydration pre-dispatch gate，PR/merge 后重新 workflow_dispatch rolling operational activation；不要 Re-run 31928115749。
```

---

## 17. 当前 handoff 自身信息

```text
handoff date:
2026-08-16

handoff purpose:
conversation continuation only

repository authority:
none

frontier:
EA5E2_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
```
