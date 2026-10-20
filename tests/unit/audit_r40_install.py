"""An interrupted file/vendor update rolls back before the installed copy starts."""

from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import install_release


class InstallRollback(unittest.TestCase):
    def test_failure_and_process_interruption_restore_previous_bytes(self):
        for failure in (OSError, SystemExit):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                local = root / "local"
                staging = root / "stage"
                local.mkdir()
                staging.mkdir()
                names = ["server.py", "runtime-manifest.json", "new.py", "vendor/python/lib.py"]
                for name in names:
                    (staging / name).parent.mkdir(parents=True, exist_ok=True)
                    (staging / name).write_text("new " + name)
                    if name != "new.py":
                        (local / name).parent.mkdir(parents=True, exist_ok=True)
                        (local / name).write_text("old " + name)
                real = install_release.os.replace
                count = 0

                def fail(source, target):
                    nonlocal count
                    if Path(source).is_relative_to(staging):
                        count += 1
                        if count == 3:
                            raise failure("synthetic install interruption")
                    return real(source, target)

                with patch.object(install_release.os, "replace", side_effect=fail):
                    with self.assertRaises(failure):
                        install_release.install(staging, local, names)
                if failure is SystemExit:
                    self.assertTrue(install_release.recover(local))
                self.assertFalse((local / "install-transaction.json").exists())
                self.assertFalse((local / "new.py").exists())
                for name in names:
                    if name != "new.py":
                        self.assertEqual((local / name).read_text(), "old " + name)


if __name__ == "__main__":
    unittest.main()
