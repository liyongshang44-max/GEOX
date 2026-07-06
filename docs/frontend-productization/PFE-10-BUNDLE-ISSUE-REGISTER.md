<!-- docs/frontend-productization/PFE-10-BUNDLE-ISSUE-REGISTER.md -->
# PFE-10 Bundle Issue Register

## 0. Register policy

This register records non-blocking bundle and performance-budget gaps after PFE-10. It cannot be used to waive missing build output, a missing checker, invalid budget config, package changes, route topology changes, backend changes, contract or fixture changes, or budget failures.

## 1. Non-blocking issues

| issue id | surface / asset class | severity | reason not fixed in PFE-10 | later owner |
|---|---|---|---|---|
| PFE10-BUNDLE-001 | Lighthouse scoring | medium | PFE-10 v1 gates build output and does not introduce Lighthouse scoring. | PFE-11 |
| PFE10-BUNDLE-002 | RUM / production monitoring | medium | Real-user performance collection is out of scope for this phase. | PFE-12 |
| PFE10-BUNDLE-003 | Browser performance matrix | medium | PFE-10 does not establish a browser matrix. | PFE-11 |
| PFE10-BUNDLE-004 | Device performance matrix | medium | PFE-10 does not establish a device performance matrix. | PFE-11 |
| PFE10-BUNDLE-005 | Pixel-level visual performance tuning | low | Visual tuning belongs to a later visual phase and is not part of bundle hygiene. | PFE-11 |

## 2. Blocking issues not allowed

The following must not be accepted as non-blocking:

```text
build output missing
bundle budget config missing
bundle checker missing
invalid bundle budget JSON
JS gzip budget exceeded
largest JS gzip budget exceeded
CSS gzip budget exceeded
largest CSS gzip budget exceeded
asset count budget exceeded
package or lockfile changed
route topology changed
backend, contract, or fixture changed
CI workflow changed
runtime audit failed
```

## 3. Budget change policy

Future budget changes must include:

```text
measured current value
proposed budget value
reason for change
later owner
confirmation that no new dependency was added only for measurement
```

Silent budget weakening is not accepted.
