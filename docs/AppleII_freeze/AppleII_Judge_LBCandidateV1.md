好，我已经采纳你刚才确认的“全部建议”，并把它们实质性地融入到 🍎 Apple II · Judge — LBCandidateV1 Minimal Schema 中，而不是只加点评。

下面是完整修订后的最终版文本（你可以直接整体复制，作为 GEOX-AII-05.md 冻结版本使用）。
我会在关键新增处用 【FROZEN ADDITION】 标注，方便你快速核查；这些标注本身可以在最终仓库里删掉。

⸻

🍎 Apple II · Judge — LBCandidateV1 Minimal Schema（READY TO FREEZE）

Doc ID：GEOX-AII-05
Status：READY TO FREEZE
Applies to：Apple II（Judge）

Depends on：
	•	GEOX-AII-00-APP-A Enums & Constraints（Enum 规范真源）
	•	GEOX-AII-01 ProblemStateV1（FROZEN）
	•	GEOX-AII-06 Runtime / API Contract v1（FROZEN）
	•	GEOX-P0-00 SpatialUnit & Scale Policy（FROZEN）
	•	GEOX-P0-01 Evidence & QC Policy（FROZEN）

────────────────────────────────

冻结声明（Constitutional Statement）

LBCandidateV1 是 Apple II 的非权威解释结构（non-authoritative cognitive side-asset），
用于描述“可能的解释结构 / 假设形态”，但永远不构成问题判定或系统结论。

硬约束（FROZEN）
	•	Apple II 的唯一问题锚点始终且仅有：ProblemStateV1
	•	非权威性（Non-authoritative）：
LBCandidateV1 永远不是判定锚点，不得被任何下游系统当作事实、结论或状态使用
	•	非输入性（No Backflow）：
LBCandidateV1 不得作为 ProblemState / ReferenceView / AO-SENSE 的输入或证据
（包括但不限于：ID、摘要、派生指标、评分、模型输出）
	•	不可替代性（No Substitution）：
任何 API / UI / 外部系统 不得用 LBCandidate 的存在、数量或 status_word：
	•	替代 ProblemState 的存在
	•	暗示“系统正常 / 异常 / 稳定”
	•	产生 OK / NORMAL / SAFE 等正向语义
	•	run_id MUST：
每一个 LBCandidateV1 必须绑定一个 run_id，作为审计锚点
	•	独立持久化允许：
LBCandidateV1 允许在 Judge 自有存储中独立持久化（append-only），
其存在 不代表问题存在或不存在

────────────────────────────────

字段语义（Minimal Fields, FROZEN）

LBCandidateV1 的最小字段集合如下（字段名冻结）：
	•	type：固定 "lb_candidate_v1"
	•	schema_version：语义化版本（例如 1.0.0）
	•	lb_candidate_id：全局唯一 ID（建议 UUID）
	•	created_at_ts：生成时间（ms）
	•	run_id：必填；来自 /api/judge/run 的本次运行
	•	subjectRef：身份锚定 only
（projectId + groupId/plotId/blockId；不得携带语义字段）
	•	scale：string（必须与 Scale Policy 一致）
	•	window：{ startTs, endTs }（必须与 run 输入一致）
	•	status_word：StatusWordV1（中性状态词，来自 APP-A）
	•	title：可选；中性标题（不得含控制 / 建议 / 诊断语义）
	•	hypothesis：可选；中性解释文本（不得含控制 / 建议 / 诊断语义）
	•	metric：可选
	•	v1 仅允许 单一主指标
	•	多指标解释必须通过 多个 LBCandidate 表达，不得在单对象内聚合
	•	supporting_evidence_refs：可选
	•	EvidenceRef[]
	•	只允许 ledger_slice / state_vector / reference_view / qc_summary
	•	禁止引用 ProblemState / LBCandidate / AO / Control
	•	problem_state_id：可选
	•	若填写，必须指向 同一 run_id 中产生的 ProblemStateV1
	•	禁止跨 run 引用 ProblemState（防止事后解释回写历史）

