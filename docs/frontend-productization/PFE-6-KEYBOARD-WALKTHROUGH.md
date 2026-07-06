<!-- docs/frontend-productization/PFE-6-KEYBOARD-WALKTHROUGH.md -->
# PFE-6 Keyboard Walkthrough

## 0. Scope

This walkthrough records route-level keyboard expectations for the Product Frontend v1 accessibility baseline. It is a manual checklist, not an automated certification result.

## 1. Common keyboard expectations

Tab moves forward through interactive elements.

Shift+Tab moves backward through interactive elements.

Enter activates links and buttons.

Space activates buttons.

Escape has no global modal behavior in PFE-6 routes unless a route-specific overlay exists.

No formal route should trap keyboard focus.

Focus indicators must remain visible on links, buttons, table overflow regions, skip links, and route-link tabs.

## 2. Login -> Customer Dashboard -> Customer Reports -> Export

Route path:

```text
/login -> /customer/dashboard -> /customer/reports -> /customer/export
```

Expected flow:

1. Tab reaches login controls in visual order.
2. Enter or Space activates the active login action when focused.
3. After navigation to Customer Dashboard, the ProductSkipLink appears as the first product-surface focus target.
4. Enter on ProductSkipLink moves focus to `#product-main-content`.
5. Tab reaches Customer shell navigation, dashboard report links, right rail cards, and export/report links in predictable order.
6. Shift+Tab returns in reverse order without losing focus.
7. Enter activates Customer Reports navigation links.
8. Reports Center links have readable labels.
9. Export route has a visible heading and keyboard reachable return/print controls.
10. No keyboard trap is expected.

## 3. Login -> Operator Twin -> Field Runtime -> Forecast tab -> Gateway Demo

Route path:

```text
/login -> /operator/twin -> /operator/fields/:fieldId -> /operator/fields/:fieldId/forecast -> /operator/twin/gateway-demo
```

Expected flow:

1. Tab reaches Operator shell navigation and Operator Twin overview links.
2. Enter opens Field Runtime from the field runtime entry link.
3. Field Runtime tabs are route links, not half-implemented ARIA tabs.
4. The active route link exposes current-page semantics through route navigation styling or aria-current where available.
5. Tab order reaches forecast tab link, forecast content, source identity, status badges, and trace/readback sections.
6. Enter activates Gateway Demo route link when focused.
7. Gateway Demo sections and trace references are reachable in document order.
8. Shift+Tab returns through the same path in reverse order.
9. No roving tabindex is introduced in PFE-6.
10. No keyboard trap is expected.

## 4. Login -> Admin Dashboard -> Admin Devices -> Admin Healthz

Route path:

```text
/login -> /admin/dashboard -> /admin/devices -> /admin/healthz
```

Expected flow:

1. Tab reaches Admin shell navigation after login.
2. AdminLayout does not own a nested page-level main landmark.
3. ProductSkipLink moves focus to the formal Admin page `#product-main-content` target.
4. Admin Dashboard compatibility and future-page rows are reachable by table region focus.
5. Enter activates Admin Devices nav link when focused.
6. Admin Devices table overflow region is keyboard focusable.
7. Status is readable as text, not color only.
8. Enter activates Admin Healthz nav link when focused.
9. Admin Healthz records `/admin/health` route naming debt without adding a route.
10. Shift+Tab returns in reverse order without focus loss.
11. No keyboard trap is expected.

## 5. Manual issue handling

Any severe keyboard blocker found during walkthrough must be fixed before PFE-6 merge. Minor screen-reader-matrix gaps can be recorded in the issue register only when keyboard reachability, visible focus, main landmark, heading, status text, and semantic table requirements remain satisfied.
