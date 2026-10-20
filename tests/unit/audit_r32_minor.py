"""New zero-base defaults, legacy correction retention and launcher dependency."""

import copy, unittest, tempfile
from pathlib import Path
from unittest.mock import patch
import citation_pricing as pricing
import case_store, launch
from audit_r28_helper import pair


class Minor(unittest.TestCase):
    def test_zero_default_setting_and_correction(self):
        snap = pair()["events"][-1]["payload"]["snapshot"]
        snap["authoringVersion"] = 8
        c = snap["cits"]["charged_item"]
        c.update(
            ord="SPS321.125",
            base="0",
            amount="71.00",
            depositMode="base",
            depositSource="Synthetic explicitly approved zero base.",
            pricedOn=c["issued"],
            policyVersionHash=pricing.policy()["versionHash"],
        )
        c["assessments"] = pricing.assessment_cents(0, 4800)
        with self.assertRaisesRegex(ValueError, "zero forfeiture"):
            case_store.validate_authoring(snap, "2026-08-01T15:00:00Z")
        policy = {**pricing.policy(), "allowZeroBaseDeposits": True}
        with patch.object(pricing, "policy", return_value=policy):
            case_store.validate_authoring(snap, "2026-08-01T15:00:00Z")
        original = copy.deepcopy(snap)
        original["authoringVersion"] = 7
        case_store.validate_authoring(snap, "2026-08-01T15:00:00Z", original=original)

    def test_integrity_library_is_required(self):
        self.assertIn("vendor/python/rfc8785/__init__.py", launch.REQUIRED)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            share = root / "deploy"
            share.mkdir()
            for name in launch.REQUIRED:
                if name.startswith("vendor/"):
                    continue
                (share / name).write_text("synthetic deployment file")
            with (
                patch.object(launch, "__file__", str(share / "launch.py")),
                patch.dict(launch.os.environ, {"LOCALAPPDATA": str(root / "local")}),
                patch.object(launch.socket, "create_connection", side_effect=OSError),
            ):
                # The signed-update guard now rejects this unsigned fixture before dependency checks.
                with self.assertRaisesRegex(ValueError, "shared program files failed verification"):
                    launch.main()


if __name__ == "__main__":
    unittest.main()
