# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-18

Status: **CONVERSATION HANDOFF ONLY — NOT REPOSITORY AUTHORITY**

> 本 handoff 用于下一对话恢复 MCFT-CAP-09 / S6 / EA5E2→EA5E3 / Formal 24h execution 的完整工程上下文。
>
> 它不制造新的 authority、effectiveness、future epoch selection、EA5E3 authorization、Formal O00 start、scheduler start、provider authority、crop-stage authority 或 MCFT-CAP-09 completion claim。
>
> 权威顺序始终是：current Master Task Line / MCFT-CAP-09 Taskbook / effective Amendments → protected `main` → exact PR / workflow run / immutable artifact / Formal Neon state → 本 handoff。若冲突，以更高权威事实为准。

---

## 0. 下一对话只要先读这一节

当前唯一正确 continuation frontier（描述性标签，不是新的 repository authority enum）：

```text
FRESH_ZERO_STATE_FORMAL_STORE_AND_NEW_FUTURE_EPOCH_REBUILD
```

自然语言描述：

> 2026-08-17T20:00Z 的 selected Formal epoch 已经真实执行到 A0 / provider / A18D，并被正式判为 `NO_GO_FAIL_CLOSED`。该 epoch 与其 v2 Formal store 都禁止复用。当前应从 #3204 已完成的 runtime-environment requalification 往前推进：建立一个全新的 zero-state Formal store，证明完整 26-relation runtime persistence schema 与 exact schema fingerprints，重新选择一个 future epoch，重建新的 A0 + 24 Runtime Config chain / manifest / exact live subject，然后再做一次 pre-live qualification。不要从旧 epoch、旧 v2 DB、旧 A18D schedule 继续跑。

当前 protected main：

```text
repository:
liyongshang44-max/GEOX

protected main:
051150d1355529cc3062b6a084fc4fe46f1d9047

latest critical merge:
PR #3204 — MCFT-CAP-09: requalify Formal runtime environment after failed epoch

#3204 head:
ef911d738efe345adb07613dd7635d7396bd4c81

#3204 merge SHA:
051150d1355529cc3062b6a084fc4fe46f1d9047

#3204 merged_at:
2026-08-18T02:20:13Z
```

#3204 已经把失败 epoch 的裁决和下一轮环境资格边界冻结：

```text
failed epoch:
mcft_cap09_external_formal_window_epoch_20260817t200000z_v2

adjudication:
NO_GO_FAIL_CLOSED

reuse_forbidden:
true

failed v2 DB reuse:
FORBIDDEN

future epoch selected:
false

new Formal database effective:
false

new A0 started:
false

Formal O00 started:
false

MCFT-CAP-09 completed:
false
```

所以当前不是：

```text
retry old A18D
retry old O00
repair old v2 DB in place
resume cd2056... live schedule
```

而是：

```text
fresh store
→ complete runtime schema qualification
→ new future epoch selection
→ new A0/config chain
→ new immutable manifest
→ new exact live subject
→ pre-live production-environment equivalence proof
→ only then live A0/provider/A18D/O00
```

下一对话第一件事：

1. 核 protected `main == 051150d1355529cc3062b6a084fc4fe46f1d9047`，确认没有新 drift。
2. 读取 #3204 / `GEOX-MCFT-CAP-09-RUNTIME-ENV-REQUALIFICATION-AUTHORITY-V1.json`。
3. **不要修改或清空** failed v2 store `geox_mcft_cap09_s6_formal_t3r1_24h_v2`；它已含真实失败 epoch evidence，必须保留为 audit history。
4. 建一个新的 distinct zero-state Formal database identity；不得从 historical DB 或 failed v2 DB 复制 runtime rows。
5. 新 store 在 A0 前必须满足 #3204 的完整 runtime contract：
   - `26` 个 required public relations；
   - exact column fingerprint；
   - exact constraint fingerprint；
   - exact index fingerprint；
   - 26/26 relations 全部存在；
   - required relations 全部 zero-state。
6. 把 pinned GFS decoder stack 安装/selfcheck/import smoke 放进**真正 production collector 的 qualification/runtime workflow**，不能只在 unit/selftest 中存在。
7. 在 current main 上重新做 current-season whole-window / lead-time / crop legality 评估，选择一个新的 future epoch。旧 `2026-08-17T20:00Z` epoch 永久禁止复用。
8. 为新 epoch 重新生成/冻结：
   - new A0;
   - 24 Runtime Config refs/hashes;
   - parent chain;
   - crop identity hashes;
   - full crop materialization hashes;
   - replacement immutable manifest;
   - new exact live subject。
