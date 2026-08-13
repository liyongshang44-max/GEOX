# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-13

更新时间：2026-08-13

## 0. Authority / recovery order

下一对话不得把本 handoff 当成高于仓库事实的 authority。

恢复顺序必须是：

1. current Taskbook / bound Amendments / current Delivery Policy；
2. current protected `main` exact SHA；
3. live GitHub PR / workflow run / artifact facts；
4. 本 handoff 作为 continuation context。

本文件记录的 protected-main snapshot 为：

`8b51945b64f765e8e7a819045a9fe75a1d105468`

该 SHA 是 PR #3089 的 merge commit：

`feat(mcft-cap09): prepare daily KBS crop-window readiness observer`

如果下一对话读取时 protected `main` 已移动，必须先以新的 protected-main facts 重裁当前 frontier，不得机械执行本文件的时间敏感步骤。

## 1. 当前任务与 frontier

当前继续推进：

`MCFT-CAP-09 — Shadow-Online Promotion`

总目标：

`STAGE_1B_SHADOW_ONLINE_CLOSURE`

当前 authority frontier：

`S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION`

EA5E2 状态应准确表述为：

`IMPLEMENTATION / ADMISSION HARDENING PRESENT ON PROTECTED MAIN; OPERATIONAL-ACTIVATION EFFECTIVENESS NOT ESTABLISHED`

因此，`S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08` 仍是未完成的 qualification objective，但**不是“现在立刻再 dispatch 一次 live run”**的指令。

新的 live qualification 只有在当前 protected-main authority 与 provider/crop admission 同时成立时才可考虑。

## 2. 已完成并必须保留的 EA5E2 implementation boundary

Protected main 已包含：

- fixed-lag / real-provider runtime implementation；
- private transient R2 boundary；
- isolated readiness DB；
- no-Formal-write boundary；
- unchanged KBS Raw Hourly current-read freshness gate `<=6h`；
- target selection guard；
- conservative crop-stage consensus preflight；
- soil selector 对齐冻结的 `[T-15m, T]` inclusive window；
- explicit live-window viability preflight；
- EA5E2 expensive live workflow 改为 explicit `workflow_dispatch`；
- late exact-hour semantic polling under the frozen T+390 / T+432 / T+437 boundaries；
- exact-hour soil phase admission SSOT and deterministic static proof。

### 2.1 EA3 retention causality fix

历史失败 run `31566710679` 暴露 transient R2 content-addressed object reuse causality bug。

修复后必须永久保持：

`retrieved_at <= retained_at`

允许的行为仅是：当旧 transient object 的 retained receipt 早于当前 retrieval 时，删除旧 transient object 并重新 retain 同一已验证 bytes，从而建立新的 causal retention barrier。

禁止通过弱化 EA3 invariant 来通过测试。

### 2.2 Soil selector conformance fix

历史 run `31573422554` 暴露 readiness harness 比冻结 CAP-03 selector 更严格：首次 soil poll 从 `T-10m` 才开始，并排除了恰好 `T-15m` 的合法 observation。

当前冻结行为必须保持：

`LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2`

即：

- authorized soil observation window = `[T-15m, T]`；
- lower bound inclusive；
- T-5m minimum ingress margin 不变；
- 不扩大 15m authority；
- 不做 source substitution；
- 不做 timestamp relabeling。

## 3. #3070 已合并：EA5E2 admission-control hardening 已成为 protected-main fact

PR #3070：

`MCFT-CAP-09: complete EA5E2 preflight before next live window`

已于 2026-08-12 合并，merge commit：

`1c27cf70f62503e89e37602a6f267141e0546bcf`

关键结果：

1. EA5E2 live workflow 为 explicit `workflow_dispatch` only，不再因 protected-main merge 自动消耗约 7h real-wall-clock live window。
2. live-window viability preflight 在 readiness DB/R2/live-activation side effects 前执行。
3. KBS Raw Hourly `<=6h` 保持原 frozen current-read authority；没有发明 `candidate_T-latest<=6h` 新 authority。
4. KBS Current Weather soil endpoint 独立建模。
5. provider/crop window 未证明 viable 时必须 fail-closed 为 `NO_VIABLE_LIVE_WINDOW`。
6. global soil lag 统计仅为 diagnostic，不是 candidate-T authority。
7. exact-row soil phase evidence 使用独立 scheduler heuristic；该 heuristic 明确 `authority_effect=false`。

当前不应再把 EA5E2 blocker描述为“核心 runner implementation 缺失”。

## 4. Soil exact-hour phase evidence

#3070 冻结的 phase admission 状态为：

