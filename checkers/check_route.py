#!/usr/bin/env python3
"""Checker `route`: Scenario B constant-speed segment energy.

Model (toy closed form, no array input):
  F_roll = m * g * Crr
  F_aero = 0.5 * rho * CdA * v^2
  E_kWh  = (F_roll + F_aero) * d / 3.6e6
  budget_kWh = (soc_start - soc_end) * pack_kWh
  feasible = E_kWh <= budget_kWh
  v_max = largest v with E(v) <= budget (bisection, 80 iterations)

One request may carry `alternative_mass_kg`, a list of extra masses. Each mass
is evaluated as its own case so a single run returns all of them (RC2).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from common import (  # noqa: E402
    MalformedRequest,
    optional_number,
    require_number,
    run,
)

CHECKER = "route"
VERSION = "1"
G = 9.81
RHO = 1.20


def mass_label(mass):
    return "mass_%skg" % ("%g" % mass)


def energy_kwh(mass, crr, cda, rho, v, d, g=G):
    rolling = mass * g * crr
    aero = 0.5 * rho * cda * v * v
    total = rolling + aero
    return rolling, aero, total, total * d / 3.6e6


def v_max_for_budget(mass, crr, cda, rho, d, budget_kwh, g=G):
    """Largest constant speed whose energy fits the budget. Bisection."""
    rolling_only = energy_kwh(mass, crr, cda, rho, 0.0, d, g)[3]
    if rolling_only > budget_kwh:
        return 0.0
    lo, hi = 0.0, 1.0
    while energy_kwh(mass, crr, cda, rho, hi, d, g)[3] <= budget_kwh:
        hi *= 2.0
        if hi > 1e6:
            return hi
    for _ in range(80):
        mid = (lo + hi) / 2.0
        if energy_kwh(mass, crr, cda, rho, mid, d, g)[3] <= budget_kwh:
            lo = mid
        else:
            hi = mid
    return lo


def compute(inputs):
    where = "inputs"
    mass = require_number(inputs, "mass_kg", where)
    crr = require_number(inputs, "Crr", where)
    cda = require_number(inputs, "CdA", where)
    v = require_number(inputs, "v_mps", where)
    d = require_number(inputs, "d_m", where)
    pack = require_number(inputs, "pack_kWh", where)
    soc_start = require_number(inputs, "soc_start", where)
    soc_end = require_number(inputs, "soc_end", where)
    rho = optional_number(inputs, "rho", RHO, where)
    g = optional_number(inputs, "g", G, where)
    alternatives = inputs.get("alternative_mass_kg", [])
    if alternatives is None:
        alternatives = []
    if not isinstance(alternatives, list):
        raise MalformedRequest("inputs: 'alternative_mass_kg' must be a list")
    for i, alt in enumerate(alternatives):
        if isinstance(alt, bool) or not isinstance(alt, (int, float)):
            raise MalformedRequest(
                "inputs.alternative_mass_kg[%d]: must be a number" % i
            )
    for key, val in (("mass_kg", mass), ("pack_kWh", pack), ("d_m", d)):
        if val <= 0:
            raise MalformedRequest("inputs: '%s' must be positive" % key)
    if not (0 <= soc_end < soc_start <= 1):
        raise MalformedRequest("inputs: need 0 <= soc_end < soc_start <= 1")

    budget = (soc_start - soc_end) * pack
    masses = [mass] + [float(a) for a in alternatives]
    cases = {}
    checks = []
    for m in masses:
        label = mass_label(m)
        if label in cases:
            raise MalformedRequest("inputs: duplicate mass %r" % m)
        rolling, aero, total, e_kwh = energy_kwh(m, crr, cda, rho, v, d, g)
        feasible = e_kwh <= budget
        vmax = v_max_for_budget(m, crr, cda, rho, d, budget, g)
        cases[label] = {
            "mass_kg": m,
            "rolling_N": round(rolling, 4),
            "aero_N": round(aero, 4),
            "total_N": round(total, 4),
            "energy_kWh": round(e_kwh, 4),
            "budget_kWh": round(budget, 4),
            "feasible": feasible,
            "v_max_mps": round(vmax, 4),
        }
        checks.append(
            {
                "name": "%s_feasible" % label,
                "pass": feasible,
                "expected": round(budget, 4),
                "actual": round(e_kwh, 4),
            }
        )
    outputs = {
        "budget_kWh": round(budget, 4),
        "primary": mass_label(mass),
        "cases": cases,
    }
    return outputs, checks


if __name__ == "__main__":
    sys.exit(run(CHECKER, VERSION, compute))