9. pre-live gate 必须在真实窗口前证明：
   - complete runtime schema；
   - zero-state；
   - exact GFS decoder environment；
   - A0/provider/A18D/runner wiring；
   - exact-main subject；
   - no unauthorized writes。
10. 上述全部完成前，不再启动 Formal O00。

---

# 1. 本对话从 #3193 接手后实际完成了什么

本对话从旧 handoff：

```text
PR #3193
protected main = 2fade4617dadae81a779b80f35332545e817ff0a
frontier = T3R1_SUCCESSOR_FORMAL_DB_PREFLIGHT_AND_IMMUTABLE_WINDOW_INPUT_MANIFEST_V2
```

继续推进，最终不只是“把 manifest 做完”，而是实际走到了：

```text
#3194 successor Formal DB preflight + Manifest V2
→ #3195 Amendment-11 actual-snapshot Formal V3 persistent-tick service
→ #3196 Amendment-18 / 57h state-continuity contradiction adjudication
→ #3197 replacement zero-state Formal v2 store qualification
→ #3198 new prewindow A0 + 24 Runtime Config chain
→ #3199 replacement Manifest V3 + production runner exact binding
→ #3200 EA5E3 provider-watermark Formal v2 collector wiring
→ #3201 corrective A0-soil readiness dependency
→ #3202 A18D bootstrap cutover qualification
→ #3203 pre-runtime hardening + production Formal runner wiring
→ real wall-clock execution:
   A0 PASS
   provider collector FAIL
   A18D FAIL
   O00 NO-GO
→ failed epoch adjudicated NO_GO_FAIL_CLOSED
→ #3204 runtime-environment requalification
→ current frontier:
   fresh zero-state store + new future epoch rebuild
```

这是本 handoff 最重要的状态迁移。

当前问题已经不再是：

```text
rehydration mismatch
Amendment-11 observer snapshot
runtime graph rebind
successor config persistence
whether a runner exists
whether A0 soil can be collected
```

这些都已经有明确实现或历史证明。

当前问题是：

> 把昨晚真实执行暴露出的“生产环境资格化不完整”彻底变成 pre-live 硬 gate，然后在全新 store / 全新 future epoch 上重建 Formal chain。

---

# 2. 必须继续冻结的 Amendment-11 / KBS temporal semantics

这一节继续沿用 #3193 handoff，不因昨晚 Formal NO-GO 而改变。

## 2.1 KBS 真实模型

```text
observation resolution = HOURLY
publication cadence    = DAILY_BATCH
```

KBS 每条 observation 是 hourly，但 provider 以 daily batch 一次发布约 24 条。

## 2.2 `<=6h` 仍然只允许 diagnostic

正确语义：

```text
HISTORICAL_ONLINE_FRESHNESS_DIAGNOSTIC_HOURS = 6

freshness_is_late_authoritative_admission_gate = false
```

严禁重新写成：

```text
authority_pass = age <= 6h
```

也严禁把 6h 改成 24h / 36h 后继续充当 authority。

## 2.3 current late exact-T authority

仍然是：

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

## 2.4 24h / 36h 的合法角色不变

```text
24h = cadence engineering observation window
36h = rolling candidate retention/expiry or successor selection lead
```

它们都不是 KBS late-admission freshness authority。

## 2.5 旧 fixed-lag normative authority 仍然禁止恢复

不得恢复：

```text
scheduler_eligibility_lag_hours = 7
late collector                  = T+06:30
exact evidence cutoff           = T+07:12
runtime observer                = T+07:17
```

也不得重新绕回：

```text
T+432
T+437
```

昨晚失败与这些时序语义无关；不要因为 Formal NO-GO 又回头改 FreshHour。

---

# 3. PR #3194：successor Manifest V2 / READ ONLY Formal preflight

PR：

```text
#3194
MCFT-CAP-09: preflight successor Formal DB and freeze input manifest v2

base:
2fade4617dadae81a779b80f35332545e817ff0a

head:
8ffab5f32162441eef18443e1671639dca4009c0

merge:
b60345a4ff26fe5f99c054c154c77e5b39796902
```

它冻结了当时选定 epoch 的：

```text
O00–O23
24 Runtime Config refs/hashes
24 parent bindings
24 crop-context hashes
persisted A0
Formal DB identity
#3190/#3191/#3192 immutable predecessor proof
scheduler 0/0
Formal 0/24
Amendment-11 semantics
```

关键 focused proof：

```text
run:
31939493533

artifact:
9261620350

digest:
sha256:1800e5f0adc11e0346e4baa03f3633e6526aba6bb25c3c2f5fb8271830eeba64
```

当时 live DB proof：

