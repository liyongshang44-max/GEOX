# PFE-14 Evidence + Runtime Health Productization Candidate v1

Status: IMPLEMENTED CANDIDATE / NOT EFFECTIVE  
Parent authority: State + Forecast Productization Qualification v1  
New backend/API data authority: NONE

## Purpose

Productize the current Evidence and Runtime Health surfaces without adding a field merely to make the UI look complete.

## Evidence

The `/operator/fields/:fieldId/evidence` product route continues to load the canonical `evidence-trace` bundle, but now presents Evidence Availability as the primary product surface by reusing the already-qualified `readMcftOperationalSummary()` GET method.

Visible server values are limited to:

- eligibility boundary;
- freshness verdict;
- latest observed / ingested;
- boundary-relative Evidence age;
- raw coverage ratio;
- maximum gap;
- future / late / out-of-order counts.

The browser does not calculate freshness, convert coverage into a new product percentage semantic, identify missing sources from Trace contents, or infer KBS publication cadence.

Trace/Timeline are summarized by returned-page counts and hashes. Raw node/event inspection remains on the Audit surface.

## Audit

`/audit` continues to use the existing Trace/Timeline audit presentation. Productizing Evidence does not collapse Evidence and Audit into one page.

## Runtime Health

The Health product surface combines two **separate server readbacks** without deriving a third verdict:

1. existing canonical `readMcftHealth()` values;
2. existing qualified Scheduler + Evidence operational summary.

It may show exact canonical Health presence/relationship plus server-returned scheduler status/lag and Evidence freshness/boundary.

It explicitly does not synthesize:

- runtime degradation status or reason codes;
- missed-slot count;
- backfill status;
- restart detected;
- recovery status.

Current lease/fencing state is not recovery history.

## Failure independence

If the operational-summary request fails, canonical Trace or Health remains visible. The UI reports that the operational projection is unavailable and does not substitute Replay/sample values.

## Nonchanges

- no new route;
- no API-client method change;
- no backend/database field;
- no browser Date/time arithmetic;
- no provider-cadence inference;
- no Class-B/Class-C implementation;
- no Shadow-online Runtime Context;
- no PFE-14 S4 effectiveness.
