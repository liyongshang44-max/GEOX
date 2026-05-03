# GEOX 智能灌溉 MVP-0 销售演示脚本

## 1. 文档定位

本文档用于 GEOX 智能灌溉 MVP-0 的对外销售演示。

本文档继承以下既有 commercial_v1 试点交付文档的通用口径：

- `docs/COMMERCIAL_V1_TRIAL_RUNBOOK.md`
- `docs/TRIAL_DAY1_CHECKLIST.md`
- `docs/TRIAL_COMMERCIAL_BOUNDARY_AND_DELIVERY_SCOPE.md`
- `docs/TRIAL_PAYMENT_INVOICE_ACCEPTANCE_SOP.md`
- `docs/TRIAL_BILLING_AND_ACCEPTANCE_MIN_MODEL.md`

本文档不是通用 commercial_v1 平台演示稿，而是专用于：

**GEOX 智能灌溉付费共创试点包。**

演示目标不是证明 GEOX 已经覆盖所有农事场景，而是证明：

> 一个地块出现缺水风险后，GEOX 能完成从监测、诊断、推荐、处方、审批、执行、回执、验收、Field Memory 到 ROI Ledger 的最小可销售闭环。

---

## 2. 演示对象与边界

### 2.1 演示对象

本次演示只围绕一个 demo field：

- 一个地块
- 一条缺水 observation
- 一个智能灌溉 recommendation
- 一个 irrigation prescription
- 一次人工 approval
- 一个 mock valve skill run
- 一个 receipt
- 一个 as-executed
- 一个 post-irrigation observation
- 一个 acceptance
- 三条 Field Memory
- 四类 ROI 中适用项
- 一个客户报告

### 2.2 明确不演示

本演示不展示以下能力：

- 全自动无人值守农业控制
- 全部真实阀门或泵站兼容
- 施肥、植保、巡检等多场景闭环
- 完整公开 SaaS 年费订阅
- 自助支付、自助开票、自助合同
- 增产承诺
- 所有 ROI 都是实测值

### 2.3 销售统一口径

对外统一表达为：

**GEOX 当前销售的是智能灌溉付费共创试点包，不是成熟 SaaS 年费产品，也不是全自动农业控制系统。**

---

## 3. 演示前准备

演示前必须确认：

1. 使用 `docker-compose.commercial_v1.yml` 或当前正式 MVP-0 试点基线启动。
2. server 外部入口可访问。
3. web 外部入口可访问。
4. demo field 已准备。
5. demo device 或 mock valve skill 可用。
6. `ACCEPTANCE_COMMERCIAL_MVP0_IRRIGATION_V1.cjs` 已可跑通或已准备等价演示数据。
7. Operation Report 页面能展示：
   - 为什么做
   - 谁批准
   - 怎么执行
   - 有什么证据
   - 验收结果
   - 系统记住了什么
   - 本次价值账本

演示前不要临时切换到 legacy 页面、admin 页面或工程调试页面作为主演示路径。

---

## 4. 15 分钟演示结构

### 0:00–1:00 客户痛点

建议话术：

> 对种植主体来说，灌溉不是简单开关水阀。真正的问题是：什么时候缺水，是否值得灌，谁批准，实际有没有执行，执行后是否有效，以及这次作业到底节省了多少水和人工。

强调三个痛点：

- 缺水发现不及时
- 人工跑田和协调成本高
- 执行后缺少证据、验收和价值复盘

不要说：

- GEOX 已经能完全替代人工
- GEOX 能保证增产
- GEOX 能兼容所有设备

---

### 1:00–3:00 GEOX 如何发现缺水

展示内容：

- demo field
- soil moisture observation
- 缺水状态或低湿度指标
- sensing / evidence judge 的基础判断

建议话术：

> 系统首先不是直接下发任务，而是先看这块地的观测数据。这里我们用土壤湿度作为 MVP-0 的主信号。观测数据进入系统后，会先成为一条可追溯的 observation，而不是直接变成作业。

必须讲清：

- observation 是链路入口
- 数据不是直接驱动执行
- 证据质量会影响后续可信度

---

### 3:00–5:00 如何生成建议和处方

展示内容：

- irrigation recommendation
- recommendation 的原因说明
- irrigation prescription
- prescription 中的目标湿度、执行窗口、计划用水或执行时长

建议话术：

> GEOX 不把“建议”直接变成“任务”。系统会先生成灌溉建议，再转成处方。处方是正式执行前的合同式对象，它包含目标、范围、执行窗口、风险、验收条件和证据引用。

必须讲清：

- recommendation 解释为什么建议灌溉
- prescription 规定具体怎么执行
- prescription 是任务前置门槛

禁止说：

- 系统看到缺水就自动执行
- 所有推荐都无需人工确认

---

### 5:00–7:00 如何审批

展示内容：

- approval 状态
- 审批人
- 审批时间
- 审批备注

建议话术：

> 在当前试点阶段，GEOX 把自动化执行前的审批保留下来。尤其是涉及水、设备和现场风险的作业，不会绕过人工确认。审批通过后，才会进入 Action Task。

必须讲清：

- 当前是可控自动化，不是无人值守
- approval 是风险边界
- 审批记录进入报告和审计链

---

### 7:00–9:00 mock valve 如何执行并产生回执

展示内容：