```text
facts = 59
Runtime Config = 49
successor = 24
A0 preserved
scheduler = 0/0
Formal ticks = 0
```

这个证明后来没有“失效”，但它证明的是旧 populated T3R1 store / old successor chain 的输入完整性，不是昨晚 replacement v2 runtime schema completeness。

---

# 4. PR #3195：Formal V3 service 从 fixed-lag 切到 Amendment-11 actual snapshot

PR：

```text
#3195
MCFT-CAP-09: qualify Amendment-11 Formal V3 persistent tick service

merge:
e36a5bee68a15cd55cff8885f7e191a11109a612
```

历史 V3 service 仍带 fixed：

```text
420 / 432 / 437
```

不能继续作为 current Formal authority。

本 PR 新增 versioned service：

```text
ExternalFormalV3Amendment11PersistentTickServiceV1
```

核心语义：

```text
caller-supplied evidence_snapshot_time
PROVIDER_AVAILABILITY_WATERMARK_V1
DB-only evidence
same scheduler claim/fence
no provider/R2 access from runtime
```

focused positive control 使用了：

```text
late evidence ≈ T+490/T+491
actual snapshot = T+500
```

证明 T+432/T+437 不再是 authoritative cutoff。

重要：以后 production runner 只能绑定 Amendment-11 service，不得绕回历史 V1 fixed-lag service。

---

# 5. PR #3196：57 小时 canonical state continuity contradiction

runner exact-binding 审计暴露：

```text
historical persisted A0:
2026-08-15T10:00Z

checkpoint next tick:
2026-08-15T11:00Z

selected O00:
2026-08-17T20:00Z
```

相差约：

```text
57h continuity gap
```

不能：

```text
patch checkpoint
pretend one PT1H transition covers 57h
run hidden 57h warm-up
write second INITIAL into same canonical store
```

因此 PR #3196 / Amendment-18 判定：

> populated 59/49 T3R1 store 只保留 qualification/history；实际 24h Formal run 必须使用 distinct zero-state canonical store，在 O00-1h 建 fresh A0，然后 O00 做真实 PT1H continuation。

PR：

```text
#3196
MCFT-CAP-09: adjudicate pre-window state continuity before Formal O00

merge:
799a29292b61248b9a037c9200c904f6fda7be66
```

这条结论仍然正确。

---

# 6. PR #3197：A18A replacement v2 store —— 后来证明这里的 schema preflight 太窄

PR：

```text
#3197
MCFT-CAP-09: qualify Amendment-18 zero-state Formal store

merge:
6e7b1ac08ca8f79d65d5c6ec0a57e0cbabb8e5c9
```

当时建立：

```text
project:
delicate-glade-62464340

branch:
br-cold-dust-a6j6aymz

database:
geox_mcft_cap09_s6_formal_t3r1_24h_v2
```

数据库从：

```text
template0
```

创建，没有复制旧 DB canonical rows。

当时 A18A 只冻结了一个 **12-table** runtime schema subset，并证明：

```text
facts = 0
checkpoint = 0
scheduler = 0/0
```

当时认为这是“schema complete enough”。

**这一点现在已经被昨晚真实 A18D 证明为错误。**

最关键教训：

> “12 张前置表 fingerprint 相等”并不等价于“真实 bootstrap/runner/recovery persistence closure 完整”。

昨晚 A18D 真正运行时需要：

```text
twin_runtime_authority_snapshot_v1
```

但 v2 DB 没有该表。

所以 #3197/A18A 不能作为下一轮 schema-completeness 模板继续复制。

---

# 7. PR #3198：A18B new prewindow A0 + 24 replacement Runtime Config chain

PR：

```text
#3198
MCFT-CAP-09: qualify Amendment-18 prewindow config chain

merge:
185479edf0c8dfab58632cddfff81c6e9aec6b06
```

为 old failed epoch 构建：

```text
prewindow A0 logical time:
2026-08-17T19:00:00Z

O00:
2026-08-17T20:00:00Z

O23:
2026-08-18T19:00:00Z
```

冻结：

```text
A0 config + O00–O23 = 25 exact Runtime Config pins
A0 has no parent
O00 parent = A0
O01–O23 = strict PT1H parent chain
```

旧 24 crop identity hashes 保持 equality。

这些 pins 现在只属于 failed epoch history，不能复制到新 future epoch。

---

# 8. PR #3199：Manifest V3 + full crop materialization + production runner exact binding

PR：

```text
#3199
MCFT-CAP-09: qualify Amendment-18 replacement manifest runner binding

merge:
de280185c09312213f59624164171919517ad26b
```

这里解决了一个重要完整性问题：

旧：

```text
crop_stage_context_hash
```

