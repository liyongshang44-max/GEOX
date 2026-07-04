<!-- docs/frontend-productization/H60-FIELD-RUNTIME-CALIBRATION-TAB.md -->
# H60-I Field Runtime Calibration Tab

Status: H60-I CALIBRATION TAB
Scope: Frontend Productization / Field Runtime Calibration / Read-only Calibration Replay Adapter
Write impact: NONE
Backend impact: NONE
DB impact: NONE
Route topology impact: NONE

H60-I migrates Calibration tab only.

Canonical route:

```text
/operator/fields/:fieldId/calibration
```

Legacy route remains:

```text
/operator/twin/fields/:fieldId/calibration
```

Source:

```text
operator_field_twin_calibration_replay_v1
```

H60-I reuses existing read-only `fetchOperatorFieldTwinCalibrationReplay`.
H60-I does not create backend contract.
H60-I keeps `App.tsx` and `operatorFieldRuntimeRoutes.tsx` unchanged.
H60-I does not migrate Health / Audit.

Canonical product surface:

```text
Calibration
Calibration Review
Calibration Replay
Replay Timeline
Calibration Inputs
Calibration Summary
Replay Gaps
Calibration Boundary
```

Review availability is metadata only.
Write-ready flags are metadata only.
Replay gaps are review metadata.

Implementation note:

```text
FieldRuntimeCalibrationTabPanel.tsx -> FieldRuntimeCalibrationViewPanel.tsx
```

Expected next phase:

```text
H60-K Audit Drawer / Audit Tab
```
