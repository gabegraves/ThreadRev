# Synthetic engineering Slack fixture specification

Drafted September 12, 2026. Fully fictional. Every name, ID, channel, company, vehicle, document, quote, and number below is invented for a public hackathon demo. Only failure patterns and document types were derived from the private source research; no message text, identifier, part number, supplier, or document content was copied. Safe to publish in a public repo and video.

Companion to [hackathon-design.md](hackathon-design.md). The reviewer under test is the Slack-native engineering change reviewer described there: `Slack revision -> source evidence -> proposed inputs -> isolated computation -> trusted checks -> revision-bound Slack card`.

## 1. Failure pattern catalog

Each pattern: trigger message shape, evidence the reviewer must find, correct finding, and correct non-finding (a near-identical case where the reviewer must stay silent). Silence on the non-finding is scored; a reviewer that flags everything fails the control.

### P1. Interface value drift between code and hardware

- Trigger: "display shows the wrong indicator, decoder was written from the server docs, please investigate."
- Evidence: a decoder table in one document and a captured frame log in another; the two disagree on byte values for the same message ID.
- Finding: list each state where table and capture differ, keep unknown states explicitly unknown, propose a patch limited to the mismatched states.
- Non-finding: table and capture agree, a single frame is malformed. Do not propose changing the decoder for one corrupted sample.

### P2. Existing hardware or design is rebought or redesigned because the assignee changed

- Trigger: a new member posts "I'll order switches and start a new board for the parking-brake input."
- Evidence: an earlier design note in the same channel saying working hardware, fabrication files, and switches already exist, plus an unresolved blocker (analog filtering).
- Finding: point to the existing hardware, list what is actually still open, mark the end-to-end alert as unverified.
- Non-finding: the earlier note says the board was scrapped and the switches were consumed. A new order is correct; stay silent.

### P3. Research from an earlier period is re-done instead of retrieved

- Trigger: "supplier says the shock is backordered, what are our options?"
- Evidence: a thread two months earlier listing candidate alternatives, plus a crosspost from another channel with even older candidates.
- Finding: return the earlier candidates with their source dates, distinguish "candidate" from "verified fit", and state that availability on the earlier date is not stock today.
- Non-finding: the earlier research was for a different vehicle generation with different mounting length. Say so, do not present it as reusable without a fit check.

### P4. Two artifact revisions disagree on a dimension

- Trigger: "the bracket has two holes 3.2 mm apart, which one matches the analyzed design?"
- Evidence: a flat-pattern file referencing revision v4, a CAD path, and an FEA summary referencing revision v3. The hole offset in the drawing is stated in inches, the FEA in mm.
- Finding: convert units correctly (0.125 in = 3.175 mm), state which revision each artifact belongs to, and refuse to authorize machining until the lineage is resolved. A teammate's uncertain reply is an answer candidate, not ground truth.
- Non-finding: all three artifacts carry the same revision tag and the same hole position. Stay silent.

### P5. Correction stated earlier in a thread is ignored by a later request

- Trigger: "please run the route from A to B, start SoC X, end SoC Y, with N stops" that names, or silently assumes, an inputs file.
- Evidence: a diagnosis message days earlier stating the previous run used the wrong vehicle model and naming the corrected inputs file.
- Finding: block the run on the stale inputs, name the corrected file and its message permalink, verify the swap count and route endpoints in the request are carried into the run, record units and timezone.
- Non-finding: the request already names the corrected file and its hash. Run it, no flag.

### P6. Quoted, paid, ordered, shipped, and received are conflated

- Trigger: "critical items list for the validation drive, what is on the way?"
- Evidence: a purchasing thread with a quote, an invoice with payment pending, a ship date after the need-by date, and a second item shown available on a website but unavailable until a later month.
- Finding: keep the five states separate per item, flag any ship date after the need-by date, ask for a matching-spec alternative, and never mark received without a receipt message.
- Non-finding: an item has a receipt message with a photo. Marking it received is correct.

### P7. Calculation in a document does not match its own stated inputs

- Trigger: "design review for the precharge board, please check section 3."
- Evidence: the document states one capacitance in text, a different one in its diagram, and prints a result that only matches the diagram value.
- Finding: reproduce the arithmetic from each stated input, report which input the printed result corresponds to, and ask which value is authoritative. Do not pick one.
- Non-finding: text, diagram, and printed result all agree within rounding. Stay silent even if the reviewer would have chosen different component values.

## 2. Document type inventory

Observed in the source research (types only):

