import React from "react";
import { useParams } from "react-router-dom";
import CustomerFieldsIndexPage from "../../../views/CustomerFieldsIndexPage";
import FieldReportPage from "../../../views/FieldReportPage";

export default function FieldReportPageRoute(): React.ReactElement {
  const { fieldId = "" } = useParams();
  if (fieldId === "index") return <CustomerFieldsIndexPage />;
  return <FieldReportPage />;
}
