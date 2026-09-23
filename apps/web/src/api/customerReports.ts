/**
 * GEOX_PRODUCT_CONTRACT_LIFECYCLE: LEGACY_REPORT_REEXPORT
 * Historical Customer re-export of the legacy report adapter. Do not use as a starting point for new post-FOUI product consumers.
 */
export {
  fetchCustomerDashboardAggregate,
  fetchFieldReport,
  fetchOperationReport,
} from "./reports";

export type {
  CustomerDashboardAggregateV1,
  FieldReportDetailV1,
  OperationReportV1,
} from "./reports";