| Type | Observed role | Synthesize today? |
|---|---|---|
| Design review document (DOCX) with RC arithmetic | P7 | Yes, Scenario A |
| Simulation inputs workbook (XLSX, versioned v1-0, v1-1) | P5 | Yes, Scenario B |
| Vehicle parameter / weight breakdown spreadsheet (XLSX) | P5 lineage | Yes, folded into the Scenario B workbook |
| Interface requirements sheet (XLSX) | P1, P4 | Yes, small, used by the requirement-change step |
| Structural design criteria sheet (XLSX) | P4 | No |
| Budget request / bill-of-materials spreadsheet (XLSX) | P6 | No |
| Supplier correspondence PDF, supplier drawing PDF | P3, P6 | No |
| System briefing / diagnosis plan (DOCX) | P2 | No |
| Design-criteria story deck (PPTX) | context | No |
| Waterjet DXF / CAD ZIP / STEP references | P4 | No, reference by filename only |
| Test drive data, sensor CSV | context | No |
| Firmware decoder table + frame capture (text) | P1 | No |

Four to synthesize: `precharge-review-r2.docx` (or markdown rendering of it), `ks4-sim-inputs-v2-0.xlsx`, `ks4-sim-inputs-v2-1.xlsx`, `ks4-hv-interface-req.xlsx`. CSV renderings of each XLSX are acceptable for the checker.

## 3. Fictional team

- Company: Kestrel Motors, a fictional maker of light electric city vehicles.
- Vehicles: KS-3 (previous platform, shipped 2025), KS-4 (current platform, in development). Both are light electric city vehicles, which is why the pack is 5.2 kWh, the HV bus is 120 V, and the curb mass is around 300 kg.
- Workspace: `kestrel-motors.slack.example`. Slack IDs use the synthetic prefix `U00SYN` / `C00SYN` so they cannot collide with real IDs.

Channels:

| Channel | ID | Purpose |
|---|---|---|
| `#ks4-electrical` | C00SYN01 | HV, precharge, BMS interface |
| `#ks4-strategy-sim` | C00SYN02 | route simulation, energy strategy |
| `#ks4-suspension` | C00SYN03 | mechanical, brackets, shocks |
| `#ks4-purchasing` | C00SYN04 | quotes, orders, budget |
| `#ks4-firmware` | C00SYN05 | CAN, display, GPIO |

Engineers:

| Handle | ID | Role |
|---|---|---|
| Dara Voss | U00SYN01 | Electrical lead, owns precharge board |
| Milo Trent | U00SYN02 | Strategy and simulation lead |
| Ines Calder | U00SYN03 | Suspension lead |
| Rowan Pike | U00SYN04 | Business and purchasing |
| Tam Holloway | U00SYN05 | Firmware |
| Juno Marsh | U00SYN06 | New member, joined August, posts most trigger requests |
| Reviewer bot | U00SYNBOT | The reviewer under test |

## 4. Demo scenarios

Timestamps are workspace-local (UTC-5). Each message has a synthetic `ts` for cutoff ordering. Message text is the fixture; do not paraphrase it in the corpus.

### Scenario A: precharge RC timing, document result disagrees with its inputs (P7), then capacitance changes

Channel `#ks4-electrical`. Model: first-order ideal RC, time to 99.9 percent, `t = -R * C * ln(0.001) = R * C * 6.907755`.

Attached document `precharge-review-r2.docx` (revision r2, sha256 recorded at publish):

- Section 1: "HV bus nominal 120 V. Precharge resistor R = 470 ohm, 10 W."
- Section 2, diagram caption: "Bus capacitance C = 750 uF (3 x 250 uF film)."
- Section 3, text: "Actual bus capacitance is 680 uF after the third film cap was dropped in r2."
- Section 3, calculation: "t_99.9 = -470 * 750e-6 * ln(0.001) = 2.435 s. Precharge relay closes at 2.5 s, margin OK."
- Section 4, worked example: "For a 2 mF test bank, t = 6.91 s." (Correct: 470 * 2e-3 * 6.907755 = 6.493 s. This line is a second, independent error. Include it so the reviewer must check every printed result, not just the highlighted one.)
- Section 5: "Peak inrush I = 120 / 470 = 0.255 A. Stored energy at 680 uF: 4.896 J."

Correct arithmetic:

| C | R*C | t_99.9 |
|---|---|---|
| 680 uF (text) | 0.3196 s | 2.2077 s |
| 750 uF (diagram) | 0.3525 s | 2.4350 s |
| 820 uF (later change) | 0.3854 s | 2.6622 s |
| 2 mF (example) | 0.940 s | 6.4933 s |

Script:

```
2026-08-18 09:12  Dara Voss    #ks4-electrical
  Precharge board r2 review doc is up. Dropped one film cap, bus is now 680 uF.
  [attachment: precharge-review-r2.docx]
2026-08-18 09:40  Tam Holloway (thread)
  Relay close timer in firmware is 2.5 s, matches the doc.
2026-08-19 14:05  Juno Marsh (thread)   <-- TRIGGER
  @reviewer can you check section 3 of the r2 doc before I sign the review?
```

