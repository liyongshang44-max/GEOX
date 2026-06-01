# PR18 Frontend Productization Manual Review

Status: PARTIAL_CI_REVIEWED_MANUAL_REVIEW_PENDING

This document records the PR18 frontend productization manual review boundary. It is intentionally a checklist, not a replacement for CI artifacts.

## Current review state

- CI review: completed by the relevant frontend and governance gates when the PR workflow is green.
- Manual product review: not completed in this repository snapshot.
- Manual browser walkthrough: not completed in this repository snapshot.
- Customer/operator wording review: CI-gated, but still requires human sign-off before commercial demo use.

## CI-reviewed scope

The following are expected to be covered by automated gates:

- frontend runtime page audit
- customer product language gate
- operator product language gate
- operator device offline workflow gate
- operator device offline backend action boundary gate
- controlled pilot release gate

## PR18 manual review checklist

- [ ] Open `/operator/workbench` and confirm device-offline todo links include concrete `device_id`, `field_id`, and `online_status=OFFLINE` when a device is located.
- [ ] Open `/operator/devices-alerts?focus=device_offline&device_id=...&field_id=...&online_status=OFFLINE` and confirm the target device is highlighted.
- [ ] Click `记录设备离线确认` and confirm the page calls the backend audit route rather than creating a local audit id.
- [ ] Click `标记需人工核查` and confirm the page calls the backend follow-up audit route.
- [ ] Click `创建维护任务候选` and confirm the page calls the backend task-candidate audit route and does not create AO-ACT automatically.
- [ ] Confirm aggregate-only offline statistics are not presented as a located device.
- [ ] Confirm no customer-visible ROI, formal acceptance, or formal Field Memory claim appears before downstream evidence exists.
- [ ] Confirm the UI message is understandable to an operator and does not leak engineering-only terms.

## Current PR18 status summary

```json
{
  "status": "PARTIAL_CI_REVIEWED_MANUAL_REVIEW_PENDING",
  "ci_reviewed": true,
  "manual_review_completed": false,
  "manual_browser_walkthrough_completed": false,
  "source_of_truth_for_ci": "latest_ci_artifact",
  "source_of_truth_for_manual_review": "human_signed_review_note_required"
}
```

## Release note

A green CI run is required before merge. Manual product review remains a separate commercial-readiness step and should be completed before using the PR18 flow in a paid/customer-facing demo.
