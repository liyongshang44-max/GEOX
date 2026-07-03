# GEOX P51 Standards Alignment Audit

P51 uses external standards as mapping references, not as production protocol commitments.

## SensorThings API Sensing

P51 maps each resolved packet reading to a SensorThings-style Observation shape:

- `phenomenonTime`
- `resultTime`
- `result`
- `Datastream`
- `ObservedProperty`
- `FeatureOfInterest`
- `Thing`

The runner does not implement an OData service. It only generates a deterministic observation-shaped artifact for compatibility review.

## SOSA / SSN

P51 maps each observation into a SOSA-style semantic record:

- `sosa:Observation`
- `sosa:madeBySensor`
- `sosa:observedProperty`
- `sosa:hasFeatureOfInterest`
- `sosa:hasSimpleResult`
- `sosa:resultTime`

The semantic record is pointer-level evidence. It is not an ontology service.

## SenML

P51 accepts SenML-like packs with base name, base time, base unit, record name, value, optional time, and optional unit. The runner resolves base fields into absolute timestamps and canonical units before creating GEOX-compatible envelopes.

Unresolved relative time is rejected by negative fixtures.

## ISO 11783 / ISOBUS

ISOBUS is intentionally deferred. It is closer to implement/control interoperability and should be considered with later execution or field-pilot phases, not P51 evidence gateway proof.
