"""Live import through the division's SSRS reports: the fixed render URLs, the Windows PowerShell fetch (scripted, never
a live sign-in), every failure message, and the XML checks, against synthetic exports shaped like the real ones.
The City report server is NOT contacted by this audit."""

import base64
import json
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from urllib.parse import parse_qsl, urlsplit
import xml.etree.ElementTree as ET

import case_lookup
import ssrs_reports as ssrs
import trusted_connections

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tests/fixtures/ssrs"
CASE_XML = (FIXTURES / "case-report.xml").read_bytes()
OPEN_XML = (FIXTURES / "open-cases-report.xml").read_bytes()


def ok(body):
    return SimpleNamespace(returncode=0, stdout=json.dumps({"ok": True, "status": 200, "body": base64.b64encode(body).decode()}))


def failed(**answer):
    return SimpleNamespace(returncode=1, stdout=json.dumps({"ok": False, **answer}))


class Windows:
    """A substitute Windows: the PowerShell path exists and subprocess.run is scripted."""

    def __enter__(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        exe = root / "System32/WindowsPowerShell/v1.0/powershell.exe"
        exe.parent.mkdir(parents=True)
        exe.touch()
        self.patches = [
            patch.object(ssrs, "os", SimpleNamespace(name="nt", environ={"SystemRoot": str(root)})),
            patch.object(subprocess, "CREATE_NO_WINDOW", 0, create=True),
            patch.object(subprocess, "run"),
        ]
        mocks = [p.start() for p in self.patches]
        return mocks[-1]

    def __exit__(self, *exc):
        for p in reversed(self.patches):
            p.stop()
        self.temp.cleanup()


class Urls(unittest.TestCase):
    def test_render_urls_use_the_web_service_xml_format_and_encode_parameters(self):
        url = ssrs.report_url(ssrs.CASE_REPORT, [("CaseNumber", "CB2026-313-04591")])
        self.assertEqual(
            url,
            "https://entreports.cityofmadison.com/ReportServer?/Prod/Local/Building%20Inspection/Enforcement/DocumenGeneratorImport"
            "&rs:Command=Render&rs:Format=XML&CaseNumber=CB2026-313-04591",
        )
        hostile = ssrs.report_url(ssrs.OPEN_CASES_REPORT, [("Inspector", "A&B=C D'E#F?")])
        parts = urlsplit(hostile)
        self.assertEqual(parts.hostname, "entreports.cityofmadison.com")
        self.assertEqual(parse_qsl(parts.query.split("&", 1)[1])[-1], ("Inspector", "A&B=C D'E#F?"))
        self.assertEqual(ssrs.report_url(ssrs.OPEN_CASES_REPORT).count("Inspector"), 0)

    def test_the_server_comes_only_from_the_verified_release_allowlist(self):
        self.assertEqual(trusted_connections.policy()["ssrsHosts"], ["entreports.cityofmadison.com"])
        self.assertNotIn("sqlServers", trusted_connections.policy())
        with self.assertRaisesRegex(ValueError, "SSRS allowlist"):
            trusted_connections.approved_ssrs("attacker.example")
        with patch.object(ssrs, "HOST", "attacker.example"), self.assertRaises(ValueError):
            ssrs.report_url(ssrs.CASE_REPORT)

    def test_report_definitions_name_the_parameters_the_program_sends(self):
        for rdl, parameter in (("Document-Generator-Import.rdl", "CaseNumber"), ("OpenEnforcementCases_BI.rdl", "Inspector")):
            root = ET.parse(ROOT / "tests/fixtures/reference" / rdl).getroot()
            names = [e.get("Name") for e in root.iter() if e.tag.endswith("}ReportParameter")]
            self.assertEqual(names, [parameter], rdl)


class Fetch(unittest.TestCase):
    def test_powershell_runs_the_fixed_script_with_only_the_url_timeout_and_limit(self):
        with Windows() as run:
            run.return_value = ok(CASE_XML)
            self.assertEqual(ssrs.fetch("https://entreports.cityofmadison.com/ReportServer?/x", 40), CASE_XML)
            args, kwargs = run.call_args
            self.assertEqual(args[0][-2:], ["-File", str(ssrs.HERE / "ssrs_fetch.ps1")])
            self.assertNotIn("-ExecutionPolicy", args[0])
            self.assertNotIn("-Command", args[0])
            self.assertNotIn("shell", kwargs)
            self.assertEqual(
                json.loads(kwargs["input"]),
                {"url": "https://entreports.cityofmadison.com/ReportServer?/x", "timeoutSeconds": 40, "maxBytes": ssrs.MAX_BYTES},
            )
            self.assertEqual(kwargs["timeout"], 55)
            self.assertEqual(kwargs["creationflags"], 0)

    def test_each_failure_says_what_to_do_and_never_shows_server_text(self):
        cases = [
            (failed(category="http", httpStatus=401, message="SECRET"), "SSRS_401"),
            (failed(category="http", httpStatus=403), "SSRS_403"),
            (failed(category="http", httpStatus=404), "SSRS_404"),
            (failed(category="http", httpStatus=500, ssrsCode="rsInvalidReportParameter"), "SSRS_500_rsInvalidReportParameter"),
            (failed(category="http", httpStatus=500, ssrsCode="bad code <x>"), r"SSRS_500\)"),
            (failed(category="timeout"), "did not answer in time"),
            (failed(category="network"), "SSRS_NETWORK"),
            (failed(category="tls"), "SSRS_TLS"),
            (failed(category="redirect"), "SSRS_REDIRECT"),
            (failed(category="limit"), "SSRS_LIMIT"),
            (failed(category="script_policy"), "SCRIPT_POLICY"),
            (failed(category="other", diagnosticFile="C:\\Users\\x\\AppData\\Local\\MadisonDocWriter\\case-lookup-diagnostic.txt"), "SSRS_FAILED"),
            (SimpleNamespace(returncode=1, stdout="Execution policy blocked this script"), "script policy"),
            (SimpleNamespace(returncode=0, stdout="[]"), "invalid response"),
            (SimpleNamespace(returncode=0, stdout=json.dumps({"ok": True, "body": "not base64!"})), "invalid response"),
            (SimpleNamespace(returncode=0, stdout=json.dumps({"ok": "yes", "body": ""})), "SSRS_FAILED"),
        ]
        with Windows() as run:
            for result, fragment in cases:
                run.return_value = result
                with self.subTest(fragment=fragment), self.assertRaisesRegex(ssrs.ReportError, fragment) as error:
                    ssrs.fetch("https://entreports.cityofmadison.com/x", 40)
                self.assertNotIn("SECRET", str(error.exception))
                self.assertNotIn("C:\\Users", str(error.exception))
            run.return_value = failed(category="other", diagnosticFile="C:\\Users\\x\\case-lookup-diagnostic.txt")
            with self.assertRaisesRegex(ssrs.ReportError, r"%LOCALAPPDATA%\\MadisonDocWriter\\case-lookup-diagnostic.txt"):
                ssrs.fetch("https://entreports.cityofmadison.com/x", 40)
            run.side_effect = subprocess.TimeoutExpired("powershell", 55)
            with self.assertRaisesRegex(ssrs.ReportError, "did not answer in time"):
                ssrs.fetch("https://entreports.cityofmadison.com/x", 40)
            run.side_effect = FileNotFoundError()
            with self.assertRaisesRegex(ssrs.ReportError, "could not start"):
                ssrs.fetch("https://entreports.cityofmadison.com/x", 40)

    def test_not_windows_or_missing_powershell_is_refused_before_any_request(self):
        with patch.object(ssrs, "os", SimpleNamespace(name="posix", environ={})), patch.object(subprocess, "run") as run:
            with self.assertRaisesRegex(ssrs.ReportError, "City Windows computer"):
                ssrs.fetch("https://entreports.cityofmadison.com/x", 40)
            self.assertFalse(run.called)
        with tempfile.TemporaryDirectory() as folder, patch.object(ssrs, "os", SimpleNamespace(name="nt", environ={"SystemRoot": folder})):
            with self.assertRaisesRegex(ssrs.ReportError, "PowerShell is unavailable"):
                ssrs.fetch("https://entreports.cityofmadison.com/x", 40)

    def test_the_script_signs_in_as_the_user_refuses_redirects_and_keeps_server_text_local(self):
        ps = (ssrs.HERE / "ssrs_fetch.ps1").read_text(encoding="utf-8")
        self.assertIn("-UseDefaultCredentials", ps)
        self.assertIn("-UseBasicParsing", ps)
        self.assertIn("-MaximumRedirection 0", ps)
        self.assertIn("[Net.SecurityProtocolType]::Tls12", ps)
        self.assertIn("RawContentStream", ps)
        self.assertIn("case-lookup-diagnostic.txt", ps)
        for forbidden in (
            "Invoke-Expression",
            "-Credential ",
            "ConvertTo-SecureString",
            "SkipCertificateCheck",
            "ServerCertificateValidationCallback",
        ):
            self.assertNotIn(forbidden, ps)
        self.assertNotIn("message=", ps.split("ConvertTo-Json -Compress))")[0].rsplit("[Console]::Out.Write", 1)[1])


class Xml(unittest.TestCase):
    def test_rows_are_read_with_nulls_left_out(self):
        rows = ssrs.rows(CASE_XML, ssrs.CASE_REPORT, 1000)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["InspectorName"], "")
        self.assertNotIn("InspectionDate", rows[0])
        self.assertNotIn("Landmark", rows[1])
        self.assertEqual(rows[1]["OwnerAddress"], "PO BOX 555\nSUITE 0100\nMADISON, WI 53701")
        self.assertEqual(len(ssrs.rows(OPEN_XML, ssrs.OPEN_CASES_REPORT, 1000)), 6)  # the export starts with a BOM

    def test_wrong_report_html_dtd_oversize_and_garbage_are_refused(self):
        refused = [
            (CASE_XML, ssrs.OPEN_CASES_REPORT, "SSRS_WRONG_REPORT"),
            (CASE_XML.replace(b'Name="DocumenGeneratorImport"', b'Name="Other"'), ssrs.CASE_REPORT, "SSRS_WRONG_REPORT"),
            (b"<html><body>Sign in</body></html>", ssrs.CASE_REPORT, "SSRS_NOT_XML"),
            (b"<!DOCTYPE html><html></html>", ssrs.CASE_REPORT, "SSRS_NOT_XML"),
            (b"Report error", ssrs.CASE_REPORT, "SSRS_NOT_XML"),
            (b"<Report", ssrs.CASE_REPORT, "SSRS_NOT_XML"),
            (
                b'<?xml version="1.0"?><!DOCTYPE r [<!ENTITY a "aaaa">]><Report xmlns="DocumenGeneratorImport" Name="DocumenGeneratorImport"/>',
                ssrs.CASE_REPORT,
                "SSRS_DTD",
            ),
            (b" " * (ssrs.MAX_BYTES + 1), ssrs.CASE_REPORT, "SSRS_LIMIT"),
            ("text", ssrs.CASE_REPORT, "SSRS_LIMIT"),
        ]
        for raw, report, fragment in refused:
            with self.subTest(fragment=fragment, raw=raw[:30]), self.assertRaisesRegex(ssrs.ReportError, fragment):
                ssrs.rows(raw, report, 1000)
        with self.assertRaisesRegex(ssrs.ReportError, "SSRS_LIMIT"):
            ssrs.rows(OPEN_XML, ssrs.OPEN_CASES_REPORT, 5)

    def test_an_empty_report_of_the_right_kind_is_an_empty_answer(self):
        empty = b'<?xml version="1.0" encoding="utf-8"?><Report Name="DocumenGeneratorImport" xmlns="DocumenGeneratorImport"><Tablix1><Details_Collection /></Tablix1></Report>'
        self.assertEqual(ssrs.rows(empty, ssrs.CASE_REPORT, 1000), [])

    def test_case_and_open_case_renders_send_only_the_validated_value(self):
        with patch.object(ssrs, "fetch", return_value=CASE_XML) as fetch:
            ssrs.case_rows("CB2026-313-04591")
            self.assertTrue(fetch.call_args.args[0].endswith("&CaseNumber=CB2026-313-04591"))
            self.assertEqual(fetch.call_args.args[1], 40)
        with patch.object(ssrs, "fetch", return_value=OPEN_XML) as fetch:
            ssrs.open_case_rows()
            self.assertNotIn("Inspector=", fetch.call_args.args[0])
            ssrs.open_case_rows("Jordan Q Example", 90)
            self.assertTrue(fetch.call_args.args[0].endswith("&Inspector=Jordan+Q+Example"))


