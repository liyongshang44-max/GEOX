# GEOX 智能灌溉付费共创试点包说明

## 1. 文档定位

本文档定义 GEOX 智能灌溉 MVP-0 的付费试点包边界，供销售、交付、支持、客户沟通共同使用。

本文档继承以下既有 commercial_v1 试点商务口径：

- `docs/TRIAL_COMMERCIAL_BOUNDARY_AND_DELIVERY_SCOPE.md`
- `docs/TRIAL_PAYMENT_INVOICE_ACCEPTANCE_SOP.md`
- `docs/TRIAL_BILLING_AND_ACCEPTANCE_MIN_MODEL.md`
- `docs/COMMERCIAL_V1_TRIAL_RUNBOOK.md`
- `docs/TRIAL_DAY1_CHECKLIST.md`

本文档不替代合同、报价单、发票文件、财务制度或法务文本。

---

## 2. 产品名称

**GEOX 智能灌溉付费共创试点包**

英文内部代号：`IRRIGATION_MVP0_PAID_TRIAL_PACKAGE`

---

## 3. 当前阶段产品定位

当前对外销售的是一个受控试点交付包，不是公开标准化 SaaS 订阅。

正式定位：

> 在一个明确地块和试点周期内，验证 GEOX 是否能够完成智能灌溉闭环，并通过客户报告、Field Memory 和 ROI Ledger 给出可复盘、可解释、可留痕的试点结果。

当前卖的是：

- 项目制试点交付
- 受控部署
- 受控演示
- 试点运行支持
- 周报或阶段性说明
- 复盘报告
- ROI 证据链
- Field Memory 记录
- 后续扩展建议

当前不是：

- SaaS 年费订阅
- 自助开通平台
- 在线支付产品
- 自助开票产品
- 全自动农业控制系统
- 全场景农业平台
- 增产承诺服务

---

## 4. 建议试点范围

默认试点范围：

- 一个客户主体
- 一个试点项目
- 一个 demo field 或一个真实试点地块
- 一个作物季前半段或 4–8 周
- 一条智能灌溉闭环
- 一个 mock valve skill run，或一个指定设备接口预留
- 一套客户报告
- 一份试点复盘报告

默认不扩大到：

- 多地块规模化运营
- 多作物经营
- 施肥闭环
- 植保闭环
- 巡检闭环
- 多真实设备兼容
- 客户自助管理多租户
- 完整线上支付、订阅、开票

如客户需要扩大范围，必须单独约定范围、周期、责任边界、设备条件和费用。

---

## 5. 客户买到什么

### 5.1 部署

交付团队提供受控部署或受控演示环境准备。

交付内容包括：

- 试点环境启动说明
- 基础配置确认
- demo field 或试点 field 准备
- 数据输入或模拟数据准备
- 演示链路准备

### 5.2 培训

为客户或客户指定人员提供 MVP-0 操作说明。

培训重点：

- 如何查看地块状态
- 如何查看缺水信号
- 如何查看建议和处方
- 如何审批
- 如何查看执行、回执、验收
- 如何查看 Field Memory
- 如何查看 ROI Ledger
- 如何阅读客户报告

### 5.3 试点运行

试点期间围绕智能灌溉闭环运行。

最小闭环包括：

```text
Observation
→ Recommendation
→ Prescription
→ Approval
→ Action Task
→ Skill Run
→ Receipt
→ As-executed
→ Post-irrigation Observation
→ Acceptance
→ Customer Report
→ Field Memory
→ ROI Ledger
```

### 5.4 周报或阶段性说明

试点期间可按约定输出周报或阶段性说明。

内容可包括：

- 缺水事件数量
- 灌溉建议数量
- 审批数量
- 执行数量
- 验收结果
- Field Memory 摘要
- ROI 初步估算
- 当前问题与下一步动作

### 5.5 客服支持

提供试点范围内的支持与排障。

支持范围：

- 演示链路问题
- 数据未进入系统
- 建议未生成
- 处方未生成
- 审批卡住
- mock valve 执行失败
- receipt / as-executed 缺失
- acceptance 不通过
- Field Memory 不显示
- ROI 不显示
- 报告不可读

