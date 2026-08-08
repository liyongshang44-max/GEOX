# PFE-14 Shadow-Online 操作员运行控制台产品任务书 v0.3

```text
document_id: PFE-14-PRODUCT-TASKBOOK-V0.3
status: CURRENT_CANDIDATE
language_contract: ZH_CN_DEFAULT_WITH_EN_US_COMPLETE
prototype_display_language: ZH_CN
target_surface: Operator Runtime Console
runtime_dependency: MCFT-CAP-09 Shadow-Online Promotion
stage_scope: ONE_GOVERNED_SIX_KEY_SCOPE
interaction_mode: GET_ONLY_READ_ONLY
product_goal: USABLE_OPERATOR_PRODUCT
engineering_acceptance_only: false
production_launch: NOT_CLAIMED
commercial_launch: NOT_CLAIMED
```

## 0. 本版裁决

v0.3 在 v0.2 的边界基础上补齐产品定义。v0.2 解决了 Scope、路由和原型权威问题；v0.3 解决“前端是工程读回页还是可用产品”的问题。

PFE-14 的最终交付不是把 Runtime JSON、对象引用和 hash 换一种排版，而是让操作员在不理解内部对象模型的前提下完成以下工作：

1. 选择并确认唯一受治理的 tenant / project / group / field / season / zone Scope。
2. 判断当前 Runtime 是否正常推进，以及最近和下一时隙是什么。
3. 判断 Evidence 是否足以支持当前 State 和 Forecast。
4. 理解当前 State、Forecast、Scenario 资格及其限制。
5. 发现 stale、missing、missed slot、backfill、restart、recovery 和 blocked。
6. 沿 Evidence、Timeline、Trace 查明“为什么是这个结论”。
7. 查看既有 Decision、Approved Plan、Action Feedback、Residual 和 Calibration 信息，但不创建或改变它们。

工程验收是进入主线的必要条件，但不是产品完成标准。只有用户任务可完成、信息层级可理解、状态可恢复、双语完整时，PFE-14 才能声明产品面完成。

## 1. 权威链和不可越权边界

PFE-14 服从：

- `docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md`
- `docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md`
- PFE-13 Frontend Product v1 Freeze
- 当前 canonical `/operator/fields/*` GET-only Runtime API family

必须保持：

```text
Reality is not Evidence.
Evidence is not State.
Sensor Reading is not Root-zone State.
Forecast is not Scenario.
Scenario is not Recommendation.
Decision is not Approval.
Approval is not Dispatch.
Dispatch is not Execution.
Assimilation is not Calibration.
Candidate is not Active Model.
Replay Twin is not Production Twin.
```

禁止：

- 自动 Recommendation、Approval、AO-ACT、Dispatch 或 Model Activation。
- 多地块并发 Shadow Runtime 或 portfolio scheduler 声明。
- 将 live device、production gateway、field pilot 或 controlled execution 描述为已成立。
- 前端自行计算 freshness、scheduler 状态、Scenario 资格或 degradation 结论。
- 用设计样例冒充当前仓库数据、现场事实或验收证据。

## 2. 仓库功能基线

当前仓库已经提供以下可复用能力：

| 仓库能力 | canonical 路由 / API | 产品化表达 |
|---|---|---|
| Operator Shell | `/operator/*` | 中文默认、英文可切换的操作员控制台 |
| Runtime Overview | `/operator/twin` | 当前 Scope 的运行摘要和异常入口 |
| Exact Scope Navigator | `/operator/fields` | Field → Season → Zone 的精确 Scope 选择 |
| Runtime Root Graph | `/operator/fields/:fieldId` | 当前运行链、核心对象和完整性摘要 |
| State collection | `/state` | 当前估计状态、置信类别、依据和限制 |
| Forecast collection | `/forecast` | 预测时域、结果、来源 State、阻塞原因 |
| Scenario collection | `/scenario` | 情景比较资格和已有情景，不生成建议 |
| Action lifecycle | `/action-lifecycle` | 只读查看 Decision、Plan、Feedback 链 |
| Residual collection | `/residual` | 预测与后验观察差异及验证结果 |
| Model governance | `/calibration` | Calibration Candidate、Shadow Evaluation、Model Activation 的只读治理状态 |
| Evidence / Trace | `/evidence-trace` | Evidence、Timeline、Trace、因果追踪 |
| Runtime Health | `/health` | terminal 与 operational health、调度和降级状态 |

