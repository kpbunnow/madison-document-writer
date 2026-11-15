"""Retain the complete publication operation before extraction, including callback failure order."""

import copy
import hashlib
from pathlib import Path
import unittest
from unittest.mock import patch

import case_store
from audit_publication_rules import contexts
import audit_workflow as fixtures
import snow_rules

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = ROOT / "tests/fixtures/publication_owner_reference.py.txt"
SHA256 = "b52227758c763dbaaa51afa53028c04eeeb3f641958eb56a989695ee3dfa6559"


def run(args, window, reference=False, stop=None):
    namespace = dict(vars(case_store))
    exec(compile(REFERENCE.read_text(encoding="utf-8"), str(REFERENCE), "exec"), namespace)
    trace = []

    def instrument(name, function):
        def called(*args, **kwargs):
            trace.append((name, copy.deepcopy(args), copy.deepcopy(kwargs)))
            if stop == len(trace):
                raise RuntimeError("publication interrupted at " + name)
            return function(*args, **kwargs)

        return called

    operations = ["calendar_date", "mailing_max_day", "mailing_message", "current_document", "validate_special_publication"]
    wrappers = {name: instrument(name, getattr(case_store, name)) for name in operations}
    original = copy.deepcopy(args)
    values = copy.deepcopy(args)
    with (
        patch.multiple(case_store, **wrappers),
        patch.object(snow_rules, "is_snow", instrument("is_snow", snow_rules.is_snow)),
        patch.object(snow_rules, "validate_snapshot", instrument("snow_snapshot", snow_rules.validate_snapshot)),
    ):
        namespace.update(wrappers)
        check = namespace["validate_publication"] if reference else case_store.validate_publication
        try:
            result = ("result", check(*values, check_date_window=window))
        except Exception as error:
            result = ("error", type(error).__name__, str(error))
    return result, trace, values == original


class PublicationOwner(unittest.TestCase):
    def equivalent(self, args, window, stop=None):
        expected = run(args, window, True, stop)
        self.assertEqual(run(args, window, False, stop), expected)
        self.assertTrue(expected[2], "publication validation never edits its inputs")
        return expected

    def test_retained_source(self):
        self.assertEqual(hashlib.sha256(REFERENCE.read_bytes()).hexdigest(), SHA256)

    def test_current_legacy_families_and_every_callback_interruption(self):
        samples = list(contexts(fixtures.initial()))
        for kind in ["extension", "citation", "referral", "referralUpdate", "compliance", "reinspectionNotice"]:
            samples += list(contexts(fixtures.followup(fixtures.initial(), "owner-" + kind, kind)))
        samples += [copy.deepcopy(samples[0]), copy.deepcopy(samples[0])]
        samples[-2][1]["payload"]["snapshot"].update(type="bestInterestExtension", special={})
        samples[-2][1]["type"] = "bestInterestExtension.issued"
        samples[-1][0]["case"]["caseType"] = "snow-10.28"
        samples[-1][1]["payload"]["snapshot"]["authoringVersion"] = 16
        for args in samples:
            for window in [False, True]:
                with self.subTest(kind=args[1]["type"], window=window):
                    trace = self.equivalent(args, window)[1]
                    for stop in range(1, len(trace) + 1):
                        self.equivalent(args, window, stop)

    def test_identity_source_visit_and_outcome_refusals_are_observable(self):
        args = list(contexts(fixtures.followup(fixtures.initial(), "owner")))[-1]
        mutations = [
            lambda a: a[1].update(by="wrong"),
            lambda a: a[1]["payload"]["snapshot"].update(fromDocId="missing"),
            lambda a: a[1]["payload"]["snapshot"].update(fromReinspId="missing"),
            lambda a: a[1]["payload"]["snapshot"]["items"][0].update(done=True, doneOn="2026-08-01"),
            lambda a: a[1]["payload"]["snapshot"]["items"][0].update(srcItemId="missing"),
        ]
        for mutate in mutations:
            value = copy.deepcopy(args)
            mutate(value)
            actual = self.equivalent(value, False)
            self.assertEqual(actual[0][0], "error")

    def test_locked_store_refusal_leaves_case_and_receipts_untouched(self):
        # The real coordinator acquires locks, merges, then validates before publishing.
        import tempfile

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            initial = fixtures.initial()
            name = "101 TEST LANE - QA-LIFE.json"
            first = case_store.save_case(root, name, initial)
            baseline = {p.relative_to(root): p.read_bytes() for p in root.rglob("*") if p.is_file()}
            for operation in ["validate_publication", "validate_history", "validate_issuance_groups"]:
                with patch.object(case_store, operation, side_effect=ValueError("synthetic refusal " + operation)):
                    with self.assertRaisesRegex(ValueError, "synthetic refusal"):
                        case_store.save_case(root, name, fixtures.followup(initial, operation), first["revision"], initial["case"])
                after = {p.relative_to(root): p.read_bytes() for p in root.rglob("*") if p.is_file()}
                self.assertEqual({p: after[p] for p in baseline}, baseline)
                self.assertTrue(all(p.parts[0] == "_recovery" for p in after.keys() - baseline.keys()))
                self.assertTrue(all(after[p] == baseline[Path(name)] for p in after.keys() - baseline.keys()))


if __name__ == "__main__":
    unittest.main()
