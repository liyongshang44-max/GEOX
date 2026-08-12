# PFE-14 State + Forecast Productization Candidate v1

Status: IMPLEMENTED CANDIDATE / NOT EFFECTIVE  
Parent: `PFE-14-S4-PRODUCT-COMPLETENESS-ADJUDICATION-V1`  
Data authority delta: ZERO  
Route/API/backend/database delta: ZERO

## Purpose

Replace the engineering-first generic State/Forecast rendering with product-readable panels while consuming exactly the same canonical GET responses.

This candidate does not add data to make the UI look complete. It separates:

- current canonical values that the repository really returns;
- fields the product taskbook wants but the current read contract does not expose;
- technical identity that remains useful for audit but should not dominate the primary product surface.

## State

Visible product facts are limited to the current State collection contract:

- bounded page item count;
- object type;
- logical time;
- attachment status;
- exact object ref/hash under progressive disclosure;
- collection response metadata under progressive disclosure.

The current canonical collection does **not** expose a State value, unit, confidence class or normalized product status. These fields are displayed as unavailable contract fields, not populated from fixtures, object IDs, hidden payloads or browser inference.

Fixed boundary: `State ≠ Sensor Reading`.

## Forecast

The product surface consumes only current Runtime-root values already present in `McftRuntimeReadModelV1`:

- `current_tick_forecast_result` canonical ref;
- `latest_successful_forecast.attachment_status/reason_code`;
- `scenario_source_forecast.attachment_status/reason_code`;
- bounded Forecast collection identity/time/attachment fields.

The current product read contract does not expose a normalized forecast status, forecast horizon or authoritative `scenario_source_eligible` field. The UI states that these are not established instead of deriving them from object presence or parsing hidden payloads.

Fixed boundaries:

- Forecast is not Fact.
- Forecast is not Recommendation.
- Forecast is not Action.

## Technical detail

Object refs, hashes, source fact refs, fixed-root identity and collection hashes move behind `<details>` progressive disclosure. They remain exact API-returned values and are not discarded.

## Nonchanges

- no new route;
- no API client change;
- no new request;
- no backend field;
- no payload parsing;
- no browser clock/time arithmetic;
- no State/Forecast numeric invention;
- no Shadow-online Runtime Context claim;
- no recommendation, approval, dispatch or model activation;
- no PFE-14 S4 effectiveness claim.

## Next step

After exact-head focused + CAP07 lifecycle + standard CI proof, a separate qualification step may decide whether this productization becomes the accepted PFE-14 State/Forecast read surface. It must not authorize Class-B or Class-C fields implicitly.
