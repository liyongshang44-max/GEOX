GEOX · Control Constitution
Allowed Input Paths v0（可执行字段指针白名单）

Status：READY TO FREEZE
Location：docs/controlplane/constitution/
Type：Executable Allowlist（可执行白名单）

0. 一句话定义

本文件冻结 Control Constitution / Control Kernel 唯一允许读取的字段路径集合。
实现必须以本文件作为 FieldMap 投影与 inputs_used[] 校验真源。

1. 适用对象与命名前缀（冻结）

本白名单覆盖三个输入对象（与 Allowed Inputs v0 对齐）：

problem_state：ProblemStateV1（对象根）

uncertainty_envelope：UncertaintyEnvelope v0（对象根）

permission_set：PermissionSet v0（对象根）

所有路径采用 canonical dot-path（不使用 JSON Pointer 以减少转义复杂度）。
数组用 [] 表示元素位，不允许下标。

例：

problem_state.problem_type

uncertainty_envelope.uncertainty_sources[]

permission_set.candidate_actions[].action_code

2. ProblemStateV1 · Allowed Paths（冻结）

problem_state.subjectRef

problem_state.subjectRef.projectId

problem_state.subjectRef.groupId

problem_state.subjectRef.plotId

problem_state.subjectRef.blockId

problem_state.window.startTs

problem_state.window.endTs

problem_state.problem_type

problem_state.confidence

problem_state.problem_scope

problem_state.state_layer_hint

problem_state.rate_class_hint

problem_state.uncertainty_sources[]

problem_state.supporting_evidence_refs[] (存在性允许；不得解析内容)

3. UncertaintyEnvelope v0 · Allowed Paths（冻结）

uncertainty_envelope.problem_state_ref

uncertainty_envelope.uncertainty_sources[]

uncertainty_envelope.supporting_evidence_refs[] (存在性允许；不得解析内容)

4. PermissionSet v0 · Allowed Paths（冻结）

permission_set.subjectRef

permission_set.subjectRef.projectId

permission_set.subjectRef.groupId

permission_set.subjectRef.plotId

permission_set.subjectRef.blockId

permission_set.window.startTs

permission_set.window.endTs

permission_set.scale

permission_set.action_taxonomy_ref (存在性允许)

permission_set.candidate_actions[].action_code

permission_set.supporting_evidence_refs[] (存在性允许；不得解析内容)

5. 使用纪律（冻结）
5.1 RuleSet Skeleton 的 inputs_used[] 只能从本文件取值

inputs_used[] 的每个元素必须精确匹配本白名单之一。

禁止使用前缀匹配（例如写 problem_state.window 视为非法）；必须写到叶子路径。

5.2 Kernel 投影器必须只投影本白名单字段

Kernel 在求值时，只能访问“FieldMap 投影结果”，不得直接访问原始输入对象。

FieldMap 的 key 只能来自本白名单。

5.3 supporting_evidence_refs 的内容禁止读取

允许读取 ...supporting_evidence_refs[] 的存在性与长度（若实现确需；建议仅 EXISTS）。

禁止解析其内部字段、禁止跟随引用读取 ledger。

6. 冻结声明

本文件是 Allowed Inputs v0 的可执行化版本。

任何新增可读字段必须修改本文件并全局裁定。

实现不得通过“顺手多读字段”绕过本文件。

7. 一句话版本

Allowed Inputs 是理念；Allowed Input Paths 是工程真源。
Kernel 只能看 FieldMap，FieldMap 只能来自这里。