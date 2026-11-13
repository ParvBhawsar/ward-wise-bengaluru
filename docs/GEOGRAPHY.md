# Bengaluru boundary geography

The atlas uses the **2012 legacy BBMP ward geometry**, a common spatial reference for comparing historical records. Its 198 geographic features are municipal wards. The record years are independent of the boundary vintage. Different boundary vintages with conflicting ward names or IDs require a documented crosswalk before any aggregate comparison.

| Field | Value |
| --- | --- |
| Credit | Bangalore Municipal Data, DataMeet India community |
| Source file | [BBMP_oldWards.geojson, pinned revision](https://github.com/datameet/Municipal_Spatial_Data/blob/0c3a2e3dd2e87c514817378d6c73a9dd2ffb8f69/Bangalore/BBMP_oldWards.geojson) |
| Source documentation | [DataMeet Bangalore README](https://github.com/datameet/Municipal_Spatial_Data/blob/master/Bangalore/Readme.md) |
| Boundary and derivative licence | [Creative Commons Attribution-ShareAlike 2.5 India](https://creativecommons.org/licenses/by-sa/2.5/in/) |
| Source SHA-256 | 06263e1a1e72fc58844a635c0b95e490962321e8489b476f2379771ce5128633 |
| Geometry | 198 multipart features with unique numeric IDs 1 through 198, geographic longitude/latitude (WGS84) |
| Adaptation | Team Codyssey simplified common boundary chains, rounded coordinates, stripped unused attributes, checked label locations, and projected paths for SVG display. The derived boundary files carry the same CC BY-SA 2.5 India licence. |

## Files

- `dist/data/wards.json` (generated as `ward-paths.json`) is the offline rendering asset. `viewBox` gives the native SVG coordinates. Every member of `wards` has numeric `id`, source `name` and `constituency`, geographic `center` in longitude/latitude, SVG label position `x`, `y`, and SVG `path`. Preserve case, ward numbering, and polygon fill rule.
- `data/wards.geojson` is the equivalent geographic file, including the place names and source attribution. Store and redistribute the files under CC BY-SA 2.5 India.
- `prepare_geometry.py` rebuilds both from the pinned source with Python 3's standard library.

```sh
curl --fail --location 'https://raw.githubusercontent.com/datameet/Municipal_Spatial_Data/0c3a2e3dd2e87c514817378d6c73a9dd2ffb8f69/Bangalore/BBMP_oldWards.geojson' --output BBMP_oldWards.geojson
python3 scripts/prepare_geometry.py BBMP_oldWards.geojson /tmp/ward-map
cp /tmp/ward-map/ward-paths.json dist/data/wards.json
cp /tmp/ward-map/wards.geojson data/wards.geojson
```

All 198 simplified geometries pass GEOS validity checks. All 198 label anchors lie inside their respective ward and all original polygon components survive. The largest proportional area change after display simplification is 0.235% in geographic coordinate space. Use unsimplified official geometry for authoritative spatial analyses.

Suggested visible map credit: **Boundaries © DataMeet · 2012 · CC BY-SA 2.5 IN**. Link the credit to the source and its licence.

## Optional water landmarks

`dist/data/lakes.json` contains the projected outlines of 21 selected named lakes in the same SVG viewBox. These are orientation landmarks. They have no effect on the licence metric. If you include them in a map or screenshot, credit **Lakes © ATREE-CSEI, via OpenCity (CC BY)**. The file takes named outlines from the [ATREE-CSEI lake dataset](https://data.opencity.in/dataset/map-lakes-streams-bengaluru-urban-within-bbmp-area), using a [pinned copy of the original KMZ](https://github.com/SundareshPrasanna/neer-vazhvu/blob/9cc8ea77a9c203d93082999dd80bc21557af7d00/scripts/data-raw/bangalore/atree-csei-bengaluru-urban-rural-lakes.kmz). The polygons were simplified, selected and projected for display.
