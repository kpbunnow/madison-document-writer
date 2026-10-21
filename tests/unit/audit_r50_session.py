import json, secrets, threading, unittest, urllib.request, urllib.error, tempfile, shutil
from pathlib import Path
from unittest.mock import patch
import server


class SessionSecurity(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for name in ["madison-document-writer.html", "madison-reports.html"]:
            shutil.copyfile(Path(__file__).resolve().parents[2] / "build/dist" / name, self.root / name)
        self.here = patch.object(server, "HERE", self.root)
        self.here.start()
        self.http = server.Server(("127.0.0.1", 0), server.Handler)
        self.port = server.PORT
        server.PORT = self.http.server_address[1]
        self.base = "http://127.0.0.1:" + str(server.PORT)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join()
        server.PORT = self.port
        self.here.stop()
        self.temp.cleanup()

    def request(self, path, headers=None, body=None):
        req = urllib.request.Request(self.base + path, data=None if body is None else b"{}", headers=headers or {})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, r.read(), dict(r.headers)
        except urllib.error.HTTPError as e:
            return e.code, e.read(), dict(e.headers)

    def test_all_api_routes_reject_missing_wrong_token_and_foreign_context(self):
        routes = [
            "/session/bootstrap",
            "/locks/status",
            "/cases/search",
            "/outbox/list",
            "/reporting/views",
            "/administration/snow-letter",
            "/citations/history",
            "/cases/list",
            "/cases/open",
            "/cases/find",
            "/reporting/index",
            "/reporting/parcels",
            "/reporting/areas",
            "/draft-backups/list",
            "/catalog/reviews",
            "/setup/probe",
            "/cases/save",
            "/cases/summary",
            "/save-pdf",
            "/email",
            "/address/parse",
            "/locks/release",
            "/outbox/read",
            "/outbox/batch-sync",
            "/email/reminder",
            "/administration/deposit-override",
        ]
        # Every registered route, so a new one cannot be left out; /dw-status is public by design (see below).
        routes = sorted((set(routes) | set(server.GET_ROUTES) | set(server.POST_ROUTES)) - {"/dw-status"})
        self.assertGreaterEqual(len(routes), 35)
        for route in routes:
            for body in (None, {}):
                with self.subTest(route=route, body=body):
                    self.assertEqual(self.request(route, body=body)[0], 403)
                    self.assertEqual(self.request(route, {"X-DocWriter-Token": "wrong"}, body)[0], 403)
        token = server.SESSION_TOKEN
        for headers in [
            {"X-DocWriter-Token": token, "Origin": "https://foreign.invalid"},
            {"X-DocWriter-Token": token, "Host": "foreign.invalid"},
            {"X-DocWriter-Token": token, "Sec-Fetch-Site": "cross-site"},
        ]:
            for route in routes:
                for body in (None, {}):
                    with self.subTest(route=route, headers=headers, body=body):
                        self.assertEqual(self.request(route, headers, body)[0], 403)

    def test_static_bootstrap_status_and_restart(self):
        status, body, _ = self.request("/dw-status")
        self.assertEqual(status, 200)
        self.assertEqual(set(json.loads(body)), {"ok", "version", "ready"})
        status, body, _ = self.request("/")
        self.assertEqual(status, 200)
        self.assertNotIn(server.SESSION_TOKEN.encode(), body)
        status, body, _ = self.request("/", {"X-DocWriter-Token": server.SESSION_TOKEN})
        self.assertIn(server.SESSION_TOKEN.encode(), body)
        headers = {"X-DocWriter-Token": server.SESSION_TOKEN}
        self.assertNotEqual(self.request("/cases/list", headers)[0], 403)
        with patch.object(server, "SESSION_TOKEN", secrets.token_urlsafe(32)):
            self.assertEqual(self.request("/cases/list", headers)[0], 403)
            code, raw, _ = self.request(
                "/session/bootstrap", {"Content-Type": "application/json", "X-DocWriter-Bootstrap": server.SESSION_BOOTSTRAP}, {}
            )
            self.assertEqual(code, 200)
            self.assertEqual(json.loads(raw)["token"], server.SESSION_TOKEN)
        self.assertEqual(self.request("/cases/list", {"X-DocWriter-Bootstrap": server.SESSION_BOOTSTRAP})[0], 403)

    def test_profile_secret_is_private_and_restart_keeps_only_bootstrap(self):
        import os
        import helper_session

        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"LOCALAPPDATA": folder}):
            master = helper_session.prepare("a" * 43)
            self.assertEqual(helper_session.launch_token(), "a" * 43)
            self.assertEqual(helper_session.prepare("b" * 43), master)
            self.assertEqual(helper_session.launch_token(), "b" * 43)
            if os.name != "nt":
                path = helper_session.profile_folder() / helper_session.NAME
                path.chmod(0o644)
                with self.assertRaises(ValueError):
                    helper_session.launch_token()


if __name__ == "__main__":
    unittest.main()