class CaseReportFields(unittest.TestCase):
    def test_historic_rules_are_the_report_querys_rules(self):
        rdl = (ROOT / "tests/fixtures/reference/Document-Generator-Import.rdl").read_text(encoding="utf-8-sig")
        for fragment, district in case_lookup.HISTORIC_DISTRICTS:
            self.assertIn("WHEN r.ZONING_DISTRICT LIKE '%" + fragment + "%' THEN '" + district + "'", rdl)
        self.assertIn("CASE WHEN r.ZONING_DISTRICT LIKE '%" + case_lookup.LANDMARK_ZONING + "%' THEN 'Yes' ELSE 'No' END AS IndividualLandmark", rdl)
        self.assertEqual(case_lookup.zoning_flags("TR-V1 his-tl"), ("Yes", "Third Lake Ridge", "No"))
        self.assertEqual(case_lookup.zoning_flags("PD HIS-L"), ("No", None, "Yes"))
        self.assertEqual(case_lookup.zoning_flags(None), ("No", None, "No"))

    def test_report_rows_become_the_lookup_fields(self):
        rows = [case_lookup.report_row(r) for r in ssrs.rows(CASE_XML, ssrs.CASE_REPORT, 1000)]
        self.assertEqual(set(rows[0]), set(case_lookup.FIELDS) | {"RecordCategory"})
        self.assertEqual(rows[0]["HistoricDistrict"], "Yes")
        self.assertEqual(rows[0]["HistoricDistrictName"], "Mansion Hill")
        self.assertEqual(rows[0]["IndividualLandmark"], "No")
        self.assertIsNone(rows[0]["InspectionDate"])
        self.assertIsNone(rows[0]["InspectionScheduledDate"])
        self.assertIsNone(rows[1]["Landmark"])
        self.assertEqual((rows[1]["InspectionDate"], rows[1]["InspectionTime"]), ("2026-11-09T06:20:00", "10:03AM"))
        self.assertEqual(
            case_lookup.report_row({"HistoricDistrictName": "Printed Name", "ZoningDistrict": "HIS-MH"})["HistoricDistrictName"], "Printed Name"
        )
        self.assertNotIn("RecordCategory", case_lookup.report_row({"RecordCategory": ""}))

    def test_lookup_answers_from_the_report_with_its_provenance(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(ssrs, "fetch", return_value=CASE_XML):
            answer = case_lookup.lookup(Path(folder), " cb2026-313-04591 ")
        self.assertEqual(answer["caseNumber"], "CB2026-313-04591")
        self.assertEqual(len(answer["rows"]), 2)
        self.assertEqual(answer["rows"][1]["RecordCategory"], "No Permit")
        source = answer["source"]
        self.assertEqual(
            {k: source[k] for k in ("kind", "server", "report")},
            {
                "kind": "ssrs",
                "server": "entreports.cityofmadison.com",
                "report": "/Prod/Local/Building Inspection/Enforcement/DocumenGeneratorImport",
            },
        )
        self.assertRegex(source["retrievedAt"], r"^\d{4}-\d{2}-\d{2}T")

    def test_a_report_for_another_case_or_a_failed_render_imports_nothing(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch.object(ssrs, "fetch", return_value=CASE_XML), self.assertRaisesRegex(case_lookup.CaseLookupError, "different case"):
                case_lookup.lookup(Path(folder), "CB2026-313-04592")
            with patch.object(ssrs, "fetch", side_effect=ssrs.ReportError("offline")), self.assertRaisesRegex(case_lookup.CaseLookupError, "offline"):
                case_lookup.lookup(Path(folder), "CB2026-313-04591")
            self.assertTrue(case_lookup.LOOKUPS.acquire(blocking=False))
            case_lookup.LOOKUPS.release()


class Settings(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def write(self, raw):
        (self.root / "Case Lookup").mkdir(exist_ok=True)
        (self.root / "Case Lookup/settings.json").write_text(raw, encoding="utf-8")

    def test_the_only_setting_is_enabled_and_earlier_sql_settings_are_ignored(self):
        self.assertEqual(case_lookup.settings(self.root), {"enabled": True, "server": "entreports.cityofmadison.com"})
        for raw in (
            "{}",
            "\ufeff{}",
            '{"enabled": true}',
            '{"server": "sqlelam", "database": "AccelaReporting"}',
            '{"server": "anything.example", "enabled": true}',
        ):
            self.write(raw)
            self.assertEqual(case_lookup.settings(self.root)["server"], "entreports.cityofmadison.com", raw)
        for raw in (
            "{bad",
            "[]",
            '{"password": "x"}',
            '{"enabled": "yes"}',
            '{"server": 5}',
            '{"database": "' + "x" * 129 + '"}',
            '{"trustServerCertificate": true}',
        ):
            self.write(raw)
            with self.subTest(raw=raw), self.assertRaisesRegex(case_lookup.CaseLookupError, "settings.json is invalid"):
                case_lookup.settings(self.root)
        self.write('{"enabled": false}')
        with self.assertRaisesRegex(case_lookup.CaseLookupError, "disabled"):
            case_lookup.settings(self.root)
        with self.assertRaisesRegex(case_lookup.CaseLookupError, "shared"):
            case_lookup.settings(self.root / "absent")
        example = json.loads((ROOT / "app/assets/case-lookup-settings.example.json").read_text(encoding="utf-8"))
        self.write(json.dumps(example))
        self.assertTrue(case_lookup.settings(self.root)["enabled"])
        self.assertEqual(example, {"enabled": True})

    def test_the_sql_lookup_is_gone(self):
        for name in ("case_lookup.ps1", "case_lookup.sql", "inspector_cases.sql", "inspector_list.sql", "inspector_names.sql"):
            self.assertFalse((ssrs.HERE / name).exists(), name)
        manifest = json.loads((ROOT / "tools/runtime-manifest.template.json").read_text(encoding="utf-8"))
        text = json.dumps(manifest)
        self.assertIn("ssrs_fetch.ps1", text)
        self.assertIn("ssrs_reports.py", text)
        self.assertNotIn(".sql", text)
        self.assertNotIn("case_lookup.ps1", text)


if __name__ == "__main__":
    unittest.main()
