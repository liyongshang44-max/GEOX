# GEOX MCFT-CAP-09 Continuation Handoff — 2026-08-13

更新时间：2026-08-13

## 当前任务

当前继续推进：

`MCFT-CAP-09 — Shadow-Online Promotion`

目标：

`STAGE_1B_SHADOW_ONLINE_CLOSURE`

当前工程前沿：

`S6-EA5E2-OPERATIONAL-ACTIVATION-QUALIFICATION-UNDER-AMENDMENT-08`

当前 authority frontier：

`S6-EA9B-NATURAL-SEASON-EVIDENCE-REQUALIFICATION`

当前 protected main 基线：

`dc9b03a0197e94f64d0d06447999290057e722f2`

## 已完成

### EA5E2 实现链

已完成：

- fixed-lag / real-provider runtime implementation
- private transient R2 boundary
- isolated readiness DB
- no-Formal-write boundary
- KBS freshness gate
- target selection guard
- conservative crop-stage consensus preflight
- soil selector 按冻结的 `[T-15m, T]` inclusive window 对齐

### 历史失败修复

已处理：

1. transient R2 retained_at 因旧 digest 复用导致的 EA3 invariant failure。

必须保持：

`retrieved_at <= retained_at`

2. soil observation window 错误收紧。

不能使用：

`T-10m only`

必须遵守冻结 selector：

`LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2`

### KBS observer

已完成 publication cadence observer 基础能力：

- observer only
- 不进入 Formal evidence
- 不写 runtime state
- 不公开 raw values

当前目标不是修改 KBS authority，而是理解 provider publication behavior。

## 当前卡点

当前阻塞不是核心代码缺失。

主要问题是：

真实 provider temporal behavior 需要进一步分类。

特别是：

- KBS Raw Hourly publication cadence
- observation availability time
- ingestion time
- runtime knowledge time

不能假设：

provider publication = hourly continuous

也不能直接声明：

KBS = daily batch

因为 observer 需要足够数量的真实 chained transitions。

## 下一步计划

1. 首先确认 EA5E2 live qualification run 最终状态。

检查：

- exact protected-main subject
- jobs
- logs
- artifacts
- first substantive failure（如果失败）

2. 如果 PASS：

进入 evidence-freeze/effectiveness PR。

禁止直接声明 operational activation effective。

3. 如果失败：

只定位第一处实质失败：

- authority/provider truth failure
- implementation/orchestration bug

不要根据 skipped steps 判断 root cause。

4. 推进 KBS temporal intelligence：

建立：

`PASS / DEFER / FAIL`

三态 freshness decision。

保持：

6h authority 不变。

## 踩过的坑（必须避免）

### 1. 不要为了通过测试改变 authority

错误方式：

- 放宽 freshness
- 改成 24h
- 用 cadence 推翻 frozen authority

正确方式：

cadence intelligence 只能解释 provider behavior，不能改变 authority contract。

### 2. 不要混淆不同时间语义

必须区分：

- Event time
- Availability time
- Ingested time
- Runtime knowledge time

### 3. 不要弱化 invariant

例如：

- R2 retention invariant
- soil selector window
- no Formal write boundary

这些是系统可信边界，不是测试条件。

### 4. PR 合并前重新核对 exact diff

历史教训：

PR 描述可能滞后于实际 diff。

必须检查：

- exact head
- changed files
- merge SHA
- workflow subject

## 下一对话第一步

按以下顺序：

1. 检查 protected main 当前 SHA
2. 检查最新 EA5E2 workflow run
3. 获取 logs/artifacts
4. 判断 PASS 或第一失败点
5. 再决定是否进入 evidence-freeze

不要从旧 handoff、旧失败 run、旧 branch 恢复。