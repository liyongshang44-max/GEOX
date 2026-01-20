# GEOX-P0-01 · Evidence & QC Policy
Status: FROZEN (external reference, not embedded in this packet)

Apple II documents depend on GEOX-P0-01 for QC semantics and exclusion/overlay interpretation.
The full normative policy text is not included here.

Mandatory guardrails for implementation (do not invent beyond this):
1) Apple I ledger QC values are authoritative labels (ok/suspect/bad). Do not reinterpret.
2) Series slicing MUST remain strict: no interpolation, smoothing, or filling.
3) Exclusion/marker/overlay detection MUST be configuration-driven (see marker.exclusion_kinds in GEOX-AII-04).
4) QC thresholds (suspect_pct_threshold, bad_pct_threshold) MUST come from configuration or frozen constants, never hard-coded.
