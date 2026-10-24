"""A timed-out feature suite must stop its scenario descendants, not just its parent."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

from suite_process import run_suite_process


class SuiteProcess(unittest.TestCase):
    def test_output_and_failure_status_are_preserved(self):
        result = run_suite_process(
            [sys.executable, "-c", 'import sys; print("out"); print("err", file=sys.stderr); sys.exit(3)'],
            cwd=Path.cwd(),
            env=os.environ.copy(),
            timeout=5,
        )
        self.assertEqual(result.returncode, 3)
        self.assertEqual(result.stdout, "out\n")
        self.assertEqual(result.stderr, "err\n")

    def test_timeout_stops_a_feature_suite_and_its_scenario(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            heartbeat = root / "heartbeat"
            child = root / "scenario.py"
            child.write_text(
                "from pathlib import Path\nimport time\np = Path("
                + repr(str(heartbeat))
                + ')\nwhile True:\n p.write_text(str(time.monotonic()), encoding="utf-8")\n time.sleep(.02)\n',
                encoding="utf-8",
            )
            parent = root / "feature.py"
            parent.write_text("import subprocess, sys\nsubprocess.run([sys.executable, " + repr(str(child)) + "], check=True)\n", encoding="utf-8")
            with self.assertRaises(subprocess.TimeoutExpired):
                run_suite_process([sys.executable, str(parent)], cwd=root, env=os.environ.copy(), timeout=2)
            self.assertTrue(heartbeat.exists(), "the scenario ran before the deadline")
            stopped = heartbeat.read_bytes()
            time.sleep(0.15)
            self.assertEqual(heartbeat.read_bytes(), stopped, "no scenario work survives the suite timeout")


if __name__ == "__main__":
    unittest.main()
