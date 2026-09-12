"""Runs each checker as a subprocess on the contract example requests.

    python3 -m unittest checkers/test_checkers.py -v
"""

import json
import os
import subprocess
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
EXAMPLES = os.path.join(ROOT, "contracts", "examples")
RC = os.path.join(HERE, "check_rc.py")
ROUTE = os.path.join(HERE, "check_route.py")
EDITOR = os.path.join(HERE, "apply_docx_edit.py")
DOCS = os.path.join(ROOT, "fixtures", "documents")


def run_checker(script, payload):
    if not isinstance(payload, (str, bytes)):
        payload = json.dumps(payload)
    proc = subprocess.run(
        [sys.executable, script],
        input=payload,
        capture_output=True,
        text=True,
        check=False,
        cwd=ROOT,
    )
    return proc.returncode, json.loads(proc.stdout), proc.stderr


def load_example(name):
    with open(os.path.join(EXAMPLES, name)) as fh:
        return json.load(fh)


def assert_outputs_close(test, expected, actual, path="outputs"):
    """Every numeric leaf within 4 decimal places; everything else exact."""
    if isinstance(expected, dict):
        test.assertIsInstance(actual, dict, path)
        test.assertEqual(sorted(expected), sorted(actual), path)
        for key in expected:
            assert_outputs_close(test, expected[key], actual[key], "%s.%s" % (path, key))
    elif isinstance(expected, bool) or not isinstance(expected, (int, float)):
        test.assertEqual(expected, actual, path)
    else:
        test.assertAlmostEqual(expected, actual, places=4, msg=path)


class ResponseEnvelope(object):
    """Mixin: assertions every completed response must satisfy."""

    def assert_envelope(self, request, response, checker):
        self.assertEqual(response["checker"], checker)
        self.assertEqual(response["version"], request["version"])
        self.assertRegex(
            response["run_id"], r"^%s-\d{8}T\d{6}Z-[0-9a-f]{4}$" % checker
        )
        self.assertEqual(response["inputs"], request["inputs"])
        self.assertIsNone(response["error"])
        for check in response["checks"]:
            self.assertIsInstance(check["name"], str)
            self.assertIsInstance(check["pass"], bool)


class CheckRcTest(unittest.TestCase, ResponseEnvelope):
    def test_example_request_matches_example_response(self):
        request = load_example("checker-rc-request.json")
        expected = load_example("checker-rc-response.json")
        code, response, stderr = run_checker(RC, request)
        self.assertEqual(code, 0, stderr)
        self.assert_envelope(request, response, "rc")
        assert_outputs_close(self, expected["outputs"], response["outputs"])
        expected_pass = {c["name"]: c["pass"] for c in expected["checks"]}
        actual_pass = {c["name"]: c["pass"] for c in response["checks"]}
        self.assertEqual(actual_pass, expected_pass)
        self.assertEqual(
            [c["name"] for c in response["checks"]],
            [c["name"] for c in expected["checks"]],
        )

    def test_run_id_is_unique_per_execution(self):
        request = load_example("checker-rc-request.json")
        _, first, _ = run_checker(RC, request)
        _, second, _ = run_checker(RC, request)
        self.assertNotEqual(first["run_id"], second["run_id"])

    def test_acceptance_values_from_spec(self):
        request = load_example("checker-rc-request.json")
        _, response, _ = run_checker(RC, request)
        per = response["outputs"]["per_capacitance"]
        self.assertAlmostEqual(per["680uF_text"]["t_threshold_s"], 2.2077, places=4)
        self.assertAlmostEqual(per["750uF_diagram"]["t_threshold_s"], 2.4350, places=4)
        self.assertAlmostEqual(per["820uF_change"]["t_threshold_s"], 2.6622, places=4)
        self.assertAlmostEqual(per["2mF_example"]["t_threshold_s"], 6.4933, places=4)
        self.assertAlmostEqual(per["820uF_change"]["fraction_at_timer"], 0.99848, places=4)

    def test_malformed_inputs_exit_1_with_error_and_empty_outputs(self):
        cases = [
            "not json",
            json.dumps([]),
            json.dumps({"checker": "route", "version": "1", "inputs": {}}),
            json.dumps({"checker": "rc", "version": "1", "inputs": {"R_ohm": "470"}}),
            json.dumps({"checker": "rc", "version": "1", "inputs": {
                "R_ohm": 470, "threshold": 0.999, "timer_s": 2.5,
                "capacitances": [{"label": "a", "C_F": 0.001}],
                "printed": [{"label": "p", "value_s": 1.0, "against": ["missing"]}],
            }}),
        ]
        for payload in cases:
            code, response, _ = run_checker(RC, payload)
            self.assertEqual(code, 1, payload)
            self.assertIsInstance(response["error"], str, payload)
            self.assertTrue(response["error"], payload)
            self.assertEqual(response["outputs"], {}, payload)
            self.assertEqual(response["checks"], [], payload)
            self.assertEqual(response["checker"], "rc")
            self.assertTrue(response["run_id"])