- `:45` / T-15：已有 1 个 exact-row sample，first-seen `5.466m <= 10m`，timing compatible，但 `INSUFFICIENT_REPEAT_EVIDENCE`；
- `:50` / T-10：已有 2 个样本，`10.359m`、`10.938m` > `5m` budget，`PROVEN_INCOMPATIBLE`；
- `:55` / T-5：已有 2 个样本，`10.497m`、`10.042m` > `0m` budget，`PROVEN_INCOMPATIBLE`。

因此在该 frozen snapshot 下：

`proven_compatible_phase_count = 0`

且 soil admission fail-closed：

`NO_VIABLE_LIVE_WINDOW`

关键 remaining provider evidence 是获得另一个独立有效的 `:45 / T-15` exact-row first-seen sample，并通过同一个 SSOT helper 重裁 repeat evidence。

即使 `:45` 获得第二个 compatible sample，它也只关闭 scheduler viability 的一个条件；**不会单独授权 EA5E2 live**。

## 5. KBS Raw Hourly publication cadence

KBS cadence observer 是 metadata/temporal observer，不改变 production authority。

必须保持：

- transition #1 只是第一条真实 chained transition，不是 cadence authority；
- 至少 3 个真实 chained publication transitions 后才允许 cadence classification；
- cadence intelligence 不能推翻 frozen `<=6h` current-read authority；
- `DEFER` 不是 `PASS`；
- engineering validation freshness ceiling 不能替代 production authority。

截至本 handoff 更新时，最新已确认的 protected-main cadence observer 为：

- run `31652795556` / run #28；
- exact subject `8b51945b64f765e8e7a819045a9fe75a1d105468`；
- conclusion `SUCCESS`；
- artifact `9163218764`；
- digest `sha256:ba57103a8c47831451f0557d60bcc79fbcbba9e0428d75e664e86077aadfa8bf`。

**不要仅凭 workflow conclusion 推断新的 transition 或 cadence classification。** 下一对话若要更新 transition count，必须读取该 run 的 actual artifact/log content，并和前一 chained state 对比。

历史上已确认 transition #1：

- run `31565265200`；
- artifact `9129224001`；
- digest `sha256:0df0c260f67a43162020a3b2160ccd51d0e93b185a387c42af27c4dcab88bebd`。

在没有 artifact-level proof 前，不得把“KBS 看起来每天批量发布”升级成 authoritative cadence classification。

## 6. 旧 crop authority 已过期，禁止 rescue

#3070 已明确冻结：

- previous/current-season terminal legal T = `2026-08-12T21:00:00Z`；
- latest lawful dispatch = `2026-08-12T20:10:00Z`。

这些时间已经属于历史窗口。

因此后续不得：

- rescue expired current-season epoch；
- 为了重跑 EA5E2 延长旧 crop window；
- 把旧 crop-stage consensus 视为无限期有效；
- 因 KBS/soil provider condition 后来恢复就直接复用旧 epoch。

任何更晚的 EA5E2 live qualification 都需要 separate lawful successor / requalified crop-context authority。

## 7. #3089 已合并：EA9B current-main crop-window observer

PR #3089 已合并到当前 protected main：

- title: `feat(mcft-cap09): prepare daily KBS crop-window readiness observer`；
- merge commit: `8b51945b64f765e8e7a819045a9fe75a1d105468`。

它增加 metadata-only EA9B observer：

`mcft-cap-09-ea9b-current-main-window-observer`

其用途是扫描 KBS Aglog，在锚点 `2026-05-11` 之后寻找 T1/T1R1 planting candidates，并为新的 lawful crop-window requalification 提供 readiness metadata。

它明确**不能**：

- 创建 season；
- 创建 crop-context authority；
- 选择 successor epoch；
- 生成 target T；
- 建立 EA5E2 activation effectiveness；
- 建立 EA5E3 effectiveness；
- 开启 Formal execution；
- 写 DB / raw object / R2 / scheduler / canonical Runtime state。

其 schedule 为 05:10 / 06:10 / 07:10 UTC，加 manual dispatch。

截至本 handoff 更新时，protected-main scheduled run 尚未形成可引用的 current-main observer evidence。因此下一步应读取它之后产生的真实 metadata artifact，而不是提前宣称已发现 successor crop authority。

## 8. 当前真正的 blocker / frontier

当前 blocker 不是单一代码 bug，而是需要以下独立条件在同一 lawful window 中相交：

