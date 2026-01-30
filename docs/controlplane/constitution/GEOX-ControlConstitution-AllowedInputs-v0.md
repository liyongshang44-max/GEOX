GEOX · Control Constitution
Allowed Inputs v0（裁决层输入白名单）

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Constitutional Allowlist + Negative Spec（输入白名单宪法）

0. 文档目的（Purpose）

本文件用于一次性锁死 Control Constitution 的合法输入集合，
防止裁决层在工程演进中因“方便 / 复用 / 信息更多”而读取不该读取的对象，
从而反向污染解释层、不确定性层或行动前语义。

这是一份“只能读什么”的宪法文件，
不是“可以从哪里推理更多信息”。

1. 核心裁定（一句话）

Control Constitution 只允许读取：
ProblemState + UncertaintyEnvelope + PermissionSet。

除此之外，一切对象均为非法输入，无论其是否“看起来相关”。

2. 允许的输入对象（Allowlist）

以下是 唯一合法 的裁决层输入对象集合。

2.1 ProblemStateV1（问题态锚点）

允许读取：

problem_type

confidence（枚举值本身，不得映射为阈值或权重）

uncertainty_sources（作为“存在性”，不得计数或排序）

state_layer_hint

rate_class_hint

problem_scope

window

subjectRef

supporting_evidence_refs（仅用于可回放引用，不用于再判断）

明确禁止：

将 ProblemState 解释为风险大小

将 confidence 解释为可行动性

将 uncertainty_sources 用作 gating 或阈值判断

裁定：
❌ ProblemState 只能被当作“问题存在的事实”，不能被当作“问题是否严重”的依据。

2.2 UncertaintyEnvelope v0（不确定性描述）

允许读取：

uncertainty_sources[]（仅作为命名集合）

problem_state_ref

supporting_evidence_refs（只用于审计）

明确禁止：

对不确定性来源进行计数、排序、加权

推导“总体不确定性”

以不确定性作为允许/禁止行动的直接理由

裁定：
❌ 不确定性在裁决层只能扩大保守性语境，不能生成积极许可。

注：
“扩大保守性语境”只是一种解释性限制，
不等价于 HardNo/Warn/OK/Priority（这些仍由 Constitution 规则决定）。

2.3 PermissionSet v0（合法行动空间）

允许读取：

candidate_actions[]（action_code，仅作集合存在性）

action_taxonomy_ref（仅用于一致性审计）

window

subjectRef

scale

supporting_evidence_refs（审计用途）

明确禁止：

推断“哪些行动更好”

将 candidate_actions 视为“推荐列表”

将 PermissionSet 当作 gating 或 readiness 信号

裁定：
❌ PermissionSet 只定义空间边界，不定义裁决结果。

3. 明确禁止的输入对象（Blocklist）

以下对象 永久禁止 作为 Control Constitution 的输入：

3.1 Evidence / Raw Data（永久禁止）

raw_samples

time series

markers

qc 明细

reference view 的原始内容

原因：
裁决层一旦直接读证据，就会开始“自己判断世界”。

3.2 Agronomy Interpretation（永久禁止）

任何解释性文本

任何解释性结论

任何 agronomy report / summary

原因：
解释语言必然携带价值倾向，会反向塑造裁决规则。

3.3 Decision / Plan（永久禁止）

decision_plan_v0 的任何字段

任何“行动提议”“方案草案”

原因：
否则裁决层会退化为“验证计划是否合理”的工具。

3.4 AO-ACT / AO-SENSE 执行对象（永久禁止）

ao_act_task

ao_act_receipt

ao_sense_task / receipt

原因：
裁决发生在执行之前；执行事实不得反向影响裁决合法性。

3.5 UI / 人工输入（永久禁止）

UI 状态

人工标注

人类偏好

操作员建议

原因：
裁决层不应感知“谁在看”“谁在用”。

4. 输入组合规则（Composition Rules）
4.1 禁止输入扩展

Control Constitution 不得：

通过配置文件扩展输入

通过插件/回调注入新输入

通过“debug 模式”读取额外对象

裁定：
❌ 输入集合是宪法级冻结项，不得通过实现手段绕过。

4.2 禁止隐式派生输入

不允许从允许输入中：

再派生新状态

再计算中间指标

再引入“简化信号”

裁定：
❌ 裁决层只能使用“对象原样字段”，不得再计算。

4.3 禁止跨窗口 / 跨主体合并

不允许将多个 window 的输入合并

不允许跨 subjectRef 汇总

裁定：
❌ 裁决是局部、当下、上下文封闭的。

5. 与 Control Kernel 的绑定裁定
5.1 Kernel 继承输入白名单

Control Kernel 只能读取：

Control Constitution 已声明的输入

Kernel 不得因实现便利性：

额外读取数据

额外引入上下文

5.2 禁止 Kernel 作为输入扩展器

Kernel 不得：

调用外部服务补充信息

访问数据库查询更多事实

请求 UI 或人工输入

裁定：
❌ Kernel 是纯函数式求值器，不是信息采集器。

6. 违规后果（Enforcement）

若发现任何实现：

读取非白名单对象

或通过间接方式引入等价信息

视为 Control Constitution 越权

处理方式：

实现必须回滚

宪法文件不为实现让步

7. 冻结声明（Freeze Verdict）

本文件冻结了 Control Constitution 的唯一合法输入集合

任何扩展输入的行为，等同于修改系统治理立场

修改本文件，必须进行全局裁定

8. 一句话版本（给工程 / 审计）

裁决层只能在
“问题已被声明、未知已被命名、空间已被限定”
这三件事之上工作。
它不再看世界，只看规则。