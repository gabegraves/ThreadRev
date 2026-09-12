# Synthetic fixtures (W1)

Everything here is fictional. Team: Kestrel Solar Racing (KSR) at the Halvern Institute of Technology, workspace `kestrel-solar.slack.example`. Slack IDs use the `U00SYN` / `C00SYN` prefix only. The single source for every name, number, timestamp, and message is `research/synthetic-fixture-spec.md`. If a value here disagrees with the spec, the spec wins and this directory is wrong.

Regenerate the documents with `python3 fixtures/generate.py` (needs python-docx and openpyxl), then `shasum -a 256 fixtures/documents/* > fixtures/SHA256SUMS` from the repo root. Output is byte-for-byte reproducible.

## documents/

| File | Scenario / replay case | Contents |
|---|---|---|
| `precharge-review-r2.docx` | Scenario A (P7), attached to Dara's seed message `1787062320.000100` | Five sections exactly as spec section 4 states them. Two planted errors: section 2 caption says 750 uF while section 3 text says 680 uF and the printed `t_99.9 = 2.435 s` reproduces only with 750 uF; section 4 prints `t = 6.91 s` for a 2 mF bank (correct value 6.493 s). |
| `precharge-review-r2-clean.docx` | RC1 clean control, attached to the same seed message in `slack/rc1-clean.json` | Same document with the three RC1 corrections: section 2 caption `680 uF`, section 3 printed `2.208 s`, section 4 printed `6.49 s`. Everything else is identical. |
| `ks4-sim-inputs-v2-0.xlsx` | Scenario B (P5), RC2, RC3. July 3 workbook, attached to Milo's first message | Sheet `params`, header in row 1, rows 2 to 5: `mass_kg 290`, `Crr 0.0040`, `CdA 0.12`, `pack_kWh 5.2`. |
| `ks4-sim-inputs-v2-1.xlsx` | Scenario B (P5), RC2, RC3. July 24 workbook, attached to Milo's correction `1784929680.000300` | Sheet `params`, rows 2 to 5: `mass_kg 318`, `Crr 0.0048`, `CdA 0.12`, `pack_kWh 5.2`. Cell A8: `mass and Crr updated after KS-4 suspension swap, see #ks4-suspension 2026-07-22.` |

`ks4-hv-interface-req-r1.xlsx` (optional in the brief) is not generated. The spec gives it no cell values, so anything written would be invented rather than sourced.

Scenario A model: first-order ideal RC, `t_99.9 = R * C * 6.907755`. Scenario B model: the toy closed form `E = (m * g * Crr + 0.5 * rho * CdA * v^2) * d` with `g = 9.81`, `rho = 1.20`, `CdA = 0.12`, `d = 220 km`, array input assumed zero. Neither is real simulation code.

## slack/

One JSON array per file, one object per message, in `ts` order. Fields: `ts`, `channel`, `channel_name`, `user`, `user_name`, `thread_ts` (parent `ts` for replies, else `null`), `text`, `files` (paths relative to `fixtures/`), `role`.

`role` values: `seed` (corpus before the trigger), `trigger` (the `@reviewer` request the harness replays), `change` (requirement-change message that must invalidate the live card), `evaluator_only` (after the replay cutoff, visible to the scorer only).

Optional `edit_of: "<ts>"` marks a message as a Slack `message_changed` edit of the earlier message with that `ts`. The edit keeps its own `ts` (later than the original), its own `text`, and its own `role`. The replay loader emits it as a new revision of the original: same `logicalMessageId`, new `revisionId`, and both entries stay in the transcript in `ts` order, which is how a thread reads after an edit. `edit_of` must name a `ts` present in the same file; an edit of an edit resolves to the root message. Use it for adversarial cases where a requirement changes by editing an earlier message instead of posting a new one.

