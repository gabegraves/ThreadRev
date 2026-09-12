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
`g = 9.81`, `rho = 1.20`. Inputs: `mass_kg`, `Crr`, `CdA`, `v_mps`, `d_m`,
`pack_kWh`, `soc_start`, `soc_end`, optional list of alternative `mass_kg`
values for RC2. Outputs per input set: rolling N, aero N, total N, energy kWh,
budget kWh, `feasible`. Acceptance values are in
`research/synthetic-fixture-spec.md`, Scenario B table (2.825 and 3.045 kWh
against a 2.912 kWh budget).