只是 authority identity hash，不等价于完整 `ContinuationCropStageConfigurationContextV1` payload hash。

所以 A18C 额外冻结：

```text
full crop-context materialization hash
```

并要求 runner：

```text
read exact manifest config
→ materialize full context
→ independently recompute full materialization hash
→ DB-only evidence precheck
→ only then scheduler claim
→ Amendment-11 tick
→ terminalize
```

关键 fail-closed：

```text
missing config => no claim
missing evidence => no claim
tampered full context => no claim
post-claim runtime exception => FAILED terminal
```

A18C production runner binding 逻辑仍可复用为未来设计参考，但新 epoch 必须重新 freeze config/manifest/live subject。

---

# 9. PR #3200 / #3201：EA5E3 collector wiring + A0 soil correction

## 9.1 PR #3200

```text
#3200
MCFT-CAP-09: establish EA5E3 v2 provider-watermark formal wiring

merge:
1daf449c5d572b49c41ed54c771ff7ecbee004e7
```

建立：

```text
Formal v2 Evidence collector
formal raw retention first
append-only facts ingress
Amendment-11 late KBS decoder
DB-only runtime
```

但第一次把：

```text
EA5E3 blocker_count = 0
```

判断得过早。

## 9.2 PR #3201 correction

随后检查 A18D A0 Evidence Window 发现：

```text
A0 = 2026-08-17T19:00Z
required soil observed_at in (18:00Z, 19:00Z]
available_to_runtime_at <= 19:00Z
ingested_at <= 19:00Z
```

O00 provider collector 不能代替 A0 soil。

因此 #3201：

```text
MCFT-CAP-09: correct EA5E3 prewindow A0 soil readiness

merge:
f8480f468dbe2dff24629903d20e45daf7dc08e6
```

新增 dedicated prewindow A0 soil collector。

重要教训：

> EA5E3 blocker set 必须从真正 downstream bootstrap contract 反推，不能只看 collector/runtime wiring 是否“看起来齐了”。

---

# 10. PR #3202：A18D bootstrap cutover

PR：

```text
#3202
MCFT-CAP-09: qualify A18D prewindow bootstrap cutover

merge:
60db8e957df91c7bcf84190354b7cc68fab36992
```

A18D executor 在写入前要求：

```text
25 pins recompute equality
A0 soil evidence present
A0 evidence window prepare before persistence
no foreign Runtime Config
no scheduler/terminal side effect
```

retry 语义：

```text
if A0 absent:
  perform fresh bootstrap

if A0 already exact:
  do not rebuild A0 with new wall-clock created_at
  only complete missing exact configs
```

后续静态审计还修正了 Runtime Config 实际 payload shape：

```text
scope fields are top-level payload fields
not payload.scope
```

并最终将 live execution exact-subject 锁到 qualified first-parent merge commit。

---

# 11. PR #3203：pre-runtime hardening + production runner wiring

PR：

```text
#3203
MCFT-CAP-09: harden pre-runtime cutover and wire Formal runner

merge:
cd2056f2fe82533ca01ac3347538ec8e22494b32
```

这是昨晚 live epoch 的 exact subject。

本 PR 在真实窗口前又静态抓出并关闭多个问题：

## 11.1 A0 Evidence 双读并发漂移

修成：

```text
candidate universe as-of A0
ingested_at <= A0
first precheck candidate set cached
bootstrap second read reuses same snapshot
```

避免 provider collector 在 A18D 两次读取之间新增 records 导致 A0 digest 漂移。

## 11.2 GFS pair atomicity

GFS 多 record canonical dataset 不再逐条独立 commit；要求：

```text
pair atomic commit
```

避免 1/2 partial dataset 永久污染。

## 11.3 bounded GFS retry

允许 operational retry，但只在 legal preboundary 范围：

```text
request start remains before T-30m
```

它不是新的 temporal authority。

## 11.4 A18D latest safe start

增加：

```text
latest safe start = 19:45Z
```

不是 normative authority，只是防止 19:59 启动后跨过 O00 才完成。

## 11.5 production Formal runner

审计发现 A18C 当时只有 qualification，没有真正 O00–O23 scheduled production runner。

#3203 补齐 production runner，避免：

```text
A18D success
→ state ready
→ 20:00 nobody executes O00
```

## 11.6 unified workflow / exact subject

三套旧 scheduled workflow 被统一成一条 hardening workflow，live lanes 共用 exact-main gate：

```text
A0 soil
provider collector
A18D
Formal runner
```

并要求 first-parent hardening merge commit 为唯一 legal subject。

这些 hardening 思路仍应保留到下一 future epoch，但必须重新绑定新 main / new epoch。

