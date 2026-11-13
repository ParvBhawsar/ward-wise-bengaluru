"""Build the packaged historical BBMP display map from DataMeet's pinned GeoJSON.

Python 3 standard library only. Input must match the published boundary file.
Usage: python prepare_geometry.py SOURCE.geojson OUTPUT_DIRECTORY
"""
import argparse
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

SHA256 = "06263e1a1e72fc58844a635c0b95e490962321e8489b476f2379771ce5128633"
ORIGIN = "https://github.com/datameet/Municipal_Spatial_Data/blob/0c3a2e3dd2e87c514817378d6c73a9dd2ffb8f69/Bangalore/BBMP_oldWards.geojson"
LICENSE = "https://creativecommons.org/licenses/by-sa/2.5/in/"
VINTAGE = "DataMeet legacy BBMP ward map (2012), 198 wards"
TOLERANCE = 0.000035


def write_json(path, payload):
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")


def squared_distance(point, start, end):
    dx, dy = end[0] - start[0], end[1] - start[1]
    if dx == dy == 0:
        return (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2
    t = max(0.0, min(1.0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)))
    return (point[0] - start[0] - t * dx) ** 2 + (point[1] - start[1] - t * dy) ** 2


def simplify_chain(points):
    """Canonical direction makes both copies of each shared edge simplify identically."""
    if len(points) <= 2:
        return points
    if points[-1] < points[0]:
        return simplify_chain(points[::-1])[::-1]
    maximum, split = max((squared_distance(p, points[0], points[-1]), i) for i, p in enumerate(points[1:-1], 1))
    if maximum <= TOLERANCE ** 2:
        return [points[0], points[-1]]
    return simplify_chain(points[:split + 1])[:-1] + simplify_chain(points[split:])


def simplify_ring(points, junctions):
    vertices = points[:-1]
    anchors = [i for i, v in enumerate(vertices) if v in junctions]
    # Split closed or single-anchor loops into two open chains.
    if len(anchors) < 2:
        first = anchors[0] if anchors else min(range(len(vertices)), key=lambda i: vertices[i])
        farthest = max(range(len(vertices)), key=lambda i: math.dist(vertices[first], vertices[i]))
        anchors = sorted({first, farthest})
    output = []
    for position, start in enumerate(anchors):
        end = anchors[(position + 1) % len(anchors)]
        section = vertices[start:end + 1] if start < end else vertices[start:] + vertices[:end + 1]
        output.extend(simplify_chain(section)[:-1])
    if len(set(output)) < 3:
        return points
    return output + [output[0]]


def point_in_ring(point, ring):
    x, y = point
    crossings = False
    for (xa, ya), (xb, yb) in zip(ring, ring[1:]):
        if (ya > y) != (yb > y) and x < xa + (y - ya) * (xb - xa) / (yb - ya):
            crossings = not crossings
    return crossings


def label_point(geometry, source_point):
    if any(point_in_ring(source_point, p[0]) and not any(point_in_ring(source_point, h) for h in p[1:]) for p in geometry):
        return source_point
    # Horizontal chords provide an actual interior point for the few inaccurate source centroids.
    ring = max((p[0] for p in geometry), key=lambda r: abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(r, r[1:]))))
    low, high = min(v[1] for v in ring), max(v[1] for v in ring)
    best = (-1, None)
    for k in range(1, 12):
        y = low + (high-low) * k / 12
        intersections = sorted(a[0] + (y-a[1]) * (b[0]-a[0]) / (b[1]-a[1]) for a,b in zip(ring,ring[1:]) if (a[1] > y) != (b[1] > y))
        for a,b in zip(intersections[::2], intersections[1::2]):
            if b-a > best[0]:
                best = (b-a, ((a+b)/2, y))
    if best[1] is None:
        raise ValueError("Could not construct an interior label point")
    return best[1]


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args=parser.parse_args()
    raw=args.source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise ValueError("Unexpected source SHA-256; review the geography before building")
    features=json.loads(raw)["features"]
    features.sort(key=lambda f: int(f["properties"]["WARD_NO"]))
    if [int(f["properties"]["WARD_NO"]) for f in features] != list(range(1,199)):
        raise ValueError("Expected exactly wards 1–198")
    neighbors=defaultdict(set)
    for feature in features:
        geom=feature["geometry"]
        if geom["type"] != "MultiPolygon":
            raise ValueError("Expected geographic MultiPolygon")
        geom["coordinates"]=[[[tuple(point) for point in ring] for ring in polygon] for polygon in geom["coordinates"]]
        for polygon in geom["coordinates"]:
            for ring in polygon:
                for a,b in zip(ring,ring[1:]):
                    if a != b:
                        neighbors[a].add(b)
                        neighbors[b].add(a)
    junctions={point for point, adj in neighbors.items() if len(adj) != 2}
    xmin=min(p[0] for p in neighbors); xmax=max(p[0] for p in neighbors)
    ymin=min(p[1] for p in neighbors); ymax=max(p[1] for p in neighbors)
    factor=math.cos(math.radians((ymin+ymax)/2))
    scale=1000/(ymax-ymin); width=(xmax-xmin)*factor*scale
    def project(point):
        return [round((point[0]-xmin)*factor*scale, 2),round((ymax-point[1])*scale, 2)]
    metadata={"source":ORIGIN,"attribution":"DataMeet India community, adapted by Team Codyssey","boundaryVintage":VINTAGE,"license":"CC BY-SA 2.5 India","licenseUrl":LICENSE}
    geo_features=[]
    svg_wards=[]
    for feature in features:
        original=feature["properties"]; ward=int(original["WARD_NO"]); name=original["WARD_NAME"].strip()
        polygons=[[[[round(x,7), round(y,7)] for x,y in simplify_ring(ring,junctions)] for ring in poly] for poly in feature["geometry"]["coordinates"]]
        center=[round(x,5) for x in label_point(polygons,(original["LON"],original["LAT"]))]
        props={"id":ward,"name":name,"constituency":original["ASS_CONST1"].strip(),"center":center}
        geo_features.append({"type":"Feature","id":ward,"properties":props,"geometry":{"type":"MultiPolygon","coordinates":polygons}})
        paths=[]
        for polygon in polygons:
            for ring in polygon:
                pairs=[",".join(f"{v:g}" for v in project(coord)) for coord in ring[:-1]]
                paths.append("M"+"L".join(pairs)+"Z")
        svg_wards.append({**props,"x":project(center)[0],"y":project(center)[1],"path":"".join(paths)})
    args.output.mkdir(exist_ok=True, parents=True)
    write_json(args.output/"wards.geojson",{"type":"FeatureCollection",**metadata,"bbox":[xmin,ymin,xmax,ymax],"features":geo_features})
    write_json(args.output/"ward-paths.json",{**metadata,"viewBox":f"0 0 {width:.2f} 1000","width":round(width,2),"height":1000,"wards":svg_wards})


if __name__=="__main__":
    main()