### 5.6 复盘报告

试点结束后输出复盘报告。

复盘报告必须引用：

- 客户报告
- ROI Ledger
- Field Memory
- Skill 表现摘要
- 设备或 mock valve 执行摘要
- 验收结果
- 客户反馈

复盘结论必须归入：

- `CONTINUE`：继续试点或扩地块
- `ADJUST`：调整传感器、设备、Skill、baseline 或流程
- `STOP`：当前场景不适合继续投入

---

## 6. 客户不买到什么

以下内容不属于默认试点包范围：

- 成熟 SaaS 年费
- 全自动农业控制系统
- 全场景农业平台
- 增产承诺包
- 所有真实设备兼容
- 完整企业 IAM / SSO
- 完整 CRM / ERP / 财务系统集成
- 在线支付
- 自助订阅
- 自助开票
- 客户自助合同流程
- 长期无人值守托管
- 未约定地块、设备、作物、场景的扩展交付

---

## 7. 价格与收费口径

本文档不定义具体报价。

当前建议收费方式：

- 固定试点包费用
- 可选扩展费用
- 后续地块扩展或真实设备接入另行报价

商务路径应继承既有试点 SOP：

```text
合同确认
→ 对公打款
→ 发票处理
→ 首日交付
→ 中期确认（如有）
→ 最终验收
→ 归档留痕
```

不得把单个 task、receipt、acceptance fact、内部成本、技术告警直接当作客户收费对象。

---

## 8. 验收口径

试点包验收不以“是否成为成熟 SaaS”为标准，而以约定试点范围内是否完成闭环和报告为标准。

最小验收内容：

- 一个地块试点范围明确
- 缺水 observation 可进入系统
- irrigation recommendation 可生成
- prescription 可形成
- approval 可完成
- mock valve skill run 或指定设备接口预留可说明
- receipt / as-executed 可留痕
- post-irrigation observation 可用于验收
- acceptance 可输出
- Field Memory 可展示
- ROI Ledger 可展示
- 客户报告可读
- 试点复盘报告可交付

---

## 9. ROI 口径

MVP-0 只默认展示以下价值类型：

- 节水
- 少跑田 / 人工节省
- 异常提前发现
- 验收一次通过率

禁止默认展示：

- 增产收益
- 品质溢价
- 长期利润提升

除非客户提供完整季末数据且双方单独约定分析口径，否则不得把增产作为 MVP-0 收益承诺。

ROI 必须标注：

- baseline
- calculation_method
- evidence_refs
- confidence
- measured / estimated / assumption-based

---

## 10. Field Memory 口径

MVP-0 的 Field Memory 第一版不承诺自动调参。

第一版承诺：

- 系统能记录本次灌溉后地块响应
- 系统能记录设备或 mock valve 执行可靠性
- 系统能记录 irrigation skill 表现
- 客户报告能展示“系统记住了什么”
- 后续 report / recommendation 可以读取上一轮 Field Memory

不得承诺：

- 自动优化所有后续处方
- 已具备完整农学学习模型
- 已具备多季产量预测能力

---

## 11. 风险与退出规则

试点结束后，根据 ROI Ledger 与 Field Memory 给出判断：

### CONTINUE

适用情况：

- 节水、少跑田、异常提前发现或验收质量有明确正向信号
- 客户愿意继续提供 baseline 或扩地块
- 设备或 mock execution 链路稳定

### ADJUST

适用情况：

- ROI 方向不稳定
- 证据不足率高
- 设备可靠性不足
- Skill 判断需要人工复核
- baseline 缺失导致价值无法有效解释

### STOP

适用情况：

- 一个试点周期后无法证明节水、少跑田、异常提前发现或验收质量改善
- 客户无法提供必要数据或不认可试点价值
- 设备或现场条件不支持继续验证

---

## 12. 对外一句话口径

> GEOX 智能灌溉付费共创试点包，用一个明确地块和 4–8 周试点周期，验证从缺水发现、建议、处方、审批、执行、验收，到 Field Memory 和 ROI Ledger 的完整智能灌溉闭环；它不是成熟 SaaS，也不承诺增产，而是用证据链证明是否值得继续扩展。