---

# 12. 昨晚真实 Formal epoch 发生了什么

这是本 handoff 不能丢的最重要实跑证据。

failed epoch：

```text
epoch:
mcft_cap09_external_formal_window_epoch_20260817t200000z_v2

A0:
2026-08-17T19:00:00Z

O00:
2026-08-17T20:00:00Z
```

live exact subject：

```text
cd2056f2fe82533ca01ac3347538ec8e22494b32
```

## 12.1 GitHub schedule 有延迟，但不是最终根因

02:00/02:20 北京时间最初看不到 scheduled run。

后来真正 run 出现，说明 GitHub hosted cron 存在分钟级延迟。

不要把：

```text
cron minute
```

当成硬实时 authority。

如果未来手动 dispatch，只能在仍然处于 authorized wall-clock window 且 exact subject 不变时使用；manual dispatch 不能绕过时间 gate。

## 12.2 A0 soil：PASS

run：

```text
32054939165
```

结果：

```text
event = schedule
head = cd2056f2...
live-a0-soil = SUCCESS
```

artifact：

```text
9296063277

digest:
sha256:892ba65c1d425ceb9b9e6d5eedcb48d7761b51408eaea733cb02dc293cefc289
```

真实 A0 soil evidence：

```text
observed_at:
2026-08-17T18:22:00Z

source:
mcft_kbs_live_soil_sample_v1

ingested_at:
2026-08-17T18:27:03.595Z
```

所以：

```text
A0 live Evidence ingress = PROVEN
```

A0 soil collector 本身不是昨晚失败根因。

## 12.3 provider collector：FAIL

run：

```text
32060274156
```

exact subject：

```text
cd2056f2...
```

结论：

```text
failure
```

第一 substantive failure：

```text
ModuleNotFoundError:
No module named 'eccodes'
```

这说明：

> production GFS/DSWRF path 依赖 ecCodes，但 unified live workflow 没有安装/qualify production decoder environment。TypeScript/selftest 通过不能替代真实 Python runtime environment proof。

不是：

```text
KBS authority failure
GFS provider bad data
Amendment-11 timing failure
```

而是：

```text
production dependency qualification gap
```

## 12.4 A18D：FAIL

run：

```text
32060558264
```

exact subject：

```text
cd2056f2...
```

它实际进入 legal A18D execution path，并通过 exact-main / DB binding 等前置。

第一 substantive failure：

```text
relation "twin_runtime_authority_snapshot_v1" does not exist
```

调用进入了真实 bootstrap persistence seam 后才失败。

这证明：

```text
A18A 12-table schema preflight was insufficient
```

## 12.5 O00 / Formal 24h：NO-GO

因为：

```text
provider evidence incomplete
A18D bootstrap failed
```

所以：

```text
Formal O00 authoritative start = false
Formal 24h execution = NOT STARTED
```

不要把后续 runner skipped/failed schedule 当成一个“部分完成的 O00”。

## 12.6 failed v2 store 当前角色

数据库：

```text
geox_mcft_cap09_s6_formal_t3r1_24h_v2
```

至少已经含有：

```text
1 real A0 soil Evidence fact
```

但 runtime schema 不完整。

因此它已经不是：

```text
fresh zero-state candidate
```

也不得通过：

```text
TRUNCATE
DELETE
drop/recreate in place
```

来伪装成下一次 clean store。

正确角色：

```text
FAILED_EPOCH_AUDIT_STORE
```

---

# 13. PR #3204：把昨晚两个生产环境漏检变成硬 preflight

PR：

```text
#3204
MCFT-CAP-09: requalify Formal runtime environment after failed epoch

base:
cd2056f2fe82533ca01ac3347538ec8e22494b32

head:
ef911d738efe345adb07613dd7635d7396bd4c81

merge:
051150d1355529cc3062b6a084fc4fe46f1d9047
```

exact-head runtime environment run：

```text
32089063231 — PASS
```

同 head 的：

```text
ci
release lane
delivery policy
main ruleset
runtime dependency graph
live-window preflight hardening
candidate declaration
```

均成功。

proof artifact：

```text
artifact:
9307713530

digest:
sha256:b66a7f771b25b65e14918b2097d330bf0103ab31e2684abfdc61d95edbb80f0f
```

注意：artifact 最终保存的是 failed v2 的 expected fail result，因为 workflow 先证明 historical schema reference PASS，然后故意要求 failed v2 zero-state requalification FAIL。

## 13.1 new complete runtime schema contract

#3204 不再使用 12-table subset，而是冻结完整：

```text
required_table_count = 26
```

包括：

