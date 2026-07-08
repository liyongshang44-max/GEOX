// apps/web/src/features/admin/pages/AdminFieldsPage.tsx
import AdminLocalePage from "./AdminGovernanceLocalePage";
import { ADMIN_FIELDS_LOCALE_CONFIG } from "./adminFieldsLocaleConfig";

export default function AdminFieldsPage() {
  return <AdminLocalePage config={ADMIN_FIELDS_LOCALE_CONFIG} />;
}
