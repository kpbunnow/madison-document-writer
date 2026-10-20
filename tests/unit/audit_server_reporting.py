#!/usr/bin/env python3
"""Reporting endpoints in server.py, driven over real HTTP on a spare port.
The city's parcel layer is replaced by a recorded answer; nothing here
touches the network."""

import hashlib, json, os, sys, tempfile, threading, time, urllib.request, urllib.error
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(HERE))
os.environ["DW_PORT"] = "8791"
import server  # noqa: E402

fails = []


def ok(label, cond, extra=""):
    print("  %s %s%s" % ("ok  " if cond else "FAIL", label, ("   " + str(extra)) if extra != "" else ""))
    if not cond:
        fails.append(label)


def H(t):
    print("\n=== %s ===" % t)


root = Path(tempfile.mkdtemp())
server.share_root = lambda: root
cases = root / "Case JSON Files"
idx = cases / "Reporting Index"
idx.mkdir(parents=True)


def summary(no):
    return {"format": "madison-case-summary", "summaryVersion": 1, "case": {"number": no}}


# R40: exact case revisions determine freshness, regardless of timestamps.
def case_record(number):
    return json.dumps(
        {"format": "madison-case-file", "schema": 3, "case": {"id": "case_" + number, "number": number}, "inspectors": [], "events": []}
    )


for no, name in [("CB1", "1 A ST - CB1.json"), ("CB2", "2 B ST - CB2.json")]:
    raw = case_record(no)
    (cases / name).write_text(raw)
    value = summary(no)
    value["sourceRevision"] = hashlib.sha256(raw.encode()).hexdigest() if no == "CB1" else "0" * 64
    (idx / (no + ".json")).write_text(json.dumps(value))
# An older timestamp cannot conceal a correct revision, nor a newer one a stale projection.
old = time.time() - 60
os.utime(idx / "CB1.json", (old, old))
(cases / "3 C ST - CB3.json").write_text(case_record("CB3"))
(cases / "_write-test.json").write_text("{}")
# unreadable and foreign summaries
(idx / "bad.json").write_text("{nope")
(idx / "other.json").write_text(json.dumps({"format": "x"}))

# the city parcel layer, recorded
CITY = {
    "070822219103": {
        "type": "Feature",
        "properties": {"Parcel": "070822219103", "Address": "1910 Lewon Dr", "AlderDistrict": 9, "BuildingDistrict": 3},
        "geometry": {"type": "Polygon", "coordinates": [[[-89.5, 43.0], [-89.4, 43.0], [-89.4, 43.1], [-89.5, 43.1], [-89.5, 43.0]]]},
    },
    "071036411518": {
        "type": "Feature",
        "properties": {"Parcel": "071036411518", "Address": "x", "AlderDistrict": 6, "BuildingDistrict": 2},
        "geometry": {
            "type": "MultiPolygon",
            "coordinates": [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]], [[[10, 10], [14, 10], [14, 14], [10, 14], [10, 10]]]],
        },
    },
}
CALLS = []
NETDOWN = [False]


def fake_fetch(url, timeout=25):
    CALLS.append(url)
    if NETDOWN[0]:
        raise urllib.error.URLError("no route to host")
    if "OPEN_DATA2" in url:
        from urllib.parse import urlparse, parse_qs

        q = parse_qs(urlparse(url).query)
        assert q["outSR"] == ["4326"] and q["f"] == ["geojson"], q
        ids = [x.strip("'") for x in q["where"][0].split("(")[1].rstrip(")").split(",")]
        return {"type": "FeatureCollection", "features": [CITY[i] for i in ids if i in CITY]}
    if "opendata" in url:
        return {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"ALD_DIST": 6}, "geometry": None}]}
    raise AssertionError(url)


server.fetch_json = fake_fetch

httpd = server.Server(("127.0.0.1", 8791), server.Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:8791"


def call(path, body=None, headers=None, method=None):
    h = {"Content-Type": "application/json"} if body is not None else {}
    h.update({"X-DocWriter-Token": server.SESSION_TOKEN})
    h.update(headers or {})
    rq = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(rq, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


H("Index")
st, j = call("/reporting/index")
ok("answers", st == 200 and j["ok"], j)
ok("only exact current summaries enter totals", [s["case"]["number"] for s in j["summaries"]] == ["CB1"])
ok("missing summary named", j["missing"] == ["3 C ST - CB3.json"], j["missing"])
ok("stale summary named", j["stale"] == ["2 B ST - CB2.json"], j["stale"])
ok("fresh one is not stale", "1 A ST - CB1.json" not in j["stale"])
ok("unreadable and foreign named", sorted(x.split(" ")[0] for x in j["unreadable"]) == ["bad.json", "other.json"], j["unreadable"])
ok("test file ignored", not any("_write-test" in x for x in j["missing"] + j["stale"]))
server.share_root = lambda: root / "gone"
st, j = call("/reporting/index")
ok("an unreachable share says so", st == 200 and not j["ok"] and "cannot be reached" in j["error"], j)
server.share_root = lambda: root

H("Parcels")
ok("norm_parcel", server.norm_parcel("0708-222-1910-3") == "070822219103" and server.norm_parcel("0708-222") == "" and server.norm_parcel(None) == "")
c = server.centroid(CITY["070822219103"]["geometry"])
ok("centroid of a square", abs(c["lon"] + 89.45) < 1e-9 and abs(c["lat"] - 43.05) < 1e-9, c)
c = server.centroid(CITY["071036411518"]["geometry"])
ok("multipart: centroid of the largest part", c == {"lon": 12.0, "lat": 12.0}, c)
ok("no geometry", server.centroid(None) is None)
st, j = call("/reporting/parcels", {"ids": ["0708-222-1910-3", "071036411518", "999999999999", "12-3"]})
ok("lookup answers", st == 200 and j["ok"], j)
ok(
    "found ones cached with district and point",
    j["parcels"]["070822219103"]["history"][0]["alder"] == 9 and j["parcels"]["071036411518"]["history"][0]["lat"] == 12.0,
)
ok("absent parcel reported missing", j["missing"] == ["999999999999"])
ok("malformed id reported invalid", j["invalid"] == ["12-3"])
ok("one query for the batch", len([u for u in CALLS if "OPEN_DATA2" in u]) == 1)
n = len(CALLS)
st, j = call("/reporting/parcels", {"ids": ["070822219103", "999999999999"]})
ok("cached and known-missing parcels are not queried again", len(CALLS) == n and j["missing"] == ["999999999999"])
cache = json.loads((root / "Reporting GIS" / "parcels.json").read_text())
ok("cache written to the share", cache["format"] == "madison-parcel-cache" and "070822219103" in cache["parcels"])
st, j = call("/reporting/parcels", {"ids": ["070822219103"], "refresh": True})
h = j["parcels"]["070822219103"]["history"]
ok("refresh with no change adds no history", len(h) == 1)
CITY["070822219103"]["properties"]["AlderDistrict"] = 10
st, j = call("/reporting/parcels", {"ids": ["070822219103"], "refresh": True})
h = j["parcels"]["070822219103"]["history"]
ok("redistricting appends; the first entry is kept", len(h) == 2 and h[0]["alder"] == 9 and h[1]["alder"] == 10, h)
NETDOWN[0] = True
st, j = call("/reporting/parcels", {"ids": ["071036411518", "070913305114"]})
ok("network down: says so and still returns the cache", not j["ok"] and "could not be reached" in j["error"] and "071036411518" in j["parcels"], j)
ok("network down: nothing cached as missing", "070913305114" not in json.loads((root / "Reporting GIS" / "parcels.json").read_text())["missing"])
NETDOWN[0] = False
st, j = call("/reporting/parcels")
ok("GET returns the cache", st == 200 and "070822219103" in j["parcels"] and j["missing"] == ["999999999999"])

H("Areas")
st, j = call("/reporting/areas")
ok("district outlines downloaded and kept", j["districts"] and (root / "Reporting GIS" / "alder-districts.geojson").exists())
n = len(CALLS)
call("/reporting/areas")
ok("not downloaded twice", len(CALLS) == n)
ok("no ZIP outlines is not an error", j["zips"] is None)
(root / "Reporting GIS" / "zip-codes.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": []}))
st, j = call("/reporting/areas")
ok("a dropped ZIP file is used", j["zips"] == {"type": "FeatureCollection", "features": []} and j["zipsDate"])
(root / "Reporting GIS" / "alder-districts.geojson").unlink()
NETDOWN[0] = True
st, j = call("/reporting/areas")
ok("district download failing explains itself", j["districts"] is None and any("alder-districts.geojson" in x for x in j["notes"]), j["notes"])
NETDOWN[0] = False
(root / "Reporting GIS" / "settings.json").write_text(json.dumps({"districtsUrl": "https://opendata.example/x.geojson"}))
CALLS.clear()
call("/reporting/areas")
ok("settings.json overrides the district source", CALLS == ["https://opendata.example/x.geojson"], CALLS)

H("Guards")
st, j = call("/reporting/index", headers={"Sec-Fetch-Site": "cross-site"})
ok("a cross-site read is refused", st == 403)
st, j = call("/reporting/parcels", {"ids": []}, headers={"Origin": "https://evil.example"})
ok("a cross-origin lookup is refused", st == 403)
rq = urllib.request.Request(
    BASE + "/reporting/parcels", data=b'{"ids":["070822219103"]}', headers={"Content-Type": "text/plain", "X-DocWriter-Token": server.SESSION_TOKEN}
)
try:
    urllib.request.urlopen(rq, timeout=5)
    code = 200
except urllib.error.HTTPError as e:
    code = e.code
ok("a lookup that is not JSON is refused", code == 403)
st, j = call("/reporting/parcels", {"ids": "070822219103"})
ok("ids must be a list", st == 400)
st, j = call("/reporting/nothing")
ok("unknown reporting path", st == 404)
st, j = call("/dw-status")
ok("the existing status endpoint still answers", st == 200 and j["ok"])

httpd.shutdown()
print("\n" + ("%d FAILURE(S): %s" % (len(fails), " | ".join(fails)) if fails else "all checks passed"))
sys.exit(1 if fails else 0)
