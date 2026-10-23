"""Exit Document Writer: the authenticated /helper/shutdown route over real loopback HTTP.

The route is registered in POST_ROUTES, so it inherits the token, Host, Origin, fetch-site and JSON checks;
it refuses with readable reasons while the helper has active work (an in-flight request, a held lock, an
install transaction) and a client "force" never overrides that; when idle it answers first and then stops
serving. No other stop route exists and nothing here stops any other process.
"""

import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

import case_store
import server


class HelperShutdown(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "Case JSON Files").mkdir()
        self.patches = [
            patch.object(server, "HERE", self.root),
            patch.dict("os.environ", {"DW_CASE_DIR": str(self.root / "Case JSON Files")}),
        ]
        for item in self.patches:
            item.start()
        server.STOPPING.clear()
        server.ACTIVE_WORK.clear()
        self.http = server.Server(("127.0.0.1", 0), server.Handler)
        self.port = server.PORT
        server.PORT = self.http.server_address[1]
        self.base = "http://127.0.0.1:" + str(server.PORT)
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join(5)
        server.PORT = self.port
        server.STOPPING.clear()
        server.ACTIVE_WORK.clear()
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()

    def headers(self, **extra):
        return {"X-DocWriter-Token": server.SESSION_TOKEN, "Content-Type": "application/json", **extra}

    def post(self, path, body=b"{}", headers=None, method="POST"):
        request = urllib.request.Request(self.base + path, data=body, headers=self.headers() if headers is None else headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                return response.status, json.loads(response.read() or b"null")
        except urllib.error.HTTPError as error:
            raw = error.read()
            try:
                return error.code, json.loads(raw)
            except ValueError:
                return error.code, raw

    def stops(self):
        self.thread.join(5)
        return not self.thread.is_alive()

    def test_route_is_a_guarded_post_route_and_the_only_stop_route(self):
        self.assertIs(server.POST_ROUTES["/helper/shutdown"], server.Handler._post_shutdown)
        self.assertNotIn("/helper/shutdown", server.GET_ROUTES)
        self.assertNotIn("/helper/shutdown", server.STATIC_ROUTES)
        stop_like = [
            r
            for r in list(server.GET_ROUTES) + list(server.POST_ROUTES) + list(server.STATIC_ROUTES)
            if any(w in r for w in ("shutdown", "exit", "stop", "quit"))
        ]
        self.assertEqual(stop_like, ["/helper/shutdown"])
        token = server.SESSION_TOKEN
        refused = [
            {"Content-Type": "application/json"},
            {"Content-Type": "application/json", "X-DocWriter-Token": "wrong"},
            {"Content-Type": "application/json", "X-DocWriter-Bootstrap": server.SESSION_BOOTSTRAP},
            {"Content-Type": "application/json", "X-DocWriter-Token": token, "Origin": "https://foreign.invalid"},
            {"Content-Type": "application/json", "X-DocWriter-Token": token, "Host": "foreign.invalid"},
            {"Content-Type": "application/json", "X-DocWriter-Token": token, "Sec-Fetch-Site": "cross-site"},
            {"Content-Type": "text/plain", "X-DocWriter-Token": token},
            {"X-DocWriter-Token": token},
        ]
        for headers in refused:
            with self.subTest(headers=headers):
                self.assertEqual(self.post("/helper/shutdown", headers=headers)[0], 403)
        # GET, even with the token, is not a stop request.
        self.assertEqual(self.post("/helper/shutdown", body=None, headers={"X-DocWriter-Token": token}, method="GET")[0], 404)
        self.assertEqual(self.post("/helper/shutdown", body=None, headers={}, method="GET")[0], 403)
        for body in (b"[]", b'{"force": "yes"}', b'{"other": true}', b"not json"):
            with self.subTest(body=body):
                self.assertEqual(self.post("/helper/shutdown", body=body)[0], 400)
        self.assertFalse(server.STOPPING.is_set())
        self.assertTrue(self.thread.is_alive(), "no refused request stopped the helper")
        self.assertEqual(self.post("/cases/list", body=None, method="GET")[0], 200)

    def test_refuses_while_another_request_is_in_flight_and_force_does_not_bypass(self):
        entered, release = threading.Event(), threading.Event()

        def slow_save(*args, **kwargs):
            entered.set()
            release.wait(10)
            return {"ok": True}

        results = []
        with patch.object(server, "save_case", slow_save):
            worker = threading.Thread(target=lambda: results.append(self.post("/cases/save", b'{"name": "QA.json"}')))
            worker.start()
            self.assertTrue(entered.wait(5))
            for body in (b"{}", b'{"force": true}'):
                status, answer = self.post("/helper/shutdown", body)
                self.assertEqual(status, 409)
                self.assertFalse(answer["ok"])
                self.assertIn("A case record is being saved to the shared folder.", answer["reasons"])
                self.assertIn("not stopped", answer["error"])
            self.assertFalse(server.STOPPING.is_set())
            release.set()
            worker.join(5)
        self.assertEqual(results[0][0], 200, "the in-flight save completed normally")
        # The handler writes its response before its finally block releases the activity, so the client can
        # see the answer a moment before the counter clears. Wait (bounded) for the release itself.
        deadline = time.monotonic() + 5
        while server.ACTIVE_WORK and time.monotonic() < deadline:
            time.sleep(0.01)
        self.assertEqual(server.ACTIVE_WORK, {})
        self.assertEqual(self.post("/helper/shutdown")[0], 200)
        self.assertTrue(self.stops())

    def test_refuses_while_a_lock_is_held(self):
        for key, reason in (
            ("case:qa-1", "A case record is locked while it is being saved."),
            ("issued-pdf:QA - 12345678.pdf", "An issued PDF is being filed."),
            ("pdf-operation:abc", "A PDF publication is in progress."),
        ):
            with self.subTest(key=key), case_store.file_lock(self.root, key):
                status, answer = self.post("/helper/shutdown", b'{"force": true}')
                self.assertEqual(status, 409)
                self.assertEqual(answer["reasons"], [reason])
                self.assertNotIn("qa-1", json.dumps(answer), "reasons never name a case or file")
                self.assertNotIn("12345678", json.dumps(answer))
        self.assertEqual(case_store.held_lock_kinds(), [])
        self.assertTrue(self.thread.is_alive())

    def test_refuses_during_an_install_transaction(self):
        (self.root / "install-transaction.json").write_text("{}", encoding="utf-8")
        status, answer = self.post("/helper/shutdown", b'{"force": true}')
        self.assertEqual(status, 409)
        self.assertEqual(answer["reasons"], ["A program update is being installed."])
        (self.root / "install-transaction.json").unlink()
        self.assertTrue(self.thread.is_alive())

    def test_anchor_is_counted_before_it_acquires_any_file_lock(self):
        entered, release = threading.Event(), threading.Event()

        def anchor(folder):
            entered.set()
            release.wait(5)

        with patch.object(server.case_integrity, "anchor_after_save", side_effect=anchor) as work:
            worker = threading.Thread(target=server.run_anchor_once)
            worker.start()
            try:
                self.assertTrue(entered.wait(3))
                self.assertEqual(case_store.held_lock_kinds(), [])
                status, answer = self.post("/helper/shutdown")
                self.assertEqual(status, 409)
                self.assertIn("Record integrity information is being updated.", answer["reasons"])
            finally:
                release.set()
                worker.join(5)
            self.assertEqual(server.ACTIVE_WORK, {})
            self.assertEqual(self.post("/helper/shutdown")[0], 200)
            self.assertFalse(server.run_anchor_once())
            work.assert_called_once()

    def test_idle_helper_answers_then_stops_and_starts_no_new_work(self):
        status, answer = self.post("/helper/shutdown")
        self.assertEqual((status, answer), (200, {"ok": True, "stopping": True}))
        self.assertTrue(server.STOPPING.is_set())
        self.assertTrue(self.stops(), "serve_forever returned")
        # A request accepted by a still-open socket before it closes is refused, never started.
        self.assertFalse(server.begin_activity("QA"))
        self.assertEqual(server.ACTIVE_WORK, {})

    def test_server_main_closes_the_socket_and_names_the_exit(self):
        source = (Path(server.__file__)).read_text(encoding="utf-8")
        main = source.split('if __name__ == "__main__":', 1)[1]
        self.assertIn("with Server((", main)
        self.assertIn("Document Writer has stopped.", main)
        # Shutdown never kills processes: no kill/terminate/taskkill anywhere in the helper.
        for word in ("taskkill", ".kill(", ".terminate(", "os.kill", "signal.SIG"):
            self.assertNotIn(word, source)

    def test_launcher_never_stops_a_running_helper(self):
        import desktop_launch

        helper = Path(server.__file__).resolve().parent
        for name in ("launch.py", "desktop_launch.py"):
            text = (helper / name).read_text(encoding="utf-8")
            self.assertNotIn("/helper/shutdown", text, name + " makes no token-less (or any) shutdown call")
            for word in ("taskkill", ".kill(", ".terminate(", "os.kill"):
                self.assertNotIn(word, text)
        # R57 and earlier helpers have no shutdown route: the dialog explains every way to stop one.
        for phrase in ("Exit Document Writer", "Start Document Writer.bat", "sign out of Windows", "contact IT"):
            self.assertIn(phrase, desktop_launch.OLDER_HELPER)


if __name__ == "__main__":
    unittest.main()
