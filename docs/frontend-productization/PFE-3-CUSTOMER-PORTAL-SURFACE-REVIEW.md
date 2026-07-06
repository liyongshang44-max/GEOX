<!-- docs/frontend-productization/PFE-3-CUSTOMER-PORTAL-SURFACE-REVIEW.md -->
# PFE-3 Customer Portal Surface Review

PFE-3 covers nine Customer Portal surfaces.

Implemented surfaces:

- /customer/dashboard -> apps/web/src/features/customer/pages/CustomerDashboardPage.tsx
- /customer/fields -> apps/web/src/views/CustomerFieldsIndexPage.tsx
- /customer/fields/:fieldId -> apps/web/src/features/fields/pages/FieldReportPage.tsx
- /customer/fields/:fieldId/export -> apps/web/src/features/fields/pages/FieldReportExportPage.tsx
- /customer/operations -> apps/web/src/features/customer/pages/CustomerOperationsIndexPage.tsx
- /customer/operations/:operationId -> apps/web/src/features/operations/pages/OperationReportPage.tsx
- /customer/operations/:operationId/export -> apps/web/src/features/customer/pages/CustomerReportExportPage.tsx
- /customer/reports -> apps/web/src/features/customer/pages/CustomerReportsCenterPage.tsx
- /customer/export -> apps/web/src/features/customer/pages/CustomerDashboardExportPage.tsx

Route note: /customer/fields currently resolves to apps/web/src/views/CustomerFieldsIndexPage.tsx. PFE-3 keeps route topology unchanged.

PFE-3 uses Product Design System primitives from apps/web/src/design-system/product.