class CheckRouteTest(unittest.TestCase, ResponseEnvelope):
    BASE = {
        "Crr": 0.0048, "CdA": 0.12, "v_mps": 22, "d_m": 220000,
        "pack_kWh": 5.2, "soc_start": 0.96, "soc_end": 0.40,
    }

    def route(self, **overrides):
        inputs = dict(self.BASE)
        inputs.update(overrides)
        request = {"checker": "route", "version": "1", "inputs": inputs}
        code, response, stderr = run_checker(ROUTE, request)
        self.assertEqual(code, 0, stderr)
        self.assert_envelope(request, response, "route")
        return response

    def test_example_request_matches_example_response(self):
        request = load_example("checker-route-request.json")
        expected = load_example("checker-route-response.json")
        code, response, stderr = run_checker(ROUTE, request)
        self.assertEqual(code, 0, stderr)
        self.assert_envelope(request, response, "route")
        assert_outputs_close(self, expected["outputs"], response["outputs"])
        self.assertEqual(
            {c["name"]: c["pass"] for c in response["checks"]},
            {c["name"]: c["pass"] for c in expected["checks"]},
        )

    def test_v2_0_is_feasible_at_40_percent(self):
        case = self.route(mass_kg=290, Crr=0.0040)["outputs"]["cases"]["mass_290kg"]
        self.assertAlmostEqual(case["rolling_N"], 11.380, places=3)
        self.assertAlmostEqual(case["aero_N"], 34.848, places=3)
        self.assertAlmostEqual(case["total_N"], 46.228, places=3)
        self.assertAlmostEqual(case["energy_kWh"], 2.8250, places=4)
        self.assertAlmostEqual(case["budget_kWh"], 2.912, places=4)
        self.assertTrue(case["feasible"])
        self.assertAlmostEqual(case["v_max_mps"], 22.45, delta=0.01)

    def test_v2_1_is_not_feasible_at_40_percent(self):
        response = self.route(mass_kg=318)
        case = response["outputs"]["cases"]["mass_318kg"]
        self.assertAlmostEqual(case["rolling_N"], 14.974, places=3)
        self.assertAlmostEqual(case["total_N"], 49.822, places=3)
        self.assertAlmostEqual(case["energy_kWh"], 3.0447, places=4)
        self.assertFalse(case["feasible"])
        self.assertAlmostEqual(case["v_max_mps"], 21.30, delta=0.01)
        self.assertEqual(
            {c["name"]: c["pass"] for c in response["checks"]},
            {"mass_318kg_feasible": False},
        )

    def test_v2_1_is_feasible_at_35_percent(self):
        case = self.route(mass_kg=318, soc_end=0.35)["outputs"]["cases"]["mass_318kg"]
        self.assertAlmostEqual(case["budget_kWh"], 3.172, places=4)
        self.assertTrue(case["feasible"])
        self.assertAlmostEqual(case["v_max_mps"], 22.65, delta=0.01)

    def test_rc2_alternative_mass_returns_both_cases_in_one_run(self):
        response = self.route(mass_kg=318, alternative_mass_kg=[310])
        cases = response["outputs"]["cases"]
        self.assertEqual(sorted(cases), ["mass_310kg", "mass_318kg"])
        self.assertEqual(response["outputs"]["primary"], "mass_318kg")
        alt = cases["mass_310kg"]
        self.assertAlmostEqual(alt["rolling_N"], 14.597, places=3)
        self.assertAlmostEqual(alt["total_N"], 49.445, places=3)
        self.assertAlmostEqual(alt["energy_kWh"], 3.0217, places=4)
        self.assertFalse(alt["feasible"])
        self.assertFalse(cases["mass_318kg"]["feasible"])

    def test_malformed_inputs_exit_1_with_error_and_empty_outputs(self):
        cases = [
            "{",
            json.dumps({"checker": "route", "version": "2", "inputs": dict(self.BASE, mass_kg=318)}),
            json.dumps({"checker": "route", "version": "1", "inputs": dict(self.BASE)}),
            json.dumps({"checker": "route", "version": "1", "inputs": dict(self.BASE, mass_kg=318, soc_end=0.99)}),
            json.dumps({"checker": "route", "version": "1", "inputs": dict(self.BASE, mass_kg=318, alternative_mass_kg="310")}),
        ]
        for payload in cases:
            code, response, _ = run_checker(ROUTE, payload)
            self.assertEqual(code, 1, payload)
            self.assertIsInstance(response["error"], str, payload)
            self.assertEqual(response["outputs"], {}, payload)
            self.assertEqual(response["checks"], [], payload)


