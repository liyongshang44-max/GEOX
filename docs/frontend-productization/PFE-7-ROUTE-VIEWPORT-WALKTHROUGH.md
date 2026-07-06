<!-- docs/frontend-productization/PFE-7-ROUTE-VIEWPORT-WALKTHROUGH.md -->
# PFE-7 Route Viewport Walkthrough

## 0. Scope

This walkthrough records manual responsive expectations across PFE-7 viewport classes. It is not a screenshot baseline.

Viewport classes:

```text
1440 desktop-wide
1280 desktop-standard
1024 laptop
768 tablet
390 mobile-narrow
```

## 1. Customer walkthrough

Route path:

```text
/customer/dashboard -> /customer/reports -> /customer/export
```

### 1440 desktop-wide

Navigation reachable: customer side nav visible.

Main content readable: dashboard grids and right rail readable.

Tables scroll or stack: ProductDataTable regions remain local scroll when needed.

Aside/right rail behavior: right rail stays readable and does not compress below card minimums.

No page-level horizontal overflow: no page-level overflow hiding is used as a fix.

Focus ring visible: PFE-6 focus-visible and skip-link remain visible.

### 1280 desktop-standard

Navigation reachable: customer side nav remains visible.

Main content readable: dashboard columns reduce when needed.

Tables scroll or stack: report center content remains readable.

Aside/right rail behavior: right rail remains within ProductPageShell aside.

No page-level horizontal overflow: long labels wrap.

Focus ring visible: preserved.

### 1024 laptop

Navigation reachable: shell can stack or wrap without changing nav inventory.

Main content readable: ProductPageShell body stacks main and aside.

Tables scroll or stack: local scroll regions remain keyboard focusable.

Aside/right rail behavior: right rail stacks below main content.

No page-level horizontal overflow: long field names and ids wrap.

Focus ring visible: preserved.

### 768 tablet

Navigation reachable: nav stacks into single-column reachable entries.

Main content readable: metric cards and report cards stack.

Tables scroll or stack: table overflow region remains local.

Aside/right rail behavior: single-column stack.

No page-level horizontal overflow: report/export labels wrap.

Focus ring visible: preserved.

### 390 mobile-narrow

Navigation reachable: nav entries are reachable by keyboard and touch.

Main content readable: all cards are single column.

Tables scroll or stack: ProductDataTable uses local scroll with visible mobile note.

Aside/right rail behavior: right rail appears as normal stacked content.

No page-level horizontal overflow: no body/app/product shell overflow hiding is used.

Focus ring visible: skip link and focused controls are not clipped.

## 2. Operator walkthrough

Route path:

```text
/operator/twin -> /operator/fields -> /operator/fields/:fieldId/forecast -> /operator/twin/gateway-demo
```

### 1440 desktop-wide

Navigation reachable: Operator navigation and route links visible.

Main content readable: runtime overview and source inventory fit wide layout.

Tables scroll or stack: source inventory uses ProductDataTable local scroll when needed.

Aside/right rail behavior: nonclaim aside remains readable.

No page-level horizontal overflow: route paths and ids wrap.

Focus ring visible: route links and table regions show focus.

### 1280 desktop-standard

Navigation reachable: formal operator links remain reachable.

Main content readable: overview and gateway demo grids remain readable.

Tables scroll or stack: local scroll enabled.

Aside/right rail behavior: aside remains within shell width.

No page-level horizontal overflow: long source refs wrap.

Focus ring visible: preserved.

### 1024 laptop

Navigation reachable: Field Runtime route-link tabs wrap.

Main content readable: ProductPageShell body stacks main and aside.

Tables scroll or stack: Field Runtime tables keep local scroll.

Aside/right rail behavior: nonclaim rail stacks.

No page-level horizontal overflow: trace refs wrap anywhere.

Focus ring visible: preserved.

### 768 tablet

Navigation reachable: route-link tabs stack/wrap and remain focusable.

Main content readable: gateway demo grid stacks.

Tables scroll or stack: forecast/evidence/audit tables scroll locally.

Aside/right rail behavior: single-column stack.

No page-level horizontal overflow: long ids wrap.

Focus ring visible: preserved.

### 390 mobile-narrow

Navigation reachable: route-link tabs remain full-width reachable links.

Main content readable: Operator content uses single-column stack.

Tables scroll or stack: tables remain local scroll regions.

Aside/right rail behavior: appears below primary content.

No page-level horizontal overflow: no hidden-overflow shell fix.

Focus ring visible: route-link focus remains visible.

## 3. Admin walkthrough

Route path:

```text
/admin/dashboard -> /admin/devices -> /admin/healthz
```

### 1440 desktop-wide

Navigation reachable: Admin side nav visible.

Main content readable: dashboard and tables fit formal layout.

Tables scroll or stack: ProductDataTable local scroll available.

Aside/right rail behavior: not applicable.

No page-level horizontal overflow: route naming debt wraps.

Focus ring visible: Admin nav and table regions show focus.

### 1280 desktop-standard

Navigation reachable: Admin side nav remains reachable.

Main content readable: metric grid remains three-column or wraps.

Tables scroll or stack: table overflow region available.

Aside/right rail behavior: not applicable.

No page-level horizontal overflow: long labels wrap.

Focus ring visible: preserved.

### 1024 laptop

Navigation reachable: Admin shell can stack without changing nav inventory.

Main content readable: Admin topbar stacks.

Tables scroll or stack: device/healthz tables scroll locally.

Aside/right rail behavior: not applicable.

No page-level horizontal overflow: no page-level hiding fix.

Focus ring visible: preserved.

### 768 tablet

Navigation reachable: Admin nav entries stack.

Main content readable: metric grid becomes single/two column according to width.

Tables scroll or stack: local scroll preserved.

Aside/right rail behavior: not applicable.

No page-level horizontal overflow: future route labels wrap.

Focus ring visible: preserved.

### 390 mobile-narrow

Navigation reachable: Admin nav remains keyboard reachable.

Main content readable: Admin content stacks to one column.

Tables scroll or stack: table overflow is local and keyboard focusable.

Aside/right rail behavior: not applicable.

No page-level horizontal overflow: route debt copy wraps.

Focus ring visible: skip link and focused controls are not clipped.