Expected finding card (posted in thread, bound to r2 sha256):

- Discrepancy: text states C = 680 uF, diagram states 750 uF, printed t_99.9 = 2.435 s reproduces only with 750 uF. With 680 uF, t_99.9 = 2.208 s. Section 4 example prints 6.91 s, reproduced value 6.493 s.
- Why it matters: relay close at 2.5 s has 65 ms margin against 750 uF and 292 ms against 680 uF. Margin sign does not change here, but the document's stated basis is not the number it computed from, so the review cannot be signed against it.
- Sources and versions: `precharge-review-r2.docx` sha256 `<recorded>`, section 2 caption, section 3 line 2, section 4; message ts 1787062320.000100 (Dara, "bus is now 680 uF").
- Reproduced vs inferred: t values are reproduced by `check_rc.py` (stdlib, run id recorded). Which capacitance is authoritative is not inferred; it is asked.
- What resolves it: Dara confirms 680 or 750 uF and updates the diagram or the text. Section 4 needs a corrected printed value regardless.

Requirement-change message:

```
2026-08-19 15:30  Dara Voss (thread)
  Correction: we are adding a 140 uF snubber bank on the motor controller side. Bus is 820 uF, not 680. Doc will be r3.
```

Expected invalidation: the r2 card is marked stale within the same thread, not deleted. Recomputed result: C = 820 uF, t_99.9 = 2.662 s, which exceeds the 2.5 s relay close timer by 162 ms. New card: "Relay close timer 2.5 s is earlier than t_99.9 = 2.662 s at 820 uF. Bus reaches 99.85 percent at 2.5 s (1 - exp(-2.5 / 0.3854) = 0.99848), short of the 99.9 percent criterion. Firmware timer or resistor value must change. Sources: Dara ts 1787171400.000200, r2 doc for R." The card states that r3 does not exist yet and binds to the message, not to a document.

Checker contract for A (`check_rc.py`, stdlib only): inputs R, C list, timer; outputs t_99.9 per C, fraction charged at timer, and `printed_matches` booleans with tolerance 0.0005 s. Expected: `printed_2.435_matches_680 = False`, `printed_2.435_matches_750 = True`, `printed_6.91_matches_2mF = False`.

### Scenario B: simulation stale inputs, July correction ignored by August request (P5)

Channel `#ks4-strategy-sim`. Simple constant-speed energy model, no regen or auxiliary load (stated assumption): `E = (m * g * Crr + 0.5 * rho * CdA * v^2) * d`, g = 9.81, rho = 1.20 kg/m^3, CdA = 0.12 m^2, d = 220 km, pack 5.2 kWh usable.

Attached workbooks:

- `ks4-sim-inputs-v2-0.xlsx` (July 3): mass 290 kg, Crr 0.0040, CdA 0.12, pack 5.2 kWh. Sheet `params`, rows 2 to 5.
- `ks4-sim-inputs-v2-1.xlsx` (July 24): mass 318 kg, Crr 0.0048, CdA 0.12, pack 5.2 kWh. Change note cell A8: "mass and Crr updated after KS-4 suspension swap, see #ks4-suspension 2026-07-22."

Correct arithmetic at v = 22 m/s (79.2 km/h), d = 220 km:

| Inputs | Rolling N | Aero N | Total N | Energy kWh |
|---|---|---|---|---|
| v2-0 | 11.380 | 34.848 | 46.228 | 2.8250 |
| v2-1 | 14.974 | 34.848 | 49.822 | 3.0447 |

Budget for SoC 96 to 40 percent: 0.56 * 5.2 = 2.912 kWh. v2-0 says 22 m/s is feasible (2.825 < 2.912). v2-1 says it is not (3.045 > 2.912). Max feasible speed under v2-1 at that budget: 21.30 m/s (76.7 km/h). Under v2-0: 22.45 m/s. Driving time at 22 m/s: 2.778 h, plus 40 min of stops = 3.44 h wall time.

Script:

```
2026-07-03 10:20  Milo Trent   #ks4-strategy-sim
  Sim inputs v2-0 posted for the summer runs. [attachment: ks4-sim-inputs-v2-0.xlsx]
2026-07-24 16:48  Milo Trent
  Found why last week's numbers looked optimistic: we were still on KS-3 mass and Crr.
  v2-1 has the post-suspension values (318 kg, Crr 0.0048). Use v2-1 for anything after today.
  [attachment: ks4-sim-inputs-v2-1.xlsx]
2026-07-24 17:02  Ines Calder (thread)
  Confirmed, corner weights from Tuesday add up to 318 with driver.
2026-08-11 13:15  Juno Marsh   <-- TRIGGER
  @reviewer run the Northgate to Ferris segment (220 km, no optional loop), start SoC 96%,
  end SoC 40%, two 20-minute stops, 22 m/s constant. I grabbed the params from the
  July 3 sheet.
```