```text
facts
twin_action_feedback_cycle_projection_v1
twin_action_feedback_evidence_index_v1
twin_action_feedback_projection_v1
twin_active_lineage_index_v1
twin_approved_plan_binding_projection_v1
twin_decision_record_projection_v1
twin_forecast_point_projection_v1
twin_forecast_residual_projection_v1
twin_forecast_result_latest_index_v1
twin_forecast_run_projection_v1
twin_forecast_success_latest_index_v1
twin_object_idempotency_index_v1
twin_runtime_authority_snapshot_v1
twin_runtime_checkpoint_latest_index_v1
twin_runtime_health_latest_index_v1
twin_runtime_lease_v1
twin_scenario_latest_index_v1
twin_scenario_point_projection_v1
twin_scenario_set_projection_v1
twin_scenario_set_uniqueness_v1
twin_shadow_online_scheduler_cursor_v1
twin_shadow_online_scheduler_slot_v1
twin_state_history_projection_v1
twin_state_latest_index_v1
twin_terminal_tick_uniqueness_v1
```

exact schema fingerprints：

```text
column_fingerprint_md5:
873a8e86f55d75a04a5f671627e98ae1

constraint_fingerprint_md5:
7803f7e7706e52eca3ca2aa4290ff5dd

index_fingerprint_md5:
ea5b3ba0392fd52fb471bc754e94ed35
```

新 rule：

```text
ALL_REQUIRED_RELATIONS_EXACT_SCHEMA_FINGERPRINT_AND_ZERO_STATE_MUST_PASS_BEFORE_A0
```

## 13.2 pinned production GFS decoder contract

#3204 冻结：

```text
python = 3.12
eccodes = 2.47.0
eccodeslib = 2.47.3.23
numpy = 1.26.4
refet = 0.4.2
```

qualification 至少必须执行：

```text
python -m eccodes selfcheck
exact package-version equality
production provider import smoke
```

下一轮 live workflow 不能再只在 qualification workflow 安装依赖，然后生产 collector lane 自己没装。

## 13.3 future epoch requirements

#3204 明确：

```text
fresh_zero_state_database_required = true
failed_v2_database_reuse_forbidden = true
new_epoch_selection_required = true
new_a0_required = true
new_runtime_config_chain_required = true
new_exact_live_subject_required = true
```

这就是当前 continuation boundary。

---

# 14. 当前三个 Formal database/store 的角色必须区分

## 14.1 historical schema reference store

```text
geox_mcft_cap09_s6_formal_t3r1_24h
```

现在只作为：

```text
schema/reference/history authority surface
```

它不是下一 future epoch 的 execution store。

允许：

```text
READ ONLY schema fingerprint reference
```

禁止：

```text
copy historical state into new store
reuse its active lineage as future A0
```

## 14.2 failed v2 store

```text
geox_mcft_cap09_s6_formal_t3r1_24h_v2
```

角色：

```text
failed epoch audit store
```

包含真实昨晚 A0 soil Evidence。

明确：

```text
reuse_forbidden = true
```

不能清库后“重新资格”。

## 14.3 future store

```text
NOT CREATED / NOT EFFECTIVE YET
```

下一对话必须新建 distinct identity。

在任何 A0 前必须：

```text
26/26 relations present
exact 3 fingerprints
all required relations zero-state
no historical/failed state copy
```

---

# 15. KBS / cadence observer 最新结论与昨晚失败的关系

昨晚前 latest cadence observer 已确认正常 daily batch：

```text
latest observation:
2026-08-17T04:00:00Z

forward:
+24h

new interval:
2026-08-16T05:00Z → 2026-08-17T04:00Z

missing = 0
backfill = 0
disappeared = 0
identity conflict = 0
```

有一条 edge revision：

```text
2026-08-16T04:00Z
```

分类为 revision，不是 backfill，也没有证明命中已消费 Formal lineage。

rolling exact intersection 曾：

```text
7 → 23
```

readiness 增强。

这些都是：

```text
provider/readiness observations
```

不是新的 repository authority。

最重要：

> 昨晚 NO-GO 不能归咎于 KBS cadence/freshness。两个 material failures 都是 production-environment qualification gaps：runtime schema incomplete + eccodes missing。

因此下一对话不要重新扩散回 KBS FreshHour 主线。

---

# 16. 当前唯一正确下一步计划

按优先级：

## Step 1 — fresh Formal store

创建新的 DB identity。

要求：

```text
distinct from historical store
distinct from failed v2 store
no runtime row copy
```

部署完整 26-relation schema。

## Step 2 — exact runtime-environment preflight

在新 store 上运行：