- Action Task
- mock valve skill run
- receipt
- as-executed

建议话术：

> 这一版我们用 mock valve 来证明 GEOX 的任务—Skill—执行—回执—验收链路。真实阀门可以后续接入，但不作为 MVP-0 的前置阻塞。关键是：任何设备能力都必须通过 Skill 层声明能力、风险和审计信息。

必须讲清：

- mock valve 是正式 MVP-0 选择，不是临时演示造假
- 它用于证明链路可交付
- 真实设备接入属于后续试点扩展项

禁止说：

- 已经兼容所有阀门
- 当前演示等于真实设备现场效果

---

### 9:00–11:00 如何验收

展示内容：

- post-irrigation observation
- acceptance 结果
- evidence / receipt / metrics

建议话术：

> 作业完成不是闭环结束。系统还要看灌后 observation，判断湿度是否回升、证据是否充分、执行是否符合处方。如果证据不足或效果不达标，系统不会把它包装成成功。

必须讲清：

- receipt 证明执行发生
- post observation 证明效果变化
- acceptance 证明是否达到预期
- 失败路径会阻断或降级

---

### 11:00–13:00 Field Memory 记住了什么

展示内容：

Operation Report 中的“系统记住了什么”区块。

至少展示三类：

- 地块响应记忆：灌前湿度、灌后湿度、湿度变化
- 设备可靠性记忆：阀门响应、超时、回执完整性
- Skill 表现记忆：缺水诊断是否被采纳、执行后是否验收通过

建议话术：

> GEOX 不只记录这次做了什么，还会把这次作业变成这块地的长期记忆。比如这块地灌后湿度回升多少、阀门响应是否稳定、缺水诊断是否被采纳。这些记录会进入后续报告和下一轮试点复盘。

当前版本边界：

- Field Memory 第一版用于报告和复盘
- 不承诺第一版已经自动调参
- 后续可基于试点数据逐步优化推荐策略

---

### 13:00–15:00 ROI 怎么算，可信度多高

展示内容：

Operation Report 中的“本次价值账本”区块。

重点讲四类：

- 节水
- 少跑田 / 人工节省
- 异常提前发现
- 验收一次通过率

建议话术：

> GEOX 的 ROI Ledger 不只是写一个收益数字。每条 ROI 都要说明和什么比、怎么算、证据是什么、可信度多高。早期试点中，有些值是估算，有些值可能来自客户基准线。我们会明确标注，不把估算包装成实测。

必须讲清：

- 不承诺增产
- ROI 分实测、估算、基于默认假设、证据不足
- 试点复盘以 Field Memory 和 ROI Ledger 为依据

---

## 5. 客户常见问题应答

### Q1：这是不是成熟 SaaS？

不是。当前是智能灌溉付费共创试点包。它有明确试点范围、交付周期、报告和复盘，不是公开自助购买的 SaaS 年费产品。

### Q2：能不能直接接真实阀门？

可以作为试点扩展项评估。MVP-0 默认用 mock valve 验证 GEOX 的作业闭环和审计链路。真实设备接入需要单独确认设备协议、现场网络、安全边界和责任划分。

### Q3：你们能保证增产吗？

不能。增产是季末甚至多季指标。MVP-0 只承诺围绕智能灌溉试点提供节水、少跑田、异常提前发现、执行证据和验收留痕的价值证明。

### Q4：ROI 是实测的吗？

不一定。报告会区分实测、估算、基于默认假设和证据不足。使用客户提供基准线时，可信度更高；没有基准线时，只能作为估算参考。

### Q5：系统会不会自动控制设备？

MVP-0 保留人工审批。审批通过后才进入任务和 Skill 执行。高风险作业不会绕过审批。

---

## 6. 演示成功定义

本次演示成功，不要求客户当场理解所有工程对象，只要求客户能明确看到：

1. GEOX 如何发现缺水。
2. GEOX 如何解释为什么建议灌溉。
3. GEOX 如何把建议转成处方。
4. GEOX 如何保留审批边界。
5. GEOX 如何通过 mock valve 证明执行链路。
6. GEOX 如何用 receipt / as-executed / observation 做验收。
7. GEOX 如何记录 Field Memory。
8. GEOX 如何生成 ROI Ledger。
9. GEOX 当前卖的是付费共创试点，不是夸大承诺。

---

## 7. 演示失败时的处理

如果演示中断，不允许临时跳到工程日志里解释。

统一处理顺序：

1. 判断是否是页面不可访问。
2. 判断是否是 demo field 缺失。
3. 判断是否是 observation 缺失。
4. 判断是否是 recommendation / prescription 未生成。
5. 判断是否是 approval 未完成。
6. 判断是否是 mock valve / receipt / as-executed 缺失。
7. 判断是否是 acceptance 未完成。
8. 判断是否是 Field Memory 或 ROI Ledger 未进入报告。

销售对外表达：

> 当前演示卡在某一环节，我们不会把缺失链路包装成成功。GEOX 的价值之一就是把断点明确显示出来，便于现场排查和责任定位。

---

## 8. 演示后输出

演示后应输出：

- 演示使用的 demo field
- 本次闭环报告链接或截图
- Field Memory 摘要
- ROI Ledger 摘要
- 客户关注问题
- 是否进入付费共创试点洽谈
- 是否需要真实设备接入评估

本文档到此结束。
