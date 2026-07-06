<!-- docs/frontend-productization/PFE-11-I18N-COVERAGE-MATRIX.md -->
# PFE-11 i18n Coverage Matrix

## 0. Matrix status

This matrix records the formal zh-CN / en-US coverage baseline. It does not claim full locale formatting or native-speaker translation certification.

| source file / component | uses LocaleProvider / useLocale / localizedText | hardcoded visible copy allowed | reason if allowed | aria label localized | state copy localized | table headers localized | action labels localized | status/nonclaim localized | later owner |
|---|---|---|---|---|---|---|---|---|---|
| `apps/web/src/lib/locale.tsx` | yes | yes | locale primitive strings and helper names | n/a | n/a | n/a | n/a | n/a | PFE-12 |
| `apps/web/src/components/common/LocaleToggle.tsx` | yes | yes | visible locale names are intentional labels | yes | n/a | n/a | yes | n/a | PFE-12 |
| `apps/web/src/lib/productSurfaceLabels.ts` | localizedText source | yes | formal copy catalog | yes | yes | yes | yes | yes | PFE-12 |
| `apps/web/src/layouts/CustomerLayout.tsx` | yes | limited | shell binds catalog copy | yes | yes | n/a | yes | yes | PFE-12 |
| `apps/web/src/layouts/OperatorLayout.tsx` | yes | limited | shell binds catalog copy | yes | yes | n/a | yes | yes | PFE-12 |
| `apps/web/src/layouts/AdminLayout.tsx` | yes | limited | shell binds catalog copy | yes | yes | n/a | yes | yes | PFE-12 |
| `apps/web/src/views/LoginPage.tsx` | partial | limited | safe login state copy remains source-local | yes | yes | n/a | yes | n/a | PFE-12 |
| `apps/web/src/design-system/product/ProductEmptyState.tsx` | no | limited | primitive receives copy through props | yes | yes | n/a | n/a | n/a | PFE-12 |
| `apps/web/src/design-system/product/ProductLoadingState.tsx` | no | limited | primitive receives copy through props | yes | yes | n/a | n/a | n/a | PFE-12 |
| `apps/web/src/design-system/product/ProductErrorState.tsx` | no | limited | primitive receives safe copy through props | yes | yes | n/a | yes | n/a | PFE-12 |
| `apps/web/src/design-system/product/ProductStateBlock.tsx` | no | limited | primitive receives copy through props | yes | yes | n/a | n/a | yes | PFE-12 |
| `apps/web/src/design-system/product/ProductDataTable.tsx` | no | limited | default empty state is safe fallback | yes | yes | yes | n/a | n/a | PFE-12 |
| `apps/web/src/features/customer/pages/*` | mixed | limited | customer catalog coverage exists; full extraction deferred | mixed | mixed | mixed | mixed | mixed | PFE-12 |
| `apps/web/src/features/operator/pages/*` | mixed | limited | operator catalog coverage exists; full extraction deferred | mixed | mixed | mixed | mixed | mixed | PFE-12 |
| `apps/web/src/features/operator/fieldRuntime/*` | mixed | limited | field runtime catalog coverage exists; full extraction deferred | mixed | mixed | mixed | mixed | mixed | PFE-12 |
| `apps/web/src/features/operator/replayDemo/*` | mixed | limited | replay demo catalog coverage exists; full extraction deferred | mixed | mixed | mixed | mixed | mixed | PFE-12 |
| `apps/web/src/features/operator/pilotReadiness/*` | mixed | limited | pilot readiness catalog coverage exists; full extraction deferred | mixed | mixed | mixed | mixed | mixed | PFE-12 |
| `apps/web/src/features/admin/pages/*` | mixed | limited | admin catalog coverage exists; full extraction deferred | mixed | mixed | mixed | mixed | mixed | PFE-12 |
| `apps/web/src/components/common/RuntimeTextGuard.tsx` | no | limited | fallback safety net only | n/a | n/a | n/a | n/a | n/a | PFE-12 |

## 1. Coverage interpretation

`yes` means formal coverage is established in code. `mixed` means PFE-11 has a documented catalog baseline and scoped guard, while full page-string extraction remains a later incremental task. `limited` means hardcoded visible copy is acceptable only under the documented reason and must not violate role boundaries.

## 2. Hardcoded copy rule

PFE-11 blocks unsafe visible copy by role scope. It does not block all string literals because route paths, CSS classes, data attributes, enum values, source ids, table values, and trace ids are not automatically product copy.