Timestamps are workspace-local UTC-5 converted to epoch seconds. The four `ts` values the spec cites are used verbatim (`.000100`, `.000200`, `.000300`, `.000400`). Messages the spec does not cite by `ts` use the same epoch convention with sequence suffixes `.000500` onward so no two messages collide.

| File | Scenario / replay case | Channel | Messages | Cutoff and notes |
|---|---|---|---|---|
| `scenario-a.json` | Scenario A demo, full script | `#ks4-electrical` C00SYN01 | Dara seed with `precharge-review-r2.docx`, Tam thread reply, Juno trigger, Dara 820 uF change | Trigger at 2026-08-19 14:05. Change at 15:30 (`1787171400.000200`) marks the r2 card stale and drives the 820 uF recompute. All replies thread under `1787062320.000100`. |
| `scenario-a-cross.json` | Scenario A, cross-channel | `#ks4-electrical` C00SYN01 | Dara seed with `precharge-review-r2.docx`, Tam reply, Juno trigger. No change message in the thread. | The 820 uF correction is Dara's 2026-08-05 message in `#ks4-purchasing` inside `workspace/kestrel-workspace.json` (`1785946800.000501`). The reviewer must find it with `search_workspace`. Expected: one card, four printed comparisons (680 no, 750 yes, 820 no, 2 mF no), question to Dara, purchasing message cited by ts. |
| `scenario-b.json` | Scenario B demo, full script | `#ks4-strategy-sim` C00SYN02 | Milo v2-0 seed, Milo v2-1 seed (`1784929680.000300`), Ines confirmation threaded under it, Juno trigger, Milo 35 percent change threaded under the trigger | Trigger at 2026-08-11 13:15. Change at 14:02 stales the 40 percent card. |
| `rc1-clean.json` | RC1 clean control | `#ks4-electrical` | Same seed and Tam reply, but the attachment is `precharge-review-r2-clean.docx`. Same Juno trigger | Cutoff at the trigger. Expected `discrepancy: none`. No change message is included. |
| `rc2-conflict.json` | RC2 conflicting evidence | `#ks4-strategy-sim` | Scenario B corpus plus Milo 2026-07-30 11:00 "v2-1 mass may be 8 kg high" (`1785427200.001000`), Juno trigger, then the 35 percent change as `evaluator_only` | Cutoff at the August 11 trigger. No re-weigh message exists before the cutoff. Reviewer must compute 310 and 318 kg and ask Milo, not choose. |
| `rc3-midrun.json` | RC3 mid-run revision | `#ks4-strategy-sim` | Same messages as `scenario-b.json` | The harness injects the `change` message (`1786474920.000900`) between the reviewer's checker start and its `publish_result` call, and exposes it as `current_requirements_revision`. Expected: one stale record preserved, one live card bound to `1786474920.000900`. |

## workspace/

`kestrel-workspace.json` is a Slack export of the whole workspace in the same message shape: 39 messages, five channels (`#ks4-electrical`, `#ks4-strategy-sim`, `#ks4-suspension`, `#ks4-purchasing`, `#ks4-firmware`), March 2 to August 21, 2026. Generated by `python3 fixtures/generate_workspace.py` (stdlib only, reproducible). It is what `search_workspace` indexes; `WORKSPACE_EXPORT` in the environment points the tool at a different export.

The corpus contains the Scenario A thread up to Juno's trigger, Dara's 820 uF snubber-bank correction in `#ks4-purchasing` two weeks before r2, Tam's relay timer change from 2.0 s to 2.5 s in `#ks4-firmware` in May, the Scenario B v2-0 and v2-1 messages, and two messages after the trigger (`role: evaluator_only`) that `search_workspace` must never return for the r2 trigger. Everything else is filler across months so a search by unit has something to sift.

## SHA256SUMS

`shasum -a 256` of every file under `documents/`, paths relative to the repo root. Cards bind to these values. Verify with `shasum -a 256 -c fixtures/SHA256SUMS` from the repo root.
