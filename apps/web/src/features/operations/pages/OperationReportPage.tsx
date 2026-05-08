import React from "react";
import { useParams } from "react-router-dom";
import CustomerWorkIndexPage from "../../../views/CustomerWorkIndexPage";
import BaseOperationReportPage from "../../../views/OperationReportPage";

export default function OperationReportPageRoute(): React.ReactElement {
  const { operationId = "" } = useParams();
  if (operationId === "index") return <CustomerWorkIndexPage />;
  return <BaseOperationReportPage />;
}
