#!/usr/bin/env python3
"""Generate fixtures/workspace/kestrel-workspace.json: a multi-channel,
multi-month Slack export for the Kestrel Motors workspace.

Same message shape as fixtures/slack/*.json. Everything is fictional and
consistent with research/synthetic-fixture-spec.md (cast, channels, numbers).
Stdlib only, byte-for-byte reproducible:

    python3 fixtures/generate_workspace.py

The corpus exists so search_workspace has something to search. The review
thread in #ks4-electrical is the Scenario A thread up to Juno's trigger, but
Dara's 820 uF correction was posted two weeks earlier in #ks4-purchasing, not
in the thread. The r2 document ignores it. Messages after the trigger exist so
the cutoff can be tested: search_workspace must not return them.
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

TZ = timezone(timedelta(hours=-5))
CH = {
    "electrical": ("C00SYN01", "ks4-electrical"),
    "sim": ("C00SYN02", "ks4-strategy-sim"),
    "suspension": ("C00SYN03", "ks4-suspension"),
    "purchasing": ("C00SYN04", "ks4-purchasing"),
    "firmware": ("C00SYN05", "ks4-firmware"),
}
U = {
    "dara": ("U00SYN01", "Dara Voss"),
    "milo": ("U00SYN02", "Milo Trent"),
    "ines": ("U00SYN03", "Ines Calder"),
    "rowan": ("U00SYN04", "Rowan Pike"),
    "tam": ("U00SYN05", "Tam Holloway"),
    "juno": ("U00SYN06", "Juno Marsh"),
}

_seq = {}


def ts(when: str, seq: int | None = None) -> str:
    """'2026-08-18 09:12' -> Slack ts. Fixed seq for spec-cited messages."""
    t = datetime.strptime(when, "%Y-%m-%d %H:%M").replace(tzinfo=TZ)
    sec = int(t.timestamp())
    if seq is None:
        _seq[sec] = _seq.get(sec, 0) + 1
        seq = 500 + _seq[sec]
    return f"{sec}.{seq:06d}"


def m(when, ch, who, text, *, thread=None, files=(), role="seed", seq=None):
    cid, cname = CH[ch]
    uid, uname = U[who]
    return {
        "ts": ts(when, seq),
        "channel": cid,
        "channel_name": cname,
        "user": uid,
        "user_name": uname,
        "thread_ts": thread,
        "text": text,
        "files": list(files),
        "role": role,
    }


msgs = []
A = msgs.append

# --- March: season kickoff -------------------------------------------------
A(m("2026-03-02 09:05", "electrical", "dara", "KS-4 HV architecture kickoff. Bus nominal 120 V, precharge through a 470 ohm 10 W resistor. Draft schematic by Friday."))
A(m("2026-03-02 09:30", "purchasing", "rowan", "Budget for spring is 18,400 USD. Post quotes here before ordering anything over 200 USD."))
A(m("2026-03-04 14:10", "firmware", "tam", "CAN ids for KS-4 are in the wiki. BMS on 0x100 to 0x11F, motor controller 0x200 to 0x21F."))
A(m("2026-03-09 11:00", "sim", "milo", "Route sim v1-0 is up. Mass 280 kg placeholder until the chassis is weighed, Crr 0.0040 from the KS-3 tires."))
A(m("2026-03-16 16:45", "suspension", "ines", "Front bracket rev A drawings posted. Shock travel 45 mm."))
A(m("2026-03-18 12:20", "electrical", "tam", "Lunch at 12:30? I'll grab the 470 ohm resistors from the stockroom on the way."))

# --- April: HV bus sizing ----------------------------------------------------
A(m("2026-04-06 10:15", "electrical", "dara", "Bus capacitance for KS-4: three 250 uF film caps, 750 uF total. Precharge to 99.9 percent needs t = R * C * 6.907755 = 2.435 s at 470 ohm."))
A(m("2026-04-06 10:40", "firmware", "tam", "Precharge relay timer in firmware set to 2.0 s for bench testing. Will bump to match Dara's number once the bus is final."))
A(m("2026-04-08 09:00", "purchasing", "dara", "Quote for 3 x 250 uF 450 V film caps: 312 USD from Arlen Components. OK to order?"))
A(m("2026-04-08 09:25", "purchasing", "rowan", "Approved, PO-2207."))
A(m("2026-04-14 15:30", "sim", "milo", "Sim v1-1: added the HVAC load model. Segment energy at 22 m/s is 3.9 kWh on the 220 km segment, mass still 280 kg."))
A(m("2026-04-22 11:10", "suspension", "ines", "Bracket rev B. Moved the lower mount 6 mm inboard for tire clearance."))

# --- May: firmware timer, first precharge review ----------------------------
A(m("2026-05-05 13:00", "firmware", "tam", "Changed the precharge relay timer from 2.0 s to 2.5 s. Gives 65 ms margin over the 2.435 s number at 750 uF."))
A(m("2026-05-05 13:12", "firmware", "dara", "Good. Keep 2.5 s until the bus changes."))
A(m("2026-05-12 10:00", "electrical", "dara", "Precharge review doc r1 posted. Bus 750 uF, R 470 ohm, t_99.9 2.435 s.", files=["documents/precharge-review-r1.docx"]))
A(m("2026-05-12 10:45", "electrical", "juno", "Reading r1 now. Is the 2 mF test bank example still in section 4?", thread=None))
A(m("2026-05-19 09:30", "purchasing", "rowan", "Reminder: spring budget has 6,100 USD left. Motor controller deposit is due June 1."))
A(m("2026-05-26 17:05", "sim", "milo", "Sim v1-2. Nothing changed in inputs, fixed the SoC clamp bug."))

# --- June: chassis weighed, suspension swap planned --------------------------
A(m("2026-06-03 11:00", "suspension", "ines", "Chassis on the scale: 271 kg dry without driver. Suspension swap to the KS-4 arms is scheduled for July 20 to 22."))
A(m("2026-06-03 11:20", "sim", "milo", "Updating sim mass to 290 kg (271 dry plus ballast allowance) for v2-0. Crr stays 0.0040 until the swap."))
A(m("2026-06-10 14:40", "firmware", "tam", "Display firmware 0.4.1 flashed. GPIO map unchanged."))
A(m("2026-06-17 09:10", "electrical", "dara", "Standup: HV harness routing done, BMS interface doc next week."))
A(m("2026-06-24 16:00", "purchasing", "rowan", "Summer budget approved: 9,800 USD."))

# --- July: sim inputs v2-0 and v2-1 (Scenario B world, same numbers) --------
A(m("2026-07-03 10:20", "sim", "milo", "Sim inputs v2-0 posted. mass 290 kg, Crr 0.0040, CdA 0.12, pack 5.2 kWh.", files=["documents/ks4-sim-inputs-v2-0.xlsx"]))
A(m("2026-07-22 15:30", "suspension", "ines", "Suspension swap done. Corner weights Tuesday: 318 kg with driver. New tires measure Crr 0.0048 on the drum."))
A(m("2026-07-24 09:48", "sim", "milo", "Correction: sim inputs v2-1 posted. mass 318 kg, Crr 0.0048 after the KS-4 suspension swap. Use v2-1 for anything after today.", files=["documents/ks4-sim-inputs-v2-1.xlsx"]))
A(m("2026-07-24 10:05", "sim", "ines", "Confirmed, corner weights from Tuesday add up to 318 with driver."))
A(m("2026-07-30 11:00", "sim", "milo", "v2-1 mass may be 8 kg high, the ballast was on the scale. Re-weigh pending."))

# --- August: the cross-channel correction, then the r2 thread ----------------
A(m("2026-08-03 10:30", "firmware", "tam", "Motor controller firmware 2.3 has the regen ramp. Needs the snubber bank Dara mentioned before we enable it."))
A(m("2026-08-05 11:20", "purchasing", "dara", "Rowan, please add a 140 uF snubber bank on the motor controller side to the August order. With it the HV bus is 820 uF, not 680. I will fold it into the precharge doc."))
A(m("2026-08-05 11:34", "purchasing", "rowan", "Added. PO-2261, 2 x 70 uF film. Ships in 10 days."))
A(m("2026-08-05 11:40", "purchasing", "dara", "Thanks. That is the last HV order before the review."))
A(m("2026-08-11 13:15", "sim", "juno", "@Rev can you run the 220 km segment at 22 m/s for end SoC 40 percent? I grabbed the params from the July 3 sheet."))
A(m("2026-08-12 09:00", "suspension", "ines", "Rear bracket rev C released. No mass change."))
# Scenario A thread, up to the trigger. Spec-cited ts values verbatim.
A(m("2026-08-18 09:12", "electrical", "dara", "Precharge board r2 review doc is up. Dropped one film cap, bus is now 680 uF.", files=["documents/precharge-review-r2.docx"], seq=100))
A(m("2026-08-18 09:40", "electrical", "tam", "Relay close timer in firmware is 2.5 s, matches the doc.", thread="1787062320.000100", seq=500))
A(m("2026-08-19 14:05", "electrical", "juno", "@Rev can you check section 3 of the r2 doc before I sign the review?", thread="1787062320.000100", role="trigger", seq=600))
# After the cutoff. search_workspace must never return these for the r2 trigger.
A(m("2026-08-20 10:00", "purchasing", "rowan", "PO-2261 snubber bank delivered, 2 x 70 uF. Dara has them.", role="evaluator_only"))
A(m("2026-08-21 09:15", "electrical", "dara", "r3 will state 820 uF. Drafting it now.", role="evaluator_only"))

msgs.sort(key=lambda x: (int(x["ts"].split(".")[0]), int(x["ts"].split(".")[1])))
seen = set()
for x in msgs:
    assert x["ts"] not in seen, f"duplicate ts {x['ts']}"
    seen.add(x["ts"])

out = Path(__file__).resolve().parent / "workspace" / "kestrel-workspace.json"
# Explicit encoding and newline. write_text otherwise uses the platform's
# locale encoding — cp1252 on Windows, which cannot carry Ω — and translates
# "\n" into "\r\n", so the same script produced different bytes per platform
# and README.md's byte-for-byte reproducibility held only on macOS.
out.write_text(json.dumps(msgs, indent=2) + "\n", encoding="utf-8", newline="\n")
print(f"{out.relative_to(Path.cwd())}: {len(msgs)} messages, "
      f"{len({x['channel'] for x in msgs})} channels, "
      f"{msgs[0]['ts']} .. {msgs[-1]['ts']}")