1. **EA9B natural-season evidence requalification**：先发现并证明新的 lawful planting/crop candidate，再按 current Taskbook/Amendment procedure 建立 crop-context authority；observer 本身不产生 authority。
2. **KBS Raw Hourly current-read authority**：实际 dispatch 时仍必须满足 frozen `latest age <=6h`。
3. **Soil phase viability**：需要当前 frozen scheduler admission policy 下足够的 exact-row repeat evidence；当前重点为 `:45 / T-15` phase。
4. **Pre-boundary lead / target legality**：必须在新的 crop authority 下重新证明。
5. **Current protected-main static/readiness/governance gates**：必须在同一个 exact protected-main SHA 上重新成立。

只有这五类条件同时成立时，才值得消耗一次 explicit protected-main EA5E2 live qualification。

## 9. 允许并行推进，但不得混淆 authority

允许并行：

- KBS publication cadence observer 持续积累 chained transitions；
- soil exact-row observer 补 `:45` repeat evidence；
- metadata-only EA9B current-main crop-window observer；
- KBS rainfall / ET0 / value path 的 `ENGINEERING_VALIDATION`。

但必须保持以下分类：

- provider/cadence intelligence = scheduler/readiness evidence；
- engineering validation = implementation/value-path evidence；
- EA9B requalification = authority-establishment path；
- EA5E2 live = operational-activation qualification evidence。

前两类不能替代后两类。

## 10. 下一对话的正确恢复顺序

下一对话第一步必须：

1. 读取 current protected `main` exact SHA；如果不再是 `8b51945...`，先重裁状态。
2. 读取 current Taskbook、bound Amendments（特别是 Amendment-08 及 EA9B requalification authority）与 current Delivery Policy。
3. 检查最新 `mcft-cap-09-ea9b-current-main-window-observer` run/artifact，判断是否仅发现 candidate metadata，还是已有后续独立 authority adjudication。
4. 检查最新 KBS publication cadence observer artifact，更新真实 chained transition count；少于 3 不做 cadence classification。
5. 检查最新 soil exact-row evidence，重点判断 `:45` repeat admission 是否已满足；不得改变 frozen authority。
6. 只有在 successor/requalified crop authority + KBS `<=6h` + soil viability + legal lead + exact-head gates 同时成立时，才 dispatch 一次新的 EA5E2 live qualification。
7. live PASS 必须逐 phase / artifact 验证，不能只看 workflow conclusion。
8. complete exact-head EA5E2 PASS 后，只进入 current repository-authorized evidence-freeze/effectiveness step；不得自动授权 EA5E3、O00 或 Formal execution。

## 11. 必须避免的错误

### 不要为了通过测试改变 authority

禁止：

- 放宽 production freshness 到 24h；
- 用 observed cadence 替代 `<=6h` frozen authority；
- 扩大 soil 15m selector；
- 修改 T-5m ingestion margin；
- source substitution；
- timestamp relabeling；
- cross-cycle substitution。

### 不要混淆时间语义

必须分别记录：

- Event time；
- Availability / first-seen time；
- Retrieved / retained time；
- Ingested time；
- Runtime knowledge time。

### 不要弱化可信 invariant

必须保持：

- EA3 `retrieved_at <= retained_at`；
- soil `[T-15m,T]` inclusive selector；
- no-Formal-write readiness boundary；
- actual UTC / no accelerated clock；
- exact-head evidence binding。

### 不要从旧 live run 恢复

旧失败 run 用于 failure evidence，不用于重新授权：

- `31566710679`：旧 transient R2 reuse causality bug；
- `31573422554`：旧 soil-window readiness conformance bug；
- 后续任何已失败/过期 run 也不得通过 rerun 绑定到新 protected-main authority。

### PR 合并前始终重新核 exact diff

历史上 PR body 曾滞后于实际 diff。

合并任何 MCFT-9 carrier 前必须重新确认：

- current exact head；
- exact base / protected main；
- changed files；
- required Delivery Policy / Main Ruleset / candidate declaration / release lane / focused gates / standard CI；
- mergeability；
- merge commit semantics 与 expected exact head。

## 12. 当前 nonclaims

截至本 handoff snapshot：

- EA5E2 operational activation effective = `false`；
- successor epoch selected = `false`；
- new crop-context authority established by #3089 observer = `false`；
- EA5E3 effective = `false`；
- O00/Formal execution authorized = `false`；
- Formal execution count remains `0/24` unless later exact protected-main authority proves otherwise；
- KBS daily/batch cadence is not declared solely from visual/operational impression；
- no expired current-season epoch rescue is authorized。

不要从旧 handoff、旧 failure run、旧 branch 或 observer-only PASS 恢复 authority。