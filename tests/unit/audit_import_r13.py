"""Imported inspection reuse must also fail at the shared persistence boundary."""

from case_store import validate_visit

case = {"case": {"date": "2026-09-01"}}
item = {"id": "a", "no": "1"}
source = {"id": "notice", "type": "notice", "items": [item], "inspDate": "2026-09-01"}
documents = {"notice": (source, "issued")}
visit = {
    "id": "new",
    "sourceDocId": "notice",
    "date": "2026-09-15",
    "time": "10:00",
    "importInspection": {"type": "reinspection", "date": "2026-09-15", "time": "10:00"},
    "results": {"a": {"oc": "none", "on": "2026-09-15"}},
}
validate_visit(case, visit, documents, set(), set(), [])
for prior in [
    {"id": "old", "date": "2026-09-15", "time": "10:00"},
    {"id": "old", "date": "2026-09-15"},
    {"id": "old", "date": "2026-09-16", "time": "11:00", "importInspection": dict(visit["importInspection"])},
]:
    try:
        validate_visit(case, visit, documents, set(), set(), [prior])
    except ValueError as exc:
        assert "already been used" in str(exc)
    else:
        raise AssertionError("Imported inspection was reused")
validate_visit(case, visit, documents, set(), set(), [{"id": "other", "date": "2026-09-15", "time": "09:00"}])
print(("PASS imported inspection reuse rejected, including corrected dates and legacy missing time; distinct known times allowed"))
