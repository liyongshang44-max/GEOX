<!-- docs/frontend-productization/PFE-8-STATE-COPY-GUIDE.md -->
# PFE-8 State Copy Guide

## 0. Purpose

This guide defines role-safe state copy for empty, loading, unavailable, permission-limited, degraded, blocked, future/url-only/do-not-build, and safe error states.

PFE-8 state copy must explain what the user can safely know. It must not introduce a new product capability, mutation, operational workflow, or internal diagnostic surface.

## 1. Global rules

Allowed global patterns:

```text
Loading [specific content]
No [records] are available for this scope.
This readback is temporarily unavailable.
Only authorized scope is shown.
This source is degraded, so partial information is shown.
Return to the previous report.
Open a safe report entry.
Try reading this page again.
```

Forbidden global patterns:

```text
raw diagnostic detail
private payload detail
implementation stack text
internal debug text
implicit write action
implicit approval action
implicit execution action
production-online claim without source proof
```

## 2. Customer copy

Customer copy must use report language.

Allowed:

```text
No report entries are available for your authorized scope.
This report is temporarily unavailable.
Only authorized fields are shown.
Export content is not ready yet.
Return to reports.
```

Forbidden:

```text
internal review language
operator-only state language
raw source vocabulary
internal workflow vocabulary
write or dispatch suggestions
```

## 3. Operator copy

Operator copy must use runtime review and readback language.

Allowed:

```text
Source readback is unavailable.
Replay-backed source is unavailable.
Forecast evidence is not available for this field.
Calibration review has no rows for this scope.
Gateway snapshot is unavailable.
```

Forbidden:

```text
dispatch instruction
automatic approval claim
device control language
field pilot start claim
production-online claim
```

## 4. Admin copy

Admin copy must use internal governance and readback language.

Allowed:

```text
No governance rows are available.
Inventory readback is unavailable.
Healthz readback is degraded.
Registry readback is unavailable.
Route naming debt remains deferred.
```

Forbidden:

```text
service operation instruction
job execution instruction
skill run instruction
production readiness proof
write action language
control action language
```

## 5. Loading policy

Loading copy must be specific. A spinner without readable copy is not acceptable. Loading copy must not promise that data will appear or that a workflow has succeeded.

## 6. Empty policy

Empty means the source can be read but no records are present for the current scope. Empty must not be used for unavailable sources.

## 7. Unavailable and degraded policy

Unavailable means the page cannot read a required source. Degraded means partial content is shown while one or more sources are incomplete. Copy must be direct and must not hide failure as an empty state.

## 8. Error policy

Error copy must be safe. It can include a short trace id when intentionally supplied by the caller. It must not display raw diagnostic detail or private implementation output.

## 9. Safe next action policy

Allowed safe actions are navigation, return, print, refresh/read-again, and opening a safe report entry. Forbidden next actions are any action that writes, approves, dispatches, controls, starts a workflow, or changes backend state.
