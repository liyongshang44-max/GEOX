# GEOX-P0-02 · StateVector Schema v1
Status: FROZEN (external reference, not embedded in this packet)

Apple II MAY optionally consume StateVectorV1 from Apple I.
The full normative schema text is not included here.

Mandatory guardrails for implementation (do not invent beyond this):
1) StateVectorV1 is OPTIONAL input for Apple II (see GEOX-AII-01 Optionality Rule).
2) If StateVector is used for a run, record the fields used in ProblemStateV1.state_inputs_used[].
3) StateVector MUST NOT be treated as advice, diagnosis, or permission; it is neutral state expression only.