Expected finding card:

- Discrepancy: request uses v2-0 (July 3); v2-1 (July 24) supersedes it per Milo's message and Ines's confirmation. Under v2-0 the segment is feasible at 22 m/s (2.825 kWh vs 2.912 budget); under v2-1 it is not (3.045 kWh). Conclusion flips.
- Why it matters: a feasibility answer posted from v2-0 would be wrong by 0.22 kWh and 4 percent of pack.
- Sources and versions: v2-0 sha256, v2-1 sha256, message ts 1784929680.000300 (Milo, "use v2-1"), ts 1784930520.000400 (Ines).
- Reproduced vs inferred: both energies reproduced by `check_route.py`. Whether the optional loop is excluded and whether 2 x 20 min stops are the full stop budget is taken from the request text, not inferred. Regen is assumed zero and labeled as such.
- What resolves it: Juno confirms v2-1, or Milo states v2-0 is intentionally being used for a KS-3 comparison. The reviewer posts the v2-1 result but labels the run as blocked on that confirmation rather than final.

Requirement-change message:

```
2026-08-11 14:02  Milo Trent (thread)
  Test lead allows end SoC 35% for this segment now, not 40%.
```

Expected invalidation: the 13:15 card is stale. Recomputed budget 0.61 * 5.2 = 3.172 kWh. Under v2-1, 22 m/s is feasible (3.045 < 3.172), max speed 22.65 m/s. Under v2-0 still feasible. New card states the conclusion no longer flips between input versions at 22 m/s, but still binds to v2-1 and still carries the stop and loop assumptions.

Checker contract for B (`check_route.py`, stdlib only): inputs m, Crr, CdA, rho, v, d, pack, soc_start, soc_end; outputs energy_kWh, budget_kWh, feasible, v_max (bisection, 80 iterations). Expected: `(v2-0, 40%) feasible=True`, `(v2-1, 40%) feasible=False`, `(v2-1, 35%) feasible=True`.

## 5. Replay cases for the scorecard

Each case has a cutoff, a trigger, an expected reviewer output, and a pass rule. Later messages belong to the evaluator.

### RC1. Clean control (no finding)

- Fixture: Scenario A document with section 2 caption corrected to 680 uF, section 3 printed 2.208 s, section 4 printed 6.49 s. Same trigger message from Juno.
- Expected: reviewer runs the checker, posts a card with `discrepancy: none`, all three printed values reproduced within tolerance, sources listed.
- Pass rule: no discrepancy claimed, no request to change component values, checker run id present. Any suggestion that 470 ohm "should be" a different value fails the control.

### RC2. Conflicting evidence (reviewer must ask, not decide)

- Fixture: Scenario B corpus plus one extra message at 2026-07-30 11:00 from Milo: "v2-1 mass may be 8 kg high, the ballast was on the scale. Re-weigh pending." No re-weigh message exists before the August 11 cutoff.
- Expected: reviewer reports v2-1 as the latest named inputs, reports the unresolved mass uncertainty (310 vs 318 kg), computes both (310 kg: rolling 14.597 N, total 49.445 N, 3.0217 kWh, still infeasible at 40 percent), and asks Milo for the re-weigh. It does not choose 310 or 318 as authoritative.
- Pass rule: both values computed, neither declared final, one explicit question naming who can resolve it. Declaring either mass as correct fails.

### RC3. Mid-run revision (result stale before posting)

- Fixture: Scenario B. The requirement-change message (end SoC 35 percent) is injected with ts between the reviewer's checker start and its publish call. Harness exposes `current_requirements_revision` to `publish_result`.
- Expected: `publish_result` refuses the 40 percent card, the reviewer records the run as stale with its inputs and outputs preserved, then reruns at 35 percent and posts one card bound to the new revision.
- Pass rule: exactly one live card, one preserved stale record with original run id, and the live card's revision matches the 14:02 message. Overwriting or deleting the stale record fails.

## 6. What not to synthesize

- No real person names, Slack handles, user IDs, channel IDs, permalinks, or workspace domains from the source research. Synthetic IDs use the `U00SYN` / `C00SYN` prefix only.
- No real company, vehicle, or test route names. No real route city pairs.
- No real supplier names, quote amounts, invoice numbers, or ship dates.
- No part numbers, board revision labels, capacitance or resistance values, CAN IDs, or byte values copied from the source. Scenario A deliberately uses 470 ohm and 680 / 750 / 820 uF, which do not appear in the source.
- No quoted or paraphrased message text from the source archives. All fixture messages are written fresh.
- No real document titles, Google Doc IDs, sha256 values, or file paths from the source export.
- No credentials, API keys, or webhook URLs anywhere in the fixture, including in example config.
- No real simulation code, route files, or weather data. The energy model is the toy closed form above and is labeled as such in the corpus.
