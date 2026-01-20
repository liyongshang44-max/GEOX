🍎 Apple II · Judge — Runtime / API Contract v1
Doc ID：GEOX-AII-06
Status：READY TO FREEZE
Applies to：Apple II（Judge）

Depends on：
• GEOX-AII-01 ProblemStateV1（FROZEN）
• GEOX-AII-02 Pipeline v1（FROZEN）
• GEOX-AII-03 ReferenceViewV1（FROZEN）
• GEOX-AII-05 LBCandidateV1（FROZEN）
• GEOX-AII-00-APP-A Enums & Constraints（FROZEN）
• Apple I Phase-5 APIs（Series, Ledger read）
• GEOX-P0-00 / P0-01 / P0-02（FROZEN）

────────────────────────────────

冻结声明（Constitutional Statement）

本文件冻结 Apple II · Judge 的运行形态、持久化语义与 API 契约，确保：

• Judge 可独立部署  
• Judge 只读依赖 Apple I，不修改其任何行为  
• 同一输入 ⇒ 同一判定结果（可回放、可审计）  
• append-only 持久化，不表达“当前真值”  
• 默认沉默（silent-by-default）：无 ProblemState 时返回空列表，而非 OK  

────────────────────────────────
1. Runtime 形态（FROZEN）

1.1 Service Layout  
• 推荐：新增服务 apps/judge（Node / TypeScript）  
• 可通过现有 apps/server 提供代理路由  
• 不得改变 Apple I 任何 API 行为或语义  

────────────────────────────────
2. Storage & Persistence（Judge 自有存储，FROZEN）

### 2.1 Append-only Rule（FROZEN）

Apple II · Judge 的所有输出对象：

• ProblemStateV1  
• AO-SENSE  
• ReferenceViewV1  
• LBCandidateV1  

均采用 **append-only 写入模型**。

禁止：
• 覆盖 / 更新 / 幂等替换  
• 删除或“修正历史判定”  

Judge 不维护“当前真值”，只记录“某次判定曾经发生”。

────────────────────────────────
### 2.2 Run Record Rule（FROZEN）

每一次 `POST /api/judge/run`：

• **必须生成唯一 run_id 并返回**
• run_id 表示一次完整、确定性的 Judge 执行实例

persist 语义冻结如下：

• persist = false  
  – run_id 仅用于响应追踪  
  – 不保证任何对象可被后续查询  
  – 不要求落库  

• persist = true  
  – 必须 append-only 持久化 RunRecord  
  – RunRecord 最小字段：
    • run_id
    • created_at_ts
    • subjectRef
    • scale
    • window
    • pipeline_version
    • config_profile
    • determinism_hash
    • silent
    • emitted_problem_state_id?（若存在）

• 若 persist = true 且响应中包含 ProblemState / AO-SENSE / ReferenceView / LBCandidate：
  – 这些对象 **必须与 run_id 绑定**（字段或外键）
  – 禁止产生“无 run_id 的悬空对象”

────────────────────────────────
3. Determinism & Hashing（FROZEN）

### 3.1 Determinism Rule（FROZEN）

在相同：
• Evidence  
• QC  
• subjectRef  
• scale  
• window  
• config_profile  
• pipeline_version  

条件下：

Judge Pipeline 必须产生：
• 相同的 ProblemState（或同样的沉默）
• 相同的 AO-SENSE / ReferenceView / LBCandidate（若存在）

禁止：
• 随机性  
• 当前时间影响判定  
• 非确定性遍历（集合必须排序，tie-breaker 固定）

────────────────────────────────
### 3.2 determinism_hash 定义（FROZEN）

determinism_hash = hash(canonical_input_bundle)

canonical_input_bundle 必须是 **结构化、可序列化的 canonical JSON**，至少包含：

• subjectRef  
• scale  
• window  
• pipeline_version  
• config_profile（或其 hash）  
• canonicalized_input_refs  

canonicalized_input_refs 至少包含（固定排序）：
• 所有 ledger_slice 查询参数快照  
• 所有 series_query 查询参数快照  
• 所有 reference_view_id（若使用）

明确禁止纳入 determinism_hash：
• run_id  
• created_at_ts  
• UUID  
• 任何生成时刻相关字段  

────────────────────────────────
4. Core API（FROZEN）

────────────────
4.1 POST /api/judge/run

用途：  
对给定 subjectRef + scale + window 执行 Judge Pipeline。

Request（JSON）：
• subjectRef { projectId, groupId?, plotId?, blockId? }
• scale
• window { startTs, endTs }
• options（可选）：
  • persist: boolean
  • include_reference_views: boolean（默认 false）
  • include_lb_candidates: boolean（默认 false）
  • config_profile: string（冻结配置集标识）

冻结规则：
• include_* 只影响 response payload
• **不得影响 Pipeline 判定路径**
• ReferenceView / LBCandidate 是否生成，仅由 Pipeline 决定

Response（JSON）：
• run_id
• problem_states: ProblemStateV1[]（0 或 1）
• ao_sense: AO-SENSE[]
• reference_views?: ReferenceViewV1[]
• lb_candidates?: LBCandidateV1[]
• silent: boolean
• run_meta:
  • pipeline_version
  • config_profile
  • inputs_used:
    • used_state_vector: boolean
    • used_reference: boolean
  • determinism_hash

冻结断言：
• silent = true ⇒ problem_states 必须为空数组
• 不得返回 OK / NORMAL / STABLE 等正向裁决

────────────────
4.2 GET /api/judge/problem_states

Query params：
• run_id（可选，精确查询某次 run）
或
• subjectRef + scale + window.startTs + window.endTs（自然键）
• limit（可选）

排序规则（FROZEN）：
• created_at_ts DESC
• limit 在排序后截断

────────────────
4.3 GET /api/judge/reference_views

Query params：
• run_id
或
• subjectRef + scale + window + kind + metric

冻结规则：
• 同一 natural key 在单次 run 内最多 1 个
• 跨 run 通过 run_id 区分

────────────────
4.4 GET /api/judge/ao_sense

Query params：
• problem_state_id（必填）
或
• run_id

────────────────────────────────
5. Config Profile Governance（FROZEN）

• config_profile 必须对应 repo 内冻结配置集  
• Unknown config_profile ⇒ 400  
• config_profile 或其 hash **必须进入 determinism_hash**  
• 不得动态注入阈值或运行态修改  

────────────────────────────────
6. Integration with Apple I（FROZEN）

• Judge 只读调用 Apple I  
• 不得写入 Evidence Ledger  
• 不得改变 Series API 语义（不插值、不补点、不平滑）  

────────────────────────────────
7. Error Handling（FROZEN）

• 4xx：请求缺失 subjectRef / scale / window，或 window 非法  
• 503：Apple I 不可达（不得用缓存冒充）  
• 5xx：内部错误（不得返回猜测输出）

────────────────────────────────
8. Security / Auth Boundary（FROZEN）

• 鉴权（若存在）仅决定是否允许调用  
• **不得影响判定逻辑、阈值或输出内容**
• 不得因用户/角色不同产生不同 ProblemState

────────────────────────────────
9. Freeze Verdict

• Runtime / API Contract 已冻结  
• append-only + run_id 轨迹语义已冻结  
• determinism_hash 可验收  
• Judge 默认沉默，不表达当前真值  
• Judge 只声明问题态，不做决策  

READY TO FREEZE