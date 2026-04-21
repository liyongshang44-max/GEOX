# 试点收费对象与验收节点最小模型说明

## 1. 文档目的

本文档用于在 GEOX 当前 commercial_v1 试点交付阶段，建立“项目—收费节点—验收节点”的最小关系模型，统一销售、交付、支持、内部管理对试点收费闭环的理解与执行口径。

本文档要解决的问题不是构建完整 billing 系统，而是解决以下现实问题：

- 当前试点项目如何形成正式收费对象
- 当前收费节点如何与交付节点、验收节点对应
- 当前哪些仓库对象可以复用为验收依据
- 当前哪些仓库对象不能误当成商务对象
- 在当前阶段是否需要代码对象承载补丁

本文档为当前阶段最小模型说明，不替代合同、报价单、发票文件或财务制度。

---

## 2. 当前阶段前提

当前 GEOX 的商业定位仍为：

**commercial_v1 试点交付产品**

当前阶段默认商务路径为：

**合同确认 → 对公打款 → 发票处理 → 首日交付 → 中期确认（如有）→ 最终验收 → 归档留痕**

当前阶段不是：

- 公开 SaaS 订阅计费
- 自助在线支付
- 自助账单系统
- 自助开票系统
- 完整合同管理系统

因此，当前最小模型的目标不是“自动化收费”，而是：

**让每一笔试点收费都能找到对应的试点项目、收费节点、验收节点和留痕材料。**

---

## 3. 仓库现实核查结论

### 3.1 当前仓库中已有、可复用的对象类型

经核查，当前仓库已经存在一批可作为“交付/验收锚点”的对象与材料来源，主要包括：

- operation_state_v1 主口径下的 operation detail
- operation_report_v1
- receipt / evidence / acceptance 相关事实与聚合结果
- evidence export job 与 evidence bundle
- customer-facing 报告与导出类材料
- day1 check / Runbook / 交付文档类材料
- customer view、timeline、SLA snapshot 等项目结果表达

这些对象可以作为：

- 交付是否发生的证据
- 验收是否完成的依据
- 收费节点对应材料的留痕来源

### 3.2 当前仓库中没有的对象类型

当前仓库**没有发现**已经成型且语义正确的以下对象：

- contract_v1
- billing_milestone_v1
- invoice_v1
- settlement_v1
- trial_engagement_v1
- acceptance_milestone_v1（商务语义）
- payment_record_v1

也就是说，当前仓库并不存在一套现成的、可直接拿来作为商务台账的正式 billing / contract 模型。

### 3.3 当前仓库中不能误用为商务对象的内容

以下对象虽然存在，但**不能直接充当客户收费对象**：

- AO-ACT task
- execution request / execution attempt
- receipt 本身
- acceptance_result 本身
- internal report / operation trace 本身
- 内部成本估算对象
- 作业成本拆解字段
- 技术排障记录

这些对象的语义属于：

- 执行链留痕
- 验收链留痕
- 技术链留痕
- 内部成本估算

而不是：

- 客户应收对象
- 客户付款对象
- 发票对象
- 商务结算对象

### 3.4 核查结论

当前仓库现实可以支持：

- 先以文档冻结“项目—收费节点—验收节点”的最小模型
- 先建立正式商务闭环口径
- 先建立材料映射关系

当前仓库现实**不足以支持**：

- 直接宣称已有完整 billing 对象体系
- 直接宣称已有合同/发票/回款系统
- 直接把内部作业链对象包装为商务对象

---

## 4. 最小模型设计原则

当前阶段最小模型遵循以下原则：

### 4.1 先文档，后代码

本轮优先以文档冻结模型，不先扩展代码对象。

### 4.2 只做“项目—收费节点—验收节点”最小闭环

本轮只要求表达：

- 这是哪个试点项目
- 这个项目有哪些收费节点
- 每个收费节点对应哪个交付或验收节点
- 当前状态如何
- 对应的留痕材料是什么

### 4.3 收费对象与内部作业成本严格分离

必须严格区分：

- 客户付款对象
- 内部执行成本对象

两者不可混淆，不可互相替代。

### 4.4 当前不做公开 billing 系统

本模型服务于当前试点阶段内部执行与留痕，不服务于公开自助计费。

---

## 5. 最小核心对象

当前阶段最小模型只定义三个核心对象：

- 试点项目（pilot engagement）
- 收费节点（billing milestone）
- 验收节点（acceptance milestone）

这三个对象先以文档定义为正式执行口径。

---

## 6. 对象一：试点项目（pilot engagement）

### 6.1 定义

试点项目是当前 commercial_v1 商务闭环的顶层对象。

它代表的是：

**某一客户主体下、在明确试点范围和周期内执行的一次商业试点交付。**

### 6.2 试点项目最小字段

试点项目最小应表达以下信息：

- pilot_engagement_id：试点项目标识
- customer_name：客户名称
- project_name：项目/试点名称
- scope_summary：试点范围摘要
- contract_reference：合同或商务约定引用
- owner_sales：销售负责人
- owner_delivery：交付负责人
- owner_support：支持负责人
- start_date：起始日期
- target_acceptance_date：目标验收日期
- status：项目状态

### 6.3 建议状态

试点项目最小状态建议为：

- DRAFT：拟定中
- CONFIRMED：已确认
- IN_DELIVERY：交付中
- IN_ACCEPTANCE：验收中
- ACCEPTED：已验收
- CLOSED：已归档
- CANCELLED：已取消

### 6.4 说明

试点项目是商务对象，不是技术作业对象。

一个试点项目下面可以包含多个收费节点和多个验收节点。

---

## 7. 对象二：收费节点（billing milestone）

### 7.1 定义

收费节点是指在一个试点项目下，约定用于触发付款、付款确认或开票处理的最小商务节点。

它表达的是：

**客户应该在什么阶段、基于什么商务约定，对哪一段交付内容进行付款确认。**

### 7.2 收费节点最小字段

收费节点最小应表达以下信息：

- billing_milestone_id：收费节点标识
- pilot_engagement_id：所属试点项目
- milestone_name：收费节点名称
- milestone_type：收费节点类型
- amount_rule：金额规则或金额说明
- invoice_rule：开票规则说明
- due_condition：触发条件
- related_acceptance_milestone_ids：关联验收节点
- status：当前状态
- remark：备注

### 7.3 建议类型

当前阶段收费节点建议只保留最小类型：

- CONTRACT_DEPOSIT：合同启动款
- DAY1_DELIVERY：首日交付款
- MID_TERM_CONFIRMATION：中期确认款
- FINAL_ACCEPTANCE：最终验收款

并不是每个项目都必须有全部类型，可按合同与项目约定选择。

### 7.4 建议状态

收费节点最小状态建议为：

- PLANNED：已规划
- READY_TO_INVOICE：可开票
- INVOICED：已开票
- PAYMENT_PENDING：待收款
- PAID：已收款
- WAIVED：不适用/免除
- CANCELLED：已取消

### 7.5 说明

收费节点是商务对象，不是技术事件。

收费节点可以参考技术交付结果和验收材料，但不能由系统内部执行事件自动替代。

---

## 8. 对象三：验收节点（acceptance milestone）

### 8.1 定义

验收节点是指在一个试点项目下，用于判断某阶段交付是否达到可签收、可确认、可作为收费依据的最小交付验收单元。

它表达的是：

**某一次交付、某一阶段成果，是否已经达到约定验收条件。**

### 8.2 验收节点最小字段

验收节点最小应表达以下信息：

- acceptance_milestone_id：验收节点标识
- pilot_engagement_id：所属试点项目
- milestone_name：验收节点名称
- milestone_type：验收节点类型
- acceptance_basis：验收依据摘要
- evidence_refs：相关材料引用
- related_billing_milestone_ids：关联收费节点
- owner_delivery：交付责任人
- owner_customer_side：客户确认方
- status：当前状态
- accepted_at：验收时间
- note：备注

### 8.3 建议类型

当前阶段验收节点建议只保留最小类型：

- DAY1_READY：首日起盘验收
- TRIAL_RUN_CONFIRMED：试点运行确认
- REPORT_DELIVERED：报告交付确认
- FINAL_ACCEPTED：最终验收通过

### 8.4 建议状态

验收节点最小状态建议为：

- NOT_READY：未就绪
- READY_FOR_REVIEW：待确认
- UNDER_REVIEW：确认中
- ACCEPTED：已验收
- REJECTED：未通过
- NOT_APPLICABLE：不适用

### 8.5 说明

验收节点可以锚定仓库中的技术对象和交付材料，但它本身是商务/交付语义对象，不等同于某一个技术 fact。

---

## 9. 三者关系模型

最小关系如下：

### 9.1 一对多关系

- 一个试点项目（pilot engagement）可以有多个收费节点
- 一个试点项目（pilot engagement）可以有多个验收节点

### 9.2 多对多映射关系

- 一个收费节点可以关联一个或多个验收节点
- 一个验收节点也可以服务于一个或多个收费节点

但当前阶段建议尽量保持简单，优先使用：

**一个收费节点对应一个主验收节点**

### 9.3 关系表达目标

三者之间至少必须能回答以下问题：

- 这是哪个客户、哪个试点项目
- 当前收费节点是什么
- 当前收费节点对应哪个验收节点
- 当前是否已具备收费依据
- 当前是否已完成验收
- 当前对应的留痕材料在哪里

---

## 10. 当前阶段推荐映射方式

### 10.1 试点项目层

试点项目建议由合同、项目方案、试点范围说明、内部项目命名共同定义。

### 10.2 验收节点层

验收节点建议优先锚定以下材料组合：

- day1 check
- Runbook 执行记录
- operation_report_v1 / customer-facing report
- evidence export / evidence bundle
- acceptance_result 相关结果
- 客户确认邮件/签字/会议纪要
- 最终交付说明

### 10.3 收费节点层

收费节点建议优先锚定以下商务材料：

- 合同约定
- 报价或商务确认单
- 开票申请记录
- 收款确认记录
- 与验收节点关联后的签收说明

### 10.4 关键约束

技术材料可以支撑收费节点，但不能自动生成收费结论。

也就是说：

- “有 receipt” ≠ “可以收费”
- “有 acceptance_result” ≠ “已完成商务验收”
- “有内部成本” ≠ “形成客户应收”

---

## 11. 当前可复用材料与不应复用材料

### 11.1 可复用为验收依据的材料

当前可复用材料包括但不限于：

- day1 check 结果
- Runbook
- operation detail
- operation report
- customer-facing 报告
- evidence export
- evidence bundle
- acceptance result
- 交付说明
- 导出文件
- 项目纪要

这些材料可作为验收节点的 evidence_refs 或 acceptance_basis 来源。

### 11.2 不应直接复用为收费对象的材料

以下材料不应直接被定义为收费对象：

- operation cost
- resource cost
- water / electric / chemical cost
- task id
- receipt id
- evidence artifact id
- 技术告警
- 技术排障记录

这些材料最多只能作为背景信息，不构成客户付款对象。

---

## 12. 当前是否需要代码承载 patch

### 12.1 判断结论

**本轮不触发代码对象承载 patch。**

### 12.2 原因

原因如下：

1. 当前仓库已经具备足够的交付与验收锚点，可支持文档级最小模型落地。
2. 当前缺少的不是“执行链对象”，而是“商务边界与节点口径”的统一定义。
3. 如果此时贸然补 billing / contract / invoice 对象，容易越界成半套不完整的 billing 系统。
4. 当前任务书明确要求先文档、先边界，再决定是否补代码。

### 12.3 本轮结论

本轮以文档冻结最小模型为主，不新增 server 内部商务对象承载代码。

如后续确需 machine-readable 的内部商务台账，应单独立项，并严格限制为：

- internal-only
- admin-facing
- read-only or minimal-write
- 不进入客户主界面
- 不扩展为支付系统

---

## 13. 推荐的最小执行方式

当前阶段推荐按以下方式执行：

### 13.1 建立试点项目台账

由商务/交付建立试点项目台账，明确：

- 客户
- 项目
- 范围
- 负责人
- 付款节点
- 验收节点

### 13.2 为每个收费节点绑定主验收节点

例如：

- 合同启动款 → 合同确认
- 首日交付款 → DAY1_READY
- 中期确认款 → TRIAL_RUN_CONFIRMED 或 REPORT_DELIVERED
- 最终验收款 → FINAL_ACCEPTED

### 13.3 为每个验收节点绑定留痕材料

例如：

- day1 check
- Runbook
- report export
- evidence export
- acceptance result
- customer confirmation

### 13.4 形成归档链路

最终应能归档出：

- 试点项目
- 收费节点
- 验收节点
- 验收材料
- 开票与收款记录
- 签收说明

---

## 14. 当前阶段正式结论

当前 GEOX 在商务闭环上已经具备以下条件：

- 可定义试点项目
- 可定义收费节点
- 可定义验收节点
- 可找到真实交付与验收材料来源
- 可建立收费与验收的对应关系

当前 GEOX 仍不具备以下条件：

- 完整 billing 系统
- 完整 invoice 系统
- 完整 contract 系统
- 自动 payment 系统
- 客户自助商务门户

因此，本轮最小模型正式结论为：

**GEOX 当前阶段采用“试点项目（pilot engagement）—收费节点（billing milestone）—验收节点（acceptance milestone）”的文档化最小模型收口商务闭环；本轮不触发代码对象承载补丁。**