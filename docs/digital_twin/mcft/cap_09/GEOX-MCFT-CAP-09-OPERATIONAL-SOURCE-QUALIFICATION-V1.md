# GEOX MCFT-CAP-09 — Operational Weather Source Qualification V1

> **OFF-MAIN SOURCE QUALIFICATION ONLY — NOT RUNTIME AUTHORITY**
>
> This document defines a parallel evidence qualification lane. It does not change protected `main`, Amendment-19, the current Runtime execution graph, provider authority, Formal graduation authority, or any production wiring.

## 1. Working hypothesis

The source problem may be an interface-layer mismatch rather than a bad-observation problem:

> KBS LTER may be acting as delayed/local research evidence while GEOX historically treated that research-database outlet as if it were the operational telemetry outlet.

Candidate production sources must therefore be qualified independently from the current MCFT-9 Runtime proof.

The source qualification must not block or alter the current MCFT-9 sequence:

```text
GFS causal forcing
→ production persistent graph
→ accelerated 24T
→ restart/backfill/idempotency
→ Amendment-19 Formal graduation gate
→ final real wall-clock O00-O23 graduation
```

That execution proof is intentionally provider-agnostic and remains valuable even if all observation providers are later replaced.

## 2. Current repository boundary

Source-qualification base:

```text
protected main at qualification design start:
cf6bf3e69f2d7f40e7586308f4d846b3350efb1c
```

Rules:

- no source-qualification implementation may enter protected `main` while the current exact-head Amendment-19 qualification is pending;
- no new provider becomes Runtime authority from this document;
- no KBS authority is revoked by this document;
- no provider timestamp may be relabeled;
- no publication cadence may be inferred from event-time resolution alone;
- all `first_seen` observations must use an independent collector clock;
- revisions and disappearances must be retained, not overwritten in place;
- commercial-use permission is a separate gate from technical suitability.

## 3. Qualification object

This is one qualification program with three source surfaces:

```text
A. Enviroweather /stations/kbs
B. NOAA MRMS precipitation
C. KBS LTER delayed exact/local research evidence
```

The goal is not to force one source to replace every Evidence family.

Expected architecture, if supported by evidence, is potentially:

```text
near-real-time local station observations     → Enviroweather
near-real-time spatial precipitation forcing  → MRMS
forecast causal forcing                       → GFS / derived ET0
late exact/local research reconciliation       → KBS LTER
```

This is a hypothesis only until qualification closes.

---

# 4. A — Enviroweather Hickory Corners (`kbs`)

## 4.1 Already-established public facts

MSU Enviroweather exposes a station page identified by:

```text
station slug: kbs
station display identity: Hickory Corners
```

Enviroweather describes its mission as delivering a weather-based information system for pest, plant-production, and natural-resource management decisions in Michigan. The website exposes station latest-observation surfaces and a Data on Demand tool. A distinct production API host also exists, but API contract/access semantics have not yet been qualified.

These facts make Enviroweather materially different in product intent from a research archive, but they do not by themselves prove operational cadence, latency, completeness, revision behavior, or commercial-use permission.

## 4.2 Required observation ledger

For every poll, retain at minimum:

```text
collector_observed_at
source_surface
station_slug
station_display_name
station_identity_fields
source_event_time
first_seen_at
last_seen_at
value-family names only for metadata logs
record identity/hash
response/raw digest
http/cache metadata if present
```

Raw values may be retained privately for engineering adjudication; public CI/log artifacts should remain metadata-safe.

## 4.3 Required variables inventory

Determine exactly which Hickory Corners operational variables are exposed, including at minimum whether the surface provides:

```text
precipitation
air temperature
relative humidity
dew point
wind speed
wind direction
solar radiation
soil temperature
soil moisture
ET / PET or inputs sufficient to derive it
```

For each variable record:

```text
unit
sensor/derived status
sample interval
aggregation semantics
quality/status flags
missing sentinel
station/sensor identity
```

Do not infer a variable from a UI label alone if the underlying payload has different semantics.

## 4.4 Event-time qualification

Prove whether timestamps identify:

```text
instantaneous sample
interval start
interval end
aggregation center
publication time
```

The source must not enter Runtime authority until event-time meaning is unambiguous.

## 4.5 First-seen / latency qualification

Poll frequently enough to independently bracket each newly appearing source event.

For each event:

```text
latency_lower_bound = first_seen_at_previous_poll? / last-negative bracket
latency_upper_bound = first_seen_at - source_event_time
```

Retain both event time and actual observation time. Never reconstruct `first_seen` later from archive order.

## 4.6 Cadence qualification

The working candidate is a roughly 30-minute operational feed, but this must be measured rather than assumed.

Report:

```text
modal event-time interval
p50 / p95 interval
first-seen transition interval
burst publication frequency
number of consecutive transitions
longest gap
```

Classification should distinguish:

```text
true ~30-minute publication
30-minute observations released in larger batches
irregular event-time observations
revision-driven resurfacing
```

## 4.7 Missing-data qualification

Track independently:

```text
missing expected event timestamps
missing variables within an otherwise present event
quality-flagged values
station outage windows
HTTP/source outage windows
```

Do not collapse source outage and sensor missingness into one state.

## 4.8 Revision qualification

For every previously seen event, detect:

```text
same event time + same payload
same event time + changed payload
same event time removed
same event time reappeared
quality flag changed
station metadata changed
```

Retain all versions with their actual first-seen chronology.

## 4.9 Station identity qualification

Prove that `/stations/kbs` is the intended Hickory Corners physical/operational station and freeze any available:

```text
station id / slug
station name
latitude
longitude
elevation
network/operator
sensor-package metadata
active/inactive history
```

Do not equate the shared text `KBS` with KBS LTER variate endpoints unless physical station identity is proven.

## 4.10 Technical candidate-success condition

A source-adjudication report may classify Enviroweather as an `OPERATIONAL_SOURCE_CANDIDATE` only after a continuous observation window demonstrates all of the following:

```text
station identity stable
source event-time semantics known
publication behavior independently observed
missing/revision behavior measured
required variables explicitly inventoried
no evidence of daily-batch-only delivery
```

A 30-minute-class claim must be supported by repeated first-seen transitions, not by nominal sampling documentation alone.

Commercial-use permission remains a separate unresolved gate unless explicit terms or written permission are obtained.

---

# 5. B — NOAA MRMS precipitation

## 5.1 Already-established public facts

NOAA/NSSL describes MRMS as an operational system deployed at NCEP and used by the National Weather Service and other government/commercial users. The public operational product table currently identifies, among other products:

```text
PrecipRate                  frequency: 2 min
RadarOnly_QPE_01H           frequency: 2 min
RadarOnly_QPE_15M           frequency: 15 min
MultiSensor_QPE_01H_Pass1   frequency: 60 min; documented ~20 min latency
MultiSensor_QPE_01H_Pass2   frequency: 60 min; documented ~1 h latency
```

Missing and no-coverage sentinel values are separately represented in the operational GRIB2 table.

MRMS therefore has a materially stronger operational-distribution profile than KBS LTER for precipitation, but GEOX still must qualify the exact product, spatial mapping, latency, coverage, missingness, and revision semantics it intends to consume.

## 5.2 Product selection question

Do not select "MRMS" generically. Qualify at least these roles:

### Candidate near-boundary process forcing

```text
RadarOnly_QPE_15M
or
RadarOnly_QPE_01H
```

Advantages to test:

```text
low latency
high update cadence
no gauge-wait dependency
```

### Candidate higher-quality delayed precipitation evidence

```text
MultiSensor_QPE_01H_Pass1
```

Documented product latency is ~20 minutes and cadence 60 minutes.

Pass2 is later (~1 hour) and should be treated as a potentially revised/improved later product, not silently substituted for Pass1.

## 5.3 Spatial qualification

For the T3R1/Hickory Corners field geometry, prove:

```text
CONUS coverage
actual grid resolution
cell(s) intersecting field polygon
coordinate reference / longitude convention
no-coverage / radar-quality state
point-sample vs area-weighted aggregation rule
```

Do not treat a grid-cell value as exact station rainfall without explicitly freezing the spatial interpretation.

## 5.4 Latency / cadence ledger

For each chosen product, independently record:

```text
product valid/event time
file/product creation timestamp if available
first_seen_at by GEOX collector
update cadence
first-seen latency
revision/supersession relation
missing/no-coverage flags
```

## 5.5 Revision qualification

Determine whether the selected product for a given valid interval may change after first publication.

Where Pass1/Pass2 or other later corrections exist, preserve them as different product/version identities unless the NOAA contract explicitly defines replacement semantics.

## 5.6 MRMS technical candidate-success condition

A product may become an `OPERATIONAL_PRECIPITATION_SOURCE_CANDIDATE` only after proving:

```text
exact product id/version
spatial coverage at Hickory Corners
independent first-seen latency distribution
cadence
missing/no-coverage behavior
revision behavior
stable retrieval surface
```

No Runtime wiring is authorized by this qualification document.

---

# 6. C — KBS LTER

## 6.1 Retained role

KBS LTER remains valuable as:

```text
delayed exact/local research evidence
research reconciliation source
local reference / validation source
```

Its observed daily-batch behavior does not make the data scientifically invalid. It makes it unsuitable to act as a blocking hourly Runtime scheduler source.

## 6.2 Commercial-use permission is unresolved

KBS LTER publicly states that core-database data may not be published without written permission of the lead investigator or project director, and that KBS data/images used in publications require acknowledgement. The data catalog describes use primarily in research/educational terms and points users to the Terms of Use.

This is not enough to infer that embedding KBS LTER data in a commercial GEOX product is authorized.

Required action:

```text
obtain explicit written clarification from KBS LTER / MSU
```

Questions must distinguish:

```text
internal engineering evaluation
commercial decision-support use
redistribution of raw values
redistribution of derived values
customer-facing reports
publication / citation
retention / caching
API automation / polling
```

Until clarified:

```text
commercial_use_authorized = UNKNOWN
```

Do not encode a permissive assumption in production authority.

---

# 7. Source-role adjudication matrix

The qualification report should eventually emit a matrix like:

| Role | Enviroweather | MRMS | KBS LTER |
|---|---|---|---|
| local near-real-time station observation | QUALIFY | N/A | DELAYED / NOT SCHEDULER SOURCE |
| precipitation process forcing | QUALIFY if variable exists | PRIMARY CANDIDATE | DELAYED EXACT/RECONCILIATION |
| spatial precipitation | N/A / station point only | PRIMARY CANDIDATE | N/A |
| late exact/local evidence | POSSIBLE | POSSIBLE | RETAIN |
| station identity | REQUIRED | grid identity | REQUIRED |
| first_seen chronology | REQUIRED | REQUIRED | already required |
| revision handling | REQUIRED | REQUIRED | REQUIRED |
| commercial-use permission | REQUIRED | public-data/license review | WRITTEN CLARIFICATION REQUIRED |

No row becomes production authority merely because it is the preferred candidate.

---

# 8. Evidence artifact format

One source-qualification evidence bundle should contain:

```text
qualification_subject_sha
collector_version
source_surface
source_identity
station/product identity
poll_started_at
poll_ended_at
poll_count
http_success/failure counts
source event count
first-seen transition count
cadence statistics
latency statistics
missing-event count
missing-variable count
revision count
disappearance/reappearance count
station/product metadata changes
commercial_terms_status
raw private-retention digests
```

Public artifact/logs should be metadata-safe. Private retained responses may be used for deterministic replay.

---

# 9. Fail-closed rules

Reject qualification if any of the following is unresolved:

```text
ambiguous event-time meaning
station identity not proven
nominal cadence without observed first-seen cadence
archive ordering used as first_seen
unexplained record mutation
missing/no-coverage sentinel treated as zero precipitation
Pass1/Pass2 treated as same immutable record without product identity
commercial-use permission assumed from public accessibility
provider source wired into Runtime before separate authority review
```

---

# 10. Relationship to MCFT-9

This source qualification must remain parallel and non-blocking to the current Amendment-19 proof.

Current mainline still proves:

```text
causal forcing selection
same canonical core
production persistence
production scheduler
real lease/fencing
24 sequential ticks
restart
oldest-first backfill
idempotency
late exact no rewrite
zero provider wait in runtime
full chain readback
Formal graduation machine gate
```

Those properties must remain true regardless of whether future operational observations come from Enviroweather, MRMS, another provider, or a combination.

If Enviroweather proves a stable Hickory Corners operational feed and MRMS proves suitable operational precipitation, the later integration task should be a provider-adapter / evidence-authority change, not a scheduler redesign.

---

# 11. Current preliminary adjudication

```text
Enviroweather /stations/kbs:
PROMISING — station identity surface exists and product mission is operational decision support;
actual event cadence/latency/API contract/revision/commercial terms still unproven.

MRMS:
STRONG OPERATIONAL PRECIPITATION CANDIDATE — NOAA/NCEP operational product family;
exact product/spatial/latency/revision qualification still required.

KBS LTER:
RETAIN AS DELAYED LOCAL/RESEARCH EVIDENCE;
commercial-use permission requires explicit clarification.
```

The working root-cause hypothesis remains:

```text
we may have been reading production weather from the research-database outlet
instead of the operational station/product outlet
```

This document does not declare that hypothesis proven.