当前实现中的 `object_ref`、`object_hash`、`response_instance_hash`、集合分页和 pointer semantics 继续保留，但默认进入“技术详情”，不得成为产品首屏主信息。

## 3. 用户和使用场景

### 3.1 主要用户

**运行操作员**：负责每天检查 Twin 是否持续运行、是否需要数据或工程介入，不负责直接控制田间设备。

**农艺师 / 模型审查者**：查看 State、Forecast、Residual、Calibration 和限制，判断结果是否具备业务解释价值。

**审计与治理人员**：沿 Evidence、Trace、Timeline 和 canonical refs 验证结论来源及边界。

### 3.2 高频任务

- 每次进入系统，在 30 秒内判断“当前是否正常、哪里异常、下一步看什么”。
- 在 60 秒内确认当前 Scope 和数据新鲜度。
- 在 90 秒内解释一个 State 或 Forecast 的来源、置信和限制。
- 在 2 分钟内定位一次 missed slot、backfill、restart 或 recovery。
- 在 3 分钟内沿 Trace / Timeline 找到相关 Evidence 和 canonical object。

## 4. 双语和中文原型要求

### 4.1 正式产品语言

所有正式页面必须完整支持：

```text
zh-CN: 默认语言
English: 完整可切换语言
```

双语要求覆盖：

- 导航、标题、按钮、字段名和帮助文本。
- Loading、Empty、Forbidden、Blocked、Error、Backfilling、Recovered 等状态。
- 时间、单位、枚举和限制说明。
- 技术详情、复制提示和可访问性标签。

不得出现中文页面夹杂未经解释的内部英文枚举。内部枚举可在技术详情中保留，同时提供中文产品标签。

### 4.2 原型语言

所有评审用效果图和矩阵图必须：

```text
主界面文本：中文
语言切换入口：显示“中文 / English”
固定标识：目标态产品原型 / 非当前运行数据
样例 Scope：仅一个六键 Scope
```

英文版不要求在同一张矩阵图重复展示，但任务书和实现必须保证完整英文 copy。

## 5. 产品信息架构

一级导航只保留：

1. **运行总览**
2. **地块**

Field Runtime 主标签：

1. 总览
2. 证据
3. 状态
4. 预测
5. 运行健康
6. 审计

“更多”菜单：

1. 情景
2. 行动生命周期
3. 残差验证
4. 校准

Evidence、Health、Forecast 和 Calibration 都属于当前精确 Scope，不建立全局聚合一级入口。

## 6. 页面矩阵

### P01 运行总览

**用户问题**：当前唯一 Scope 是否正常运行，是否需要关注？

首屏只显示：

- 当前模式与只读边界。
- 六键 Scope 摘要。
- 最近完成时隙、下一目标时隙。
- Evidence 资格与新鲜度。
- State、Forecast、Runtime Health 三项状态。
- 最高优先级异常和安全下一步。

第二层显示 24 小时时隙带和最近运行事件。hash、cursor、checkpoint 等放入技术详情。

### P02 精确 Scope 选择

**用户问题**：我正在查看哪块地、哪个季节和哪个管理分区？

流程：Field → Season → Zone → 确认六键 Scope → 打开 Runtime。

必须显示 tenant、project、group 的当前上下文。没有 zone-list API 时保留 zone_id 显式输入，并说明“未发现权威分区目录”。

### P03 Field Runtime 总览

**用户问题**：这一 Scope 的完整 Runtime 链是否成立？

产品层显示：

- Runtime lineage 和当前 Tick。
- Evidence Window、Posterior State、Forecast、Scenario 的存在与资格。
- Decision / Approved Plan / Action Feedback 的只读存在状态。
- Residual、Calibration Candidate、Shadow Evaluation、Model Activation 的治理状态。
- 当前限制和异常。

对象引用、hash 和 source_fact_ref 默认折叠。

### P04 Evidence

**用户问题**：当前结论依赖的数据是否足够、及时且符合边界？

显示：eligible boundary、observed_at、ingested_at、coverage、maximum gap、freshness、future excluded、late、out-of-order、missing source。

提供“影响了哪些 State / Forecast”的反向入口，但不做前端推断。

### P05 State

