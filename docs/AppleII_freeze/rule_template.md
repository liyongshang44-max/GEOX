——————————————

Judge Rule Template (Single Source of Truth)

This document defines the mandatory template for introducing any new rule into the GEOX Judge Pipeline.

Any rule that cannot be fully specified using this template MUST NOT be implemented.

——————————————
	1.	Rule Identity

Rule Name
A stable, unique, enumerable identifier string.

Stage
Exactly one of the following (or future explicitly-added stages):
Stage-2 Sufficiency
Stage-3 Time Coverage
Stage-4 QC
Stage-5 Reference / Conflict

A rule MUST belong to exactly one stage.

——————————————
	2.	Single-Dimension Principle

This rule affects exactly ONE of the following dimensions:

Evidence Presence
Time Axis Availability
Evidence Trustworthiness

The affected dimension MUST be explicitly stated.

A rule that attempts to affect more than one dimension is invalid.

——————————————
	3.	Inputs

The rule MUST explicitly list which inputs it reads.
Allowed inputs are limited to:

raw_sample_v1
marker_v1
derived reference views (only in later stages)

The rule MUST NOT read any undeclared inputs.

——————————————
	4.	Exclusion Semantics

The rule MUST answer exactly ONE of the following questions:

Does this rule cause some raw samples to be treated as “no evidence”?
Does this rule cause some time ranges to be treated as “not applicable”?
Does this rule only affect trust without excluding evidence or time?

Additionally, the rule MUST state:

Whether excluded facts still appear in input_fact_ids.

——————————————
	5.	Compatibility With Core Semantics (C-2 / C-3)

The rule MUST explicitly declare:

Whether it executes before or after C-2 (time-axis exclusion).
Whether it executes before or after C-3 (missing-origin exclusion).

The rule MUST NOT override or redefine C-2 or C-3 semantics.

——————————————
	6.	SQL Reproducibility

The rule’s core decision logic MUST satisfy:

It can be reproduced using one or more SQL queries over facts_replay_v1.
The SQL result MUST match the Judge in-memory computation.

If SQL equivalence is not possible, the rule is invalid.

——————————————
	7.	Configuration Compatibility (SSOT)

All rule parameters MUST be expressible via config/judge/*.json.

Rules MUST NOT rely on:
Hardcoded constants
Environment-specific behavior
Implicit defaults

——————————————
	8.	Failure Semantics

The rule MUST define:

The problem_type emitted when the rule fails.
Whether the failure represents insufficiency, uncertainty, or conflict.

Problem types MUST NOT be semantically overloaded.

——————————————
	9.	Traceability and input_fact_ids

The rule MUST declare:

Whether it adds supporting_evidence_refs.
Whether it modifies input_fact_ids (generally disallowed).

Principle:
input_fact_ids represent “facts observed”, not “facts accepted”.

——————————————
	10.	Hard Constraints (Non-Negotiable)

A rule MUST NOT:

Delete facts
Implicitly change metric meaning
Implicitly change time resolution
Introduce unexplained thresholds
Depend on execution order or side effects

——————————————
	11.	Completeness Check

A valid rule MUST be fully describable as:

Which stage it runs in
Which inputs it reads
Which single dimension it affects
What it excludes or modifies
How it is verified in SQL
What failure semantics it produces

If any of the above cannot be stated, the rule MUST be rejected.

——————————————

Conclusion

Judge rules are adjudication clauses, not ad-hoc logic.

Every rule must be reviewable, reproducible, and closed under the pipeline semantics before implementation.

——————————————

文件名建议：
rule-template.txt

存放路径建议：
docs/judge/rule-template.txt
