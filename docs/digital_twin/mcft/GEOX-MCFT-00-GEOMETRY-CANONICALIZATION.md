<!-- docs/digital_twin/mcft/GEOX-MCFT-00-GEOMETRY-CANONICALIZATION.md -->
# GEOX MCFT-00 Geometry Canonicalization

## Contract

```text
canonicalization_id: GEOX_MCFT_GEOJSON_CANONICALIZATION_V1
geometry_type: Polygon
crs: EPSG:4326
semantic_hash_algorithm: SHA-256
area_algorithm: GEOX_WGS84_AUTHALIC_SPHERE_POLYGON_AREA_V1
area_algorithm_version: 1
authalic_radius_m: 6371007.1809
```

## Validation

A geometry is valid only when:

- the GeoJSON Feature has a non-empty `Polygon` geometry;
- every ring contains at least four coordinate positions;
- every ring is closed;
- longitude is within [-180, 180] and latitude within [-90, 90];
- every coordinate is finite;
- an outer ring has non-zero signed area;
- interior rings, when present, are non-zero and valid.

## Canonicalization

1. Read only the `geometry` object. Feature properties are excluded.
2. Keep only `type` and `coordinates`.
3. Round longitude and latitude to seven decimal degrees using decimal half-away-from-zero.
4. Normalize `-0` to `0`.
5. Remove repeated terminal points until the ring has one logical closure point.
6. Append exactly one terminal point equal to the first point.
7. Remove consecutive duplicate non-terminal points.
8. Orient the outer ring counter-clockwise in longitude/latitude plane.
9. Orient interior rings clockwise.
10. Rotate each ring so the lexicographically smallest coordinate is first while preserving orientation.
11. Sort interior rings by their canonical JSON.
12. Serialize JSON with recursively sorted object keys, array order preserved, UTF-8, no insignificant whitespace, and finite decimal numbers only.

Formatting, indentation, property order, and non-semantic Feature properties do not change `geometry_semantic_hash`.

## Frozen hashes

```text
file_sha256: sha256:249fee97640a8291d18becb399b7ed7757de90222ad55ed1a203ebe277147ab4
geometry_semantic_hash: sha256:d3dbc5495485e7af68acdc4b32e6061c2ea99772835be2805ae706b74d75ca51
```

`file_sha256` covers exact checked-in bytes. `geometry_semantic_hash` covers canonical geometry semantics only.

## Area derivation

For each canonical ring edge:

```text
delta_lon = normalized_radians(lon2 - lon1)
term = delta_lon * (2 + sin(lat1) + sin(lat2))
```

The absolute spherical ring area is:

```text
abs(sum(term)) * R^2 / 2
```

Interior-ring areas are subtracted from the outer-ring area. Result is rounded to six decimal places.

Frozen result:

```text
derived_area_m2: 20488.479982
```

The legacy C8 value `20000 m2` is comparison-only and differs by `488.479982 m2`. It is not authoritative.
