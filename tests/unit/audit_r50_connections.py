import io, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import trusted_connections as trusted
import case_lookup
import server


class TrustedConnections(unittest.TestCase):
    def test_bad_schemes_hosts_redirects_and_sizes(self):
        for url in [
            "file:///secret",
            "http://maps.cityofmadison.com/x",
            "https://example.invalid/x",
            "https://maps.cityofmadison.com:8443/x",
            "https://x@maps.cityofmadison.com/x",
            "https://maps.cityofmadison.com:bad/x",
            "https://[bad/x",
        ]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                trusted.fetch_json(url)
        trusted.approved_gis("https://maps.cityofmadison.com/x")
        request = trusted.urllib.request.Request("https://maps.cityofmadison.com/x")
        with self.assertRaises(ValueError):
            trusted.Redirects().redirect_request(request, None, 302, "", {}, "https://example.invalid/leak")

        class Response(io.BytesIO):
            headers = {}

            def geturl(self):
                return "https://maps.cityofmadison.com/x"

        with patch.object(trusted.urllib.request.OpenerDirector, "open", return_value=Response(b"x" * (trusted.MAX_JSON_BYTES + 1))):
            with self.assertRaisesRegex(ValueError, "20 MB"):
                trusted.fetch_json("https://maps.cityofmadison.com/x")

    def test_existing_helper_must_not_read_file_urls(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "synthetic.json"
            path.write_text('{"synthetic":true}')
            with self.assertRaises(ValueError):
                server.fetch_json(path.as_uri())

    def test_share_anchor_settings_are_not_staged_or_installed(self):
        import verified_update, install_release, deploy_manifest

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            share = root / "share"
            share.mkdir()
            local = root / "local"
            local.mkdir()
            stage = root / "stage"
            stage.mkdir()
            (share / "server.py").write_bytes(b"synthetic runtime")
            (share / "runtime-manifest.json").write_text(json.dumps({"release": "2026-10-16 R50", "helperVersion": "2026.10.16.50"}))
            deploy_manifest.write_manifest(share)
            (share / "integrity-settings.json").write_text('{"anchor":"untrusted share value"}')
            (local / "integrity-settings.json").write_text("IT-owned existing local configuration")
            manifest = verified_update.stage_update(share, stage, local)
            self.assertFalse((stage / "integrity-settings.json").exists())
            install_release.install(stage, local, list(manifest["files"]) + ["runtime-manifest.json", "verified-install.json"])
            self.assertEqual((local / "integrity-settings.json").read_text(), "IT-owned existing local configuration")
            fresh = root / "fresh-local"
            fresh.mkdir()
            fresh_stage = root / "fresh-stage"
            fresh_stage.mkdir()
            verified_update.stage_update(share, fresh_stage, fresh)
            install_release.install(fresh_stage, fresh, list(manifest["files"]) + ["runtime-manifest.json", "verified-install.json"])
            self.assertFalse((fresh / "integrity-settings.json").exists(), "A fresh installation never imports the share-only anchor settings")

    def test_unapproved_sql_with_or_without_workaround(self):
        for bypass in [False, True]:
            with tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                (root / "Case Lookup").mkdir()
                (root / "Case Lookup/settings.json").write_text(json.dumps({"server": "attacker.invalid"}))
                local = root / "MadisonDocWriter"
                local.mkdir()
                (local / "case-lookup-local-settings.json").write_text(json.dumps({"trustServerCertificate": bypass}))
                with (
                    patch.dict(case_lookup.os.environ, {"LOCALAPPDATA": str(root)}),
                    self.assertRaisesRegex(case_lookup.CaseLookupError, "allowlist"),
                ):
                    case_lookup.settings(root)


if __name__ == "__main__":
    unittest.main()