明确禁止（FROZEN）
	•	任何控制 / 许可 / 建议 / 诊断字段
	•	任何 risk_level / allow / deny / priority / should / recommend / cause 等语义
	•	任何将 LBCandidate 解释为“当前真值”的使用方式

────────────────────────────────

JSON Schema（Draft 2020-12，READY TO FREEZE）

说明（FROZEN）：
	•	本 Schema 仅定义结构与枚举
	•	语义禁区由 APP-A + 审计测试保障
	•	跨字段规则（endTs > startTs、problem_state_id 同 run）由实现与 Golden Tests 校验
	•	Enum 规范真源：GEOX-AII-00-APP-A{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "geox://schemas/apple_ii/lb_candidate_v1.schema.json",
  "title": "LBCandidateV1",
  "type": "object",
  "additionalProperties": false,
  "description": "Apple II Judge non-authoritative interpretation structure. MUST NOT be treated as a decision, state, or permission signal. MUST NOT feed back into ProblemState/ReferenceView/AO-SENSE. run_id MUST be present for auditability.",
  "required": [
    "type",
    "schema_version",
    "lb_candidate_id",
    "created_at_ts",
    "run_id",
    "subjectRef",
    "scale",
    "window",
    "status_word"
  ],
  "properties": {
    "type": { "const": "lb_candidate_v1" },

    "schema_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },

    "lb_candidate_id": {
      "type": "string",
      "minLength": 8
    },

    "created_at_ts": {
      "type": "integer",
      "minimum": 1
    },

    "run_id": {
      "type": "string",
      "minLength": 6,
      "description": "MUST. Audit anchor for the Judge run that produced this candidate."
    },

    "problem_state_id": {
      "type": ["string", "null"],
      "description": "Optional. If present, MUST point to a ProblemState produced in the SAME run_id. Cross-run reference is forbidden."
    },

    "subjectRef": {
      "type": "object",
      "additionalProperties": false,
      "required": ["projectId"],
      "properties": {
        "projectId": { "type": "string", "minLength": 1 },
        "groupId": { "type": "string", "minLength": 1 },
        "plotId": { "type": "string", "minLength": 1 },
        "blockId": { "type": "string", "minLength": 1 }
      }
    },

    "scale": { "type": "string", "minLength": 1 },

    "window": {
      "type": "object",
      "additionalProperties": false,
      "required": ["startTs", "endTs"],
      "properties": {
        "startTs": { "type": "integer", "minimum": 1 },
        "endTs": { "type": "integer", "minimum": 1 }
      }
    },

    "status_word": {
      "type": "string",
      "enum": ["STABLE", "DRIFTING", "UNSTABLE", "NEEDS_VERIFICATION"]
    },

    "title": {
      "type": ["string", "null"],
      "maxLength": 120
    },

    "hypothesis": {
      "type": ["string", "null"],
      "maxLength": 800
    },

    "metric": {
      "type": ["string", "null"]
    },

    "supporting_evidence_refs": {
      "type": "array",
      "items": { "$ref": "#/$defs/EvidenceRef" }
    }
  },

  "$defs": {
    "EvidenceRef": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "ref_id"],
      "properties": {
        "kind": {
          "type": "string",
          "enum": ["ledger_slice", "state_vector", "reference_view", "qc_summary"]
        },
        "ref_id": {
          "type": "string",
          "minLength": 1
        },
        "note": {
          "type": ["string", "null"],
          "maxLength": 280
        },
        "time_range": {
          "type": ["object", "null"],
          "additionalProperties": false,
          "required": ["startTs", "endTs"],
          "properties": {
            "startTs": { "type": "integer", "minimum": 1 },
            "endTs": { "type": "integer", "minimum": 1 }
          }
        }
      }
    }
  }
}