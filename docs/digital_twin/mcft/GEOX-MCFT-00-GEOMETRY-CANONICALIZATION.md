<!-- docs/digital_twin/mcft/GEOX-MCFT-00-GEOMETRY-CANONICALIZATION.md -->
# GEOX MCFT Geometry Canonicalization V1

## 0. Policy

```text
policy_id: GEOX_MCFT_GEOJSON_CANONICALIZATION_V1
version: 1.0.0
geometry_type: Polygon
crs: EPSG:4326
truth_status: CONTROLLED_SYNTHETIC
```

The semantic hash is calculated from normalized geometry, never from file bytes. File integrity and semantic identity use separate hashes.

## 1. Validation

A valid geometry must:

1. be a GeoJSON `Polygon`;
2. contain at least one non-empty ring;
3. contain at least four positions including the terminal closure position;
4. contain finite numeric longitude/latitude pairs;
5. keep longitude in `[-180, 180]` and latitude in `[-90, 90]`;
6. close each ring with an exact first/last coordinate match after precision normalization.

## 2. Canonicalization

```text
coordinate precision: 7 decimal places
negative zero: normalized to numeric 0
consecutive duplicate positions: removed
ring closure: exactly one terminal copy of the first position
exterior orientation: counter-clockwise
interior orientation: clockwise
ring order: exterior first; interior rings sorted by compact canonical JSON
properties: excluded
bbox/foreign members: excluded
JSON object key order: coordinates, type
array order: preserved after ring normalization
numeric serialization: ECMAScript JSON numeric serialization after rounding
text encoding: UTF-8
semantic payload: geometry only
```

Canonical semantic string for the frozen fixture:

```json
{"coordinates":[[[116.3982,39.9084],[116.4008,39.9084],[116.4008,39.9106],[116.3982,39.9106],[116.3982,39.9084]]],"type":"Polygon"}
```

```text
geometry_semantic_hash: sha256:df3da5368a539b61d257603b4e5758589cb1f4cbf2863d3f5e03640c3b0bb30d
```

The checked-in pretty-printed file has:

```text
file_sha256: sha256:b0b9039b0a70361f0725e3f342ebd622d34ddb57e5809646a54bdbb420a47c1e
```

Whitespace, indentation, line endings, and object-key formatting may change `file_sha256` but must not change `geometry_semantic_hash`.

## 3. Area algorithm

```text
algorithm_id: GEOX_LOCAL_EQUIRECTANGULAR_SHOELACE_AREA_V1
algorithm_version: 1.0.0
earth_radius_m: 6378137.0
reference_latitude: arithmetic mean of exterior-ring unique-vertex latitudes
x: R * longitude_radians * cos(reference_latitude_radians)
y: R * latitude_radians
area: absolute shoelace area in projected metres
rounding: 0.001 m²
holes: exterior area minus sum(interior areas)
```

Frozen result:

```text
derived_area_m2: 54370.977
```

This algorithm is deterministic and appropriate for the small controlled synthetic fixture. It is not a surveyed geodetic boundary claim.

## 4. Versioning

Any semantic coordinate change requires:

```text
new binding_version
new geometry_semantic_hash
supersedes_binding_ref
change_reason
new derived_area_m2
```

File-only formatting changes may update file integrity metadata but do not create a semantic geometry version.
