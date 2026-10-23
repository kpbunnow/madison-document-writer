"""Consolidation review: failed preflight invalidates evidence; timer teardown preserves completion and failures."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class GateLifecycle(unittest.TestCase):
    def test_failed_preflight_invalidates_evidence_but_diagnostics_are_read_only(self):
        for mode, args in (("full", []), ("fast", []), ("full", ["--check-browser-only"])):
            with self.subTest(mode=mode, args=args), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / "tools").mkdir()
                for name in ("run_tests.py", "release_evidence.py", "project_layout.py"):
                    shutil.copyfile(ROOT / "tools" / name, root / "tools" / name)
                logs = root / "build/test-results"
                logs.mkdir(parents=True)
                names = ("results.json", "evidence.json", "r50-print-compatibility.json")
                for name in names:
                    (logs / name).write_text('"earlier passing evidence"', encoding="utf-8")
                # Fail only the external precheck. Execute the real runner with its own isolated ROOT and files.
                script = (
                    "import runpy,sys,subprocess;from unittest.mock import patch;"
                    "sys.path.insert(0,'tools');sys.argv=['tools/run_tests.py']+" + repr(args) + ";"
                    "mock=patch('subprocess.run',return_value=subprocess.CompletedProcess([],1));mock.start();"
                    "runpy.run_path('tools/run_tests.py',run_name='__main__')"
                )
                run = subprocess.run(
                    [sys.executable, "-c", script],
                    cwd=root,
                    env={**os.environ, "DW_FAST": "1" if mode == "fast" else "0"},
                    capture_output=True,
                    encoding="utf-8",
                    timeout=10,
                )
                self.assertEqual(run.returncode, 1, run.stdout + run.stderr)
                if args:
                    for name in names:
                        self.assertEqual((logs / name).read_text(encoding="utf-8"), '"earlier passing evidence"')
                else:
                    self.assertEqual(json.loads((logs / "results.json").read_text(encoding="utf-8")), [])
                    for name in names[1:]:
                        self.assertFalse((logs / name).exists(), name)

    def timer_run(self, script):
        prelude = "const assert=require('assert/strict');const {settle}=require('./tests/fixtures/settle_ui_timers.cjs');"
        return subprocess.run(["node", "-e", prelude + script], cwd=ROOT, capture_output=True, encoding="utf-8", timeout=10)

    def test_timer_receiver_arguments_order_cancellation_and_completion(self):
        run = self.timer_run("""
            let complete=false,handle;const seen=[];
            const cancelled=setTimeout(()=>{throw Error('cancelled timer ran')},10000);clearTimeout(cancelled);
            handle=setTimeout(function(a,b){
                assert.equal(this,handle,'native timeout receiver');assert.deepEqual([a,b],['a',2]);
                assert.ok(complete,'completion must settle first');seen.push('long');
            },20000,'a',2);
            const completion=new Promise(resolve=>setTimeout(()=>{complete=true;seen.push('short');resolve()},20));
            settle(completion,{close(){assert.deepEqual(seen,['short','long']);console.log('closed after all work')}});
        """)
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertIn("closed after all work", run.stdout)

    def test_timer_and_completion_failures_are_not_hidden(self):
        cases = {
            "synchronous": "throw Error('expected-sync');",
            "short timer": "setTimeout(()=>{throw Error('expected-short')},20);settle();",
            "long timer": "setTimeout(()=>{throw Error('expected-long')},20000);settle();",
            "timer rejection": "setTimeout(()=>Promise.reject(Error('expected-rejection')),20000);settle();",
            "completion rejection": "settle(Promise.reject(Error('expected-completion')));",
            "referenced interval": "setInterval(()=>{},20000);settle();",
        }
        for name, script in cases.items():
            with self.subTest(name):
                run = self.timer_run(script)
                self.assertNotEqual(run.returncode, 0, run.stdout + run.stderr)
                self.assertIn("expected-" if name != "referenced interval" else "referenced interval", run.stderr)


if __name__ == "__main__":
    unittest.main()