if __name__ == "__main__":
    unittest.main()


class ApplyDocxEditTests(unittest.TestCase):
    def _sha(self, path):
        import hashlib
        with open(path, "rb") as fh:
            return hashlib.sha256(fh.read()).hexdigest()

    def test_writes_new_file_and_leaves_source_alone(self):
        import tempfile
        src = os.path.join(DOCS, "precharge-review-r2.docx")
        before = self._sha(src)
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "r2-proposed.docx")
            code, res, err = run_checker(EDITOR, {"source": src, "out": out, "replacements": [{"find": "t = 6.91 s", "replace": "t = 6.493 s"}]})
            self.assertEqual(code, 0, err)
            self.assertEqual(res["source_sha256"], before)
            self.assertEqual(self._sha(out), res["sha256"])
            self.assertNotEqual(res["sha256"], before)
            code2, text, _ = run_checker(os.path.join(ROOT, "extractors", "docx_text.py"), "")
            # extractor takes a path arg, not stdin: call it directly
            proc = subprocess.run([sys.executable, os.path.join(ROOT, "extractors", "docx_text.py"), out], capture_output=True, text=True, check=False)
            paras = json.loads(proc.stdout)["paragraphs"]
            self.assertTrue(any("t = 6.493 s" in p for p in paras), paras)
            self.assertFalse(any("6.91" in p for p in paras))
        self.assertEqual(self._sha(src), before)

    def test_refuses_ambiguous_or_missing_text(self):
        import tempfile
        src = os.path.join(DOCS, "precharge-review-r2.docx")
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "x.docx")
            code, res, _ = run_checker(EDITOR, {"source": src, "out": out, "replacements": [{"find": "680 uF", "replace": "820 uF"}]})
            self.assertEqual(code, 1)
            self.assertIn("occurs 2 times", res["error"])
            self.assertFalse(os.path.exists(out))
            code, res, _ = run_checker(EDITOR, {"source": src, "out": out, "replacements": [{"find": "no such text", "replace": "x"}]})
            self.assertEqual(code, 1)
            self.assertIn("occurs 0 times", res["error"])
            code, res, _ = run_checker(EDITOR, {"source": src, "out": src, "replacements": [{"find": "t = 6.91 s", "replace": "t = 6.493 s"}]})
            self.assertEqual(code, 1)
            self.assertIn("never modified", res["error"])