```text
PREFLIGHT_MCFT_CAP_09_RUNTIME_ENVIRONMENT_V1.ts schema
PREFLIGHT_MCFT_CAP_09_RUNTIME_ENVIRONMENT_V1.ts zero-state
```

必须同时证明：

```text
26/26 relations
column fingerprint exact
constraint fingerprint exact
index fingerprint exact
all required relations zero
READ ONLY proof
```

不满足就停，不进入 epoch selection。

## Step 3 — production decoder equivalence

在将来真正 live collector 使用的同一 execution environment 中：

```text
install pinned decoder stack
python -m eccodes selfcheck
exact version check
production provider import smoke
```

不能只在 standalone qualification job 中通过。

## Step 4 — new future epoch selection

重新扫描 current-season viability。

必须重新考虑：

```text
current protected main
current wall clock
minimum lead
crop legality
full O00–O23 window
provider cadence feasibility
A0 prewindow requirements
```

不得复用：

```text
2026-08-17T20:00Z
```

也不要因为旧 #3189 曾列出 future candidates 就直接手填一个 T；必须形成新的 exact-main selection authority。

## Step 5 — rebuild A0/config/manifest

新 epoch 必须重新生成：

```text
fresh A0 at O00-1h
25 Runtime Config chain
24 slot crop identity
25 full materialization hashes
replacement immutable manifest
```

旧 failed-epoch pins 只做历史参考，不能复制为 authority。

## Step 6 — new live subject / hardening

将 #3203 的 hardening invariants移植并重新绑定：

```text
A0 as-of candidate freeze/cache
A0 soil evidence gate
atomic multi-record Evidence commit
bounded GFS retry
A18D latest-safe-start
production Formal runner
single unified live workflow
exact first-parent subject gate
```

并新增 #3204 两条硬 gate：

```text
full 26-relation schema completeness
production eccodes environment equivalence
```

## Step 7 — only then schedule live run

只有全部 predecessor evidence merge/effective 后，才冻结：

```text
A0 window
provider window
A18D attempts
O00
runner cadence
```

并保持 exact main 不漂移。

---

# 17. 这一路踩过的坑：下一对话必须避免

## 17.1 不要把测试通过当 production-environment equivalence

昨晚最典型：

```text
TypeScript PASS
selftest PASS
workflow governance PASS
```

但真实 provider：

```text
No module named eccodes
```

以后任何依赖外部 runtime/package 的 live surface，都必须在相同 environment 做 import/selfcheck。

## 17.2 schema subset PASS 不等于 bootstrap/runner schema complete

A18A 只看 12 张表。

真实 A18D 需要：

```text
twin_runtime_authority_snapshot_v1
```

结果到 19:29Z 才发现缺失。

以后必须按所有 reachable persistence/recovery surfaces 求完整 schema closure；当前 frozen closure = 26 relations。

## 17.3 zero-state 必须先证明 relation exists，再证明 count=0

不能写出：

```text
missing table
→ query skipped
→ interpreted as zero
```

正确是：

```text
relation set exact
→ schema fingerprint exact
→ then zero-state count
```

## 17.4 failed store 不允许 TRUNCATE / DELETE 后复用

昨晚 v2 已有真实 A0 Evidence。

清掉以后再说“fresh”会破坏 audit chronology。

## 17.5 A0 success 不等于 Formal readiness

昨晚：

```text
A0 PASS
```

但：

```text
provider FAIL
A18D FAIL
O00 NO-GO
```

不能因为第一段绿就推断整条链 ready。

## 17.6 GitHub cron 不是硬实时 authority

scheduled job 可延迟数分钟。

cron minute 只能是 operational trigger，不是 evidence chronology / provider SLA / scheduler authority。

## 17.7 lane skipped 与 failure 要区分

统一 workflow 一次 trigger 只运行对应 lane。

灰色：

```text
SKIPPED
```

不等于链路在该 job 中“停住”。

## 17.8 actual exact-subject 仍必须重新冻结

#3203 的：

```text
cd2056...
```

只属于 failed epoch。

#3204 已改变 main：

```text
051150...
```

未来 live run 还会有新的 implementation merges。

所以不能继续把 `cd2056...` 写成合法 live subject。

## 17.9 不要拿旧 run 冒充 new-main proof

任何 main drift 后：

```text
old run PASS
```

不能资格化新 head。

## 17.10 不要降低 semantic equality 修问题

rehydration mismatch 期间已经证明：

```text
relax hash equality
rounding
rewriting expected hash
```

都不是正确修法。

## 17.11 runtime graph carrier EOF newline 会改变 digest

marker normalization 不会屏蔽尾部 newline。

以后 graph rebind 必须保持精确 bytes。

## 17.12 runtime PASS 不等于 evidence packaging sufficient