**用户问题**：系统认为当前状态是什么，可信程度和依据是什么？

每个状态卡显示：状态名称、值、单位、置信类别、估计时间、Evidence 数量、变化方向、限制。

状态详情显示：来源 Evidence、assimilation update、posterior state、历史变化和技术引用。

### P06 Forecast

**用户问题**：未来可能怎样，预测是否可用？

显示：预测状态、时域、生成时间、来源 State、Evidence cutoff、预测区间、Scenario 资格、blocked reason。

固定显示：预测不是事实、不是建议、不是行动。

### P07 Scenario

**用户问题**：已有情景之间有什么差异，是否具备比较资格？

只展示 Runtime 已返回的情景。比较维度包括结果区间、风险、资源影响、来源 Forecast 和限制。

不得出现“推荐情景”“立即执行”或默认优选按钮。

### P08 行动生命周期

**用户问题**：已有人工决策、批准计划和执行反馈之间是什么关系？

时间轴只读展示 Human Decision → Approved Plan → Action Feedback / Receipt / Outcome Evidence 的已有对象和缺口。

不得创建、批准、派发或重试任务。

### P09 残差验证

**用户问题**：预测与后验观察偏差多大，偏差意味着什么？

显示预测值、观察值、残差、时间范围、验证状态、可解释限制和关联 Forecast。

### P10 校准与模型治理

**用户问题**：是否存在校准候选，它经过了什么评估，是否被激活？

分区展示 Calibration Candidate、Shadow Evaluation、Model Activation。默认强调“Candidate 不等于 Active Model”。

### P11 运行健康

**用户问题**：调度器、数据和 Runtime 是否持续推进？

产品层显示：当前 slot、最近完成 slot、下一 slot、scheduler lag、missed slot、backfill、restart、recovery、Evidence freshness、degradation reason。

技术层显示 cursor、checkpoint、lease、fencing、content hashes 和 response hashes。

### P12 证据 / Trace / Timeline

**用户问题**：这个结论从哪里来，中间发生了什么？

提供三种互补视图：

- Timeline：按时间顺序查看事件。
- Trace：按对象关系查看来源和派生。
- Evidence：查看原始证据边界和引用。

支持从 State、Forecast、Residual、Decision 等对象深链进入对应节点。

### P13 审计与技术详情

**用户问题**：如何验证对象身份、响应一致性和限制？

集中展示 canonical refs、object type、hash、source fact、validation summary、limitations 和 response identity。默认折叠 raw payload，允许复制单项引用。

### P14 状态与恢复页面

必须为以下状态提供完整产品设计：

```text
LOADING
NO_SCOPE
RUNTIME_NOT_ESTABLISHED
SHADOW_NOT_AUTHORIZED
WAITING_FOR_FIRST_SLOT
RUNNING
COMPLETED
DEGRADED_STALE_EVIDENCE
DEGRADED_MISSING_DATA
BACKFILLING
RECOVERED
BLOCKED
FORBIDDEN
API_ERROR
```

每种状态必须有：中文标题、解释、事实来源、安全下一步、禁止动作、刷新策略和英文 copy。

## 7. 关键用户流程

### F01 每日运行检查

运行总览 → 识别最高优先级状态 → 查看运行健康或 Evidence → 确认是否需要数据/工程介入。

### F02 解释一个 State

状态 → 打开状态详情 → 查看 Evidence 和 assimilation → 跳转 Timeline / Trace → 返回状态。

### F03 解释一个 Forecast

预测 → 查看来源 State 与 Evidence cutoff → 查看 Scenario 资格 → 查看限制或 blocked reason。

### F04 调度异常调查

运行健康 → 定位 missed slot → 查看 backfill / restart / recovery → 沿 Timeline 查看事件 → 复制技术引用。

### F05 模型治理审查

校准 → Calibration Candidate → Shadow Evaluation → Model Activation 状态 → 查看限制；不提供激活操作。

## 8. 交互规则

- 页面默认展示业务含义、状态、时间和安全下一步。
- 技术字段通过渐进披露展示。
- 支持手动刷新；自动刷新间隔只能来自服务端 `refresh_after_seconds`。
- 所有时间明确显示 UTC，并可在帮助文本中解释本地时间。
- 错误页保留 request_id，复制时不得包含敏感信息。
- 表格在窄屏下转换为卡片，不允许整页横向滚动。
- 键盘可完成 Scope 选择、标签切换、详情展开和复制。
- 状态不能只依赖颜色，必须同时有文字和图形标识。
- 任何页面都不得以空白或通用“暂无数据”掩盖未授权、未建立、陈旧或阻塞。

