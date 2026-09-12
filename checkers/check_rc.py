#!/usr/bin/env python3
"""Checker `rc`: Scenario A precharge timing. See contracts/checker-io.md.

Model: first-order ideal RC.
  t_threshold = -R * C * ln(1 - threshold)
  fraction_at_timer = 1 - exp(-timer / (R * C))
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common import (  # noqa: E402
    MalformedRequest,
    optional_number,
    require_list,
    require_number,
    require_str,
    run,
)

CHECKER = "rc"
VERSION = "1"


def compute(inputs):
    where = "inputs"
    R = require_number(inputs, "R_ohm", where)
    threshold = require_number(inputs, "threshold", where)
    timer = require_number(inputs, "timer_s", where)
    tolerance = optional_number(inputs, "tolerance_s", 0.0005, where)
    caps = require_list(inputs, "capacitances", where)
    printed = inputs.get("printed", [])
    if not isinstance(printed, list):
        raise MalformedRequest("inputs: 'printed' must be a list")
    if R <= 0:
        raise MalformedRequest("inputs: 'R_ohm' must be positive")
    if not 0 < threshold < 1:
        raise MalformedRequest("inputs: 'threshold' must be in (0, 1)")
    if not caps:
        raise MalformedRequest("inputs: 'capacitances' must not be empty")

    exact = {}
    per_capacitance = {}
    for i, cap in enumerate(caps):
        cw = "inputs.capacitances[%d]" % i
        label = require_str(cap, "label", cw)
        C = require_number(cap, "C_F", cw)
        if C <= 0:
            raise MalformedRequest("%s: 'C_F' must be positive" % cw)
        if label in exact:
            raise MalformedRequest("%s: duplicate label %r" % (cw, label))
        tau = R * C
        t_threshold = -tau * math.log(1.0 - threshold)
        fraction = 1.0 - math.exp(-timer / tau)
        exact[label] = {"RC_s": tau, "t_threshold_s": t_threshold, "fraction_at_timer": fraction}
        per_capacitance[label] = {
            "RC_s": round(tau, 4),
            "t_threshold_s": round(t_threshold, 4),
            "fraction_at_timer": round(fraction, 5),
        }

    checks = []
    for i, p in enumerate(printed):
        pw = "inputs.printed[%d]" % i
        plabel = require_str(p, "label", pw)
        value = require_number(p, "value_s", pw)
        against = require_list(p, "against", pw)
        tol = optional_number(p, "tolerance_s", tolerance, pw)
        for target in against:
            if not isinstance(target, str) or target not in exact:
                raise MalformedRequest(
                    "%s: 'against' names unknown capacitance %r" % (pw, target)
                )
            actual = exact[target]["t_threshold_s"]
            checks.append(
                {
                    "name": "%s_matches_%s" % (plabel, target),
                    "pass": abs(value - actual) <= tol,
                    "expected": value,
                    "actual": round(actual, 4),
                    "tolerance": tol,
                }
            )
    for label in exact:
        fraction = exact[label]["fraction_at_timer"]
        checks.append(
            {
                "name": "%s_reaches_threshold_by_timer" % label,
                "pass": fraction >= threshold,
                "expected": threshold,
                "actual": round(fraction, 5),
            }
        )
    return {"per_capacitance": per_capacitance}, checks


if __name__ == "__main__":
    sys.exit(run(CHECKER, VERSION, compute))