#3187/#3188 已经踩过：live behavior PASS 后，freeze 所需 metadata 可能仍缺。

authority freeze 要单独验证 artifact completeness。

## 17.13 artifact digest/字符串运输不能手猜

曾发生过：

```text
artifact SHA-256 漏最后一个字符
本地重算 hash 与 GitHub checkout bytes 不一致
```

正确做法：

```text
exact-head runner compute
artifact/blob actual bytes
fail-closed freeze
```

## 17.14 static gate failure 不等于 epoch 失效

先区分：

```text
carrier typo
marker mismatch
module format
CI dependency
```

与真正：

```text
provider chronology
DB state
authority contradiction
```

## 17.15 append-only persistence 不能 delete/rewrite“修复”

历史 evidence/config/state 都应保留。

失败 epoch 尤其需要保留用于 audit。

---

# 18. 哪些旧 PR / handoff 不能再作为 continuation 起点

不要从：

```text
#3183
EA5E2_ROLLING_REHYDRATION_SEMANTIC_HASH_MISMATCH
```

恢复。

不要从：

```text
#3193
T3R1_SUCCESSOR_FORMAL_DB_PREFLIGHT_AND_IMMUTABLE_WINDOW_INPUT_MANIFEST_V2
```

恢复。

不要从：

```text
#3203
cd2056... exact live subject
```

恢复。

#3203 是 failed epoch 的历史 live subject，不是 current frontier。

当前 effective recovery point：

```text
PR #3204
main = 051150d1355529cc3062b6a084fc4fe46f1d9047
```

---

# 19. 当前状态摘要

```text
EA5E2 operational activation historical qualification:
QUALIFIED

Amendment-11 temporal semantics:
EFFECTIVE / UNCHANGED

failed Formal epoch:
mcft_cap09_external_formal_window_epoch_20260817t200000z_v2

failed epoch adjudication:
NO_GO_FAIL_CLOSED

failed epoch reuse:
FORBIDDEN

A0 live Evidence in failed epoch:
PASS / PRESERVED AS AUDIT EVIDENCE

provider collector in failed epoch:
FAIL — GFS_DECODER_STACK_NOT_INSTALLED

A18D in failed epoch:
FAIL — FORMAL_RUNTIME_SCHEMA_INCOMPLETE

Formal O00 in failed epoch:
NOT STARTED AUTHORITATIVELY

failed v2 DB:
AUDIT ONLY / NOT ZERO-STATE / REUSE FORBIDDEN

runtime environment requalification:
QUALIFIED BY #3204

complete runtime schema contract:
26 relations + exact fingerprints

future Formal store:
NOT CREATED / NOT EFFECTIVE

future epoch:
NOT SELECTED

new A0:
NOT BUILT

new 24h Runtime Config chain:
NOT BUILT

new manifest:
NOT FROZEN

new live exact subject:
NOT FROZEN

MCFT-CAP-09:
NOT COMPLETE
```

唯一正确 frontier：

```text
FRESH_ZERO_STATE_FORMAL_STORE_AND_NEW_FUTURE_EPOCH_REBUILD
```

---

# 20. 下一对话的建议工作顺序

```text
1. exact-main = 051150d1... recheck
2. create distinct fresh Formal DB
3. deploy / verify full 26-relation schema
4. exact schema fingerprints + zero-state PASS
5. production eccodes stack qualification in same live environment
6. current-season future-window scan
7. select new epoch with sufficient lead
8. build fresh A0 + 24 config chain
9. freeze crop identity + full materialization
10. freeze replacement manifest
11. rebind production collector/A18D/runner to new exact subject
12. run pre-live blocker set
13. blocker=0 only then freeze schedule
14. live A0
15. live provider
16. A18D
17. O00
18. O00–O23
19. final evidence freeze / completion adjudication
```

不要为了“尽快重跑”跳过 2–5。昨晚已经证明，这四步如果做成形式检查，真实窗口会再次付出整轮成本。

---

# 21. 一句话交接

> MCFT-CAP-09 已经从 successor configuration / runner design 真正走到过一次 live Formal epoch；A0 成功，但 provider collector 因缺 `eccodes`、A18D 因 replacement DB 缺完整 runtime schema 而 fail-closed，旧 epoch/v2 store 已被 #3204 正式冻结为 NO-GO / reuse-forbidden。当前 protected `main` 是 `051150d1355529cc3062b6a084fc4fe46f1d9047`；下一步不是修旧窗口，而是按 #3204 的 26-relation schema + pinned decoder contract 建全新 zero-state Formal store，重新选择 future epoch，并重建 A0/config/manifest/exact live subject。