## 9. Apple-inspired 产品视觉

视觉目标是清晰、克制和层次，不复制 Apple 品牌资产。

- 系统字体，字重 400 / 500 / 600。
- 页面背景 `#F5F5F7`，主要内容为高对比白色或半透明面板。
- 主容器 20px、普通卡片 16px、小控件 10–12px 圆角。
- 绿色用于当前 Scope、正常状态和可用入口；蓝色用于链接与信息；黄色/红色仅用于明确风险。
- 首屏不展示大段 JSON、hash 或内部 schema。
- 动效只用于状态变化、标签切换和详情展开，并支持 reduced motion。

## 10. 可用产品验收

工程门禁之外，必须满足以下产品验收：

### 10.1 可理解性

- 新操作员在不阅读任务书的情况下，30 秒内能指出当前 Scope、模式、最新时隙和最高优先级异常。
- 页面不得要求用户理解 pointer、attachment、root graph 或 content hash 才能判断状态。

### 10.2 任务完成

- F01–F05 每条流程均有明确入口、完成点和返回路径。
- 不存在死链、虚假 Coming Soon 入口或无下一步的错误状态。

### 10.3 边界正确性

- 用户不会把 Forecast 误认为 Recommendation。
- 用户不会把 Decision 误认为 Approval 或 Dispatch。
- 用户不会把 Shadow-online 误认为 Production Twin。

### 10.4 双语

- 所有正式页面和状态达到 zh-CN / English 100% copy coverage。
- 中文为默认；原型评审图全部以中文展示。

### 10.5 响应式与可访问性

- 1440、1024、768、390 宽度无页面级横向溢出。
- 键盘、焦点、屏幕阅读器标签和 reduced-motion 通过。

### 10.6 视觉一致性

- 所有页面使用同一 Shell、Scope Header、状态词汇、卡片和技术详情模式。
- 视觉回归必须覆盖 P01–P14 的代表状态。

## 11. 目标态原型矩阵交付

原型不是当前实现截图，也不是 Runtime 证据。原型必须固定显示：

```text
目标态产品原型 / 非当前运行数据
```

矩阵至少覆盖 12 个主页面：

```text
运行总览
精确 Scope
Runtime 总览
Evidence
State
Forecast
Scenario
行动生命周期
残差验证
校准
运行健康
Trace / Timeline / Audit
```

另附关键状态带：等待首个时隙、Evidence 陈旧、补跑中、已恢复、阻塞和无权限。

所有效果图：

- 以中文展示。
- 显示中文 / English 切换入口。
- 只使用一个冻结样例 Scope。
- 样例值明确属于设计样例。
- 不出现 Recommendation、Approval 操作、AO-ACT 创建、Dispatch 或生产控制。

## 12. 实施切片

```text
S0  Repository and authority reconciliation                  EFFECTIVE
S1  Frontend read contract and state matrix                  EFFECTIVE
S2  Apple-inspired visual foundation                         EFFECTIVE
S3  Operator Shell consolidation                             EFFECTIVE
S4  Single-Scope Runtime Overview and Evidence availability  BLOCKED_BY_MCFT09_READ_CONTRACT
S5  Evidence / State / Forecast / Scenario productization    FUTURE
S6  Scheduler / Health / Backfill / Recovery                 FUTURE
S7  Action / Residual / Calibration / Trace productization   FUTURE
S8  Bilingual usability, accessibility, responsive, visual   FUTURE
S9  Exact frontend candidate and product closure             FUTURE
```

S4 以前可以完成设计、copy、状态矩阵和原型；不得伪造 Runtime 数据合同或实现 Shadow-online 声明。

## 13. 完成声明

只有 S9 完成并通过工程与产品验收后，允许声明：

```text
PFE_14_SHADOW_ONLINE_OPERATOR_PRODUCT_SURFACE_COMPLETE
```

该声明不表示：

```text
MCFT-CAP-09 complete
Minimum Complete Field Twin complete
production launch
commercial launch
live device connected
production gateway online
controlled action enabled
```
