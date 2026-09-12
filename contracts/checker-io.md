# Checker I/O contract

A checker is a stdlib-only Python script under `checkers/`. It is the trusted
verifier: the model never computes a number the card shows, the checker does.
The TypeScript side of this contract is `packages/agent-core/src/contracts/finding.ts`.

## Invocation

```
python3 checkers/check_rc.py < request.json > response.json
```

Exit code 0 on a completed run, even if checks fail. Exit code 1 only when the
request is malformed; still write a response with `error` set.

No network, no file writes, no imports outside the standard library.

## Request (stdin, one JSON object)

```json
{
  "checker": "rc",
  "version": "1",
  "inputs": { }
}
```

`inputs` is checker-specific and documented per checker below.

## Response (stdout, one JSON object)

```json
{
  "checker": "rc",
  "version": "1",
  "run_id": "rc-20260912T151200Z-7f3a",
  "inputs": { "...echo of request inputs..." },
  "outputs": { },
  "checks": [
    { "name": "printed_2.435_matches_750", "pass": true, "expected": 2.435, "actual": 2.4350, "tolerance": 0.0005 }
  ],
  "error": null
}
```

- `run_id`: `<checker>-<UTC timestamp>-<4 hex>`; unique per execution.
- `inputs`: verbatim echo. The record must be self-describing.
- `checks`: every named comparison the checker evaluated. `pass` is the only
  field the card is allowed to read as a verdict.
- `error`: `null` on completion. A string means do not trust `outputs`.

## Checker `rc` (Scenario A, precharge)

Model: first-order ideal RC. Time to reach fraction `f` of final voltage is
`t = -R * C * ln(1 - f)`. Fraction reached at time `t` is `1 - exp(-t / (R * C))`.

Inputs:

```json
{
  "R_ohm": 470,
  "threshold": 0.999,
  "timer_s": 2.5,
  "capacitances": [
    { "label": "680uF_text",    "C_F": 0.000680 },
    { "label": "750uF_diagram", "C_F": 0.000750 },
    { "label": "820uF_change",  "C_F": 0.000820 },
    { "label": "2mF_example",   "C_F": 0.002 }
  ],
  "printed": [
    { "label": "printed_2.435", "value_s": 2.435, "against": ["680uF_text", "750uF_diagram"] },
    { "label": "printed_6.91",  "value_s": 6.91,  "against": ["2mF_example"] }
  ],
  "tolerance_s": 0.0005
}
```

Outputs:

```json
{
  "per_capacitance": {
    "680uF_text":    { "RC_s": 0.3196, "t_threshold_s": 2.2077, "fraction_at_timer": 0.99960 },
    "750uF_diagram": { "RC_s": 0.3525, "t_threshold_s": 2.4350, "fraction_at_timer": 0.99917 },
    "820uF_change":  { "RC_s": 0.3854, "t_threshold_s": 2.6622, "fraction_at_timer": 0.99848 },
    "2mF_example":   { "RC_s": 0.9400, "t_threshold_s": 6.4933, "fraction_at_timer": 0.93002 }
  }
}
```

A `printed` entry may carry its own `tolerance_s`, which overrides the
request-level `tolerance_s` for that entry only (RC1 prints 6.49 s to two
decimals, so it is checked at 0.005 s).

Checks, one per `(printed, against)` pair, named `<printed.label>_matches_<cap.label>`:

| name | pass |
|---|---|
| `printed_2.435_matches_680uF_text` | false |
| `printed_2.435_matches_750uF_diagram` | true |
| `printed_6.91_matches_2mF_example` | false |

Plus one check per capacitance named `<cap.label>_reaches_threshold_by_timer`
with `pass = fraction_at_timer >= threshold`. Expected: 680 and 750 pass, 820
and 2 mF fail.

Numbers above were computed independently and are the acceptance values for
the checker's own tests. Print with at least 4 decimal places.

## Checker `route` (Scenario B, stretch)

Model: `E_kWh = (m * g * Crr + 0.5 * rho * CdA * v^2) * d / 3.6e6` with
`g = 9.81`, `rho = 1.20` (both overridable). `budget_kWh = (soc_start - soc_end) * pack_kWh`.
`feasible = E_kWh <= budget_kWh`. `v_max_mps` is the largest constant speed
that fits the budget (bisection, 80 iterations).

Inputs (`contracts/examples/checker-route-request.json`):

```json
{
  "mass_kg": 318,
  "Crr": 0.0048,
  "CdA": 0.12,
  "rho": 1.2,
  "v_mps": 22,
  "d_m": 220000,
  "pack_kWh": 5.2,
  "soc_start": 0.96,
  "soc_end": 0.40,
  "alternative_mass_kg": [310]
}
```

`alternative_mass_kg` is optional. Each entry is evaluated as its own case in
the same run, so RC2 gets both masses from one execution. Cases are keyed
`mass_<m>kg`; `outputs.primary` names the case built from `mass_kg`.

Outputs (`contracts/examples/checker-route-response.json`):

```json
{
  "budget_kWh": 2.912,
  "primary": "mass_318kg",
  "cases": {
    "mass_318kg": { "mass_kg": 318, "rolling_N": 14.974, "aero_N": 34.848, "total_N": 49.822, "energy_kWh": 3.0447, "budget_kWh": 2.912, "feasible": false, "v_max_mps": 21.3037 },
    "mass_310kg": { "mass_kg": 310, "rolling_N": 14.5973, "aero_N": 34.848, "total_N": 49.4453, "energy_kWh": 3.0217, "budget_kWh": 2.912, "feasible": false, "v_max_mps": 21.4261 }
  }
}
```

One check per case named `<case>_feasible` with `pass = feasible`,
`expected = budget_kWh`, `actual = energy_kWh`.

Acceptance values are in `research/synthetic-fixture-spec.md`, Scenario B
table: v2-0 (290 kg, Crr 0.0040) gives 2.8250 kWh, feasible at a 2.912 kWh
budget; v2-1 (318 kg, Crr 0.0048) gives 3.0447 kWh, not feasible; at
`soc_end = 0.35` the budget is 3.172 kWh and v2-1 is feasible.
