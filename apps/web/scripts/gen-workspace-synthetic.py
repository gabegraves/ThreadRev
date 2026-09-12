"""Generate apps/web/src/lib/demo/workspace-synthetic.ts: a larger synthetic
corpus of FRC-style engineering Slack chatter for the Workspace page's
exact-match message index (apps/web/src/lib/workspace-index.ts).

Deterministic (fixed seed). Web lane only — does not touch fixtures/.

Run from the repo root:  python apps/web/scripts/gen-workspace-synthetic.py
"""
from __future__ import annotations

import hashlib
import json
import os
import random
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.join(ROOT, "apps", "web", "src", "lib", "demo", "workspace-synthetic.ts")

SEED = 20260912
rng = random.Random(SEED)

# Fresh ids so the exact-match index's channel/people maps (keyed by id) never
# collide with fixtures/workspace/kestrel-workspace.json's C00SYN0x / U00SYN0x.
CHANNELS = [
    ("C0WSY01", "ks4-electrical"),
    ("C0WSY02", "ks4-mech"),
    ("C0WSY03", "ks4-firmware"),
    ("C0WSY04", "ks4-purchasing"),
    ("C0WSY05", "ks4-drive"),
    ("C0WSY06", "ks4-general"),
]
USERS = [
    ("U0WSY01", "Dara Voss"),
    ("U0WSY02", "Tam Holloway"),
    ("U0WSY03", "Juno Marsh"),
    ("U0WSY04", "Milo Trent"),
    ("U0WSY05", "Ines Calder"),
    ("U0WSY06", "Rowan Pike"),
    ("U0WSY07", "Priya Anand"),
    ("U0WSY08", "Leo Marsh"),
]

START = datetime(2026, 3, 1, tzinfo=timezone.utc)
END = datetime(2026, 9, 1, tzinfo=timezone.utc)

PARTS = [
    "REV-14B", "CIM-2", "AM-3927", "TE-ratchet-06", "S3-relay-40A",
    "10AWG-red", "WCP-1350", "FLEX-24-6mm", "REDLINE-775", "PDH-rev2",
]

# Message text templates. {n} styles hold numeric+unit spans that
# extractQuantities()/UNIT_RE can pick up: uF, ohm, V, A, s, ms, USD, kg, mm.
TEMPLATES = [
    "Bus capacitance measured at {v1} uF across the {part}, precharge resistor {v2} ohm.",
    "Correction: bus is now {v1} uF after swapping the {part}, not {v2} uF like I said Tuesday.",
    "Drivetrain draws {v1} A steady state at {v2} V under full load on the practice field.",
    "Motor controller brownout threshold set to {v1} V, current limit {v2} A per module.",
    "Precharge sequence takes {v1} ms to settle, relay closes {v2} ms after enable.",
    "Actually the shock travel spec is {v1} mm, not {v2} mm — measured it myself with calipers.",
    "Chassis weighed in at {v1} kg on the shop scale, {v2} kg under the estimate in the sim doc.",
    "Ordered the {part} for {v1} USD, budget line still has {v2} USD left this quarter.",
    "Bumper foam compresses {v1} mm before the frame rail contacts, tested at {v2} N preload.",
    "PDH main breaker is {v1} A, sized for {v2} A continuous draw from the drivetrain.",
    "Relay timer from enable to drive-ready is {v1} ms, was {v2} ms before the firmware bump.",
    "Battery internal resistance reads {v1} ohm on the new pack, {v2} ohm on the spare.",
    "Instead of the {part} we're routing through a {v2} A breaker, quote came back at {v1} USD.",
    "Updated: precharge resistor is now {v1} ohm, supersedes the {v2} ohm value from kickoff.",
    "\"{v1} A is fine for that motor,\" Dara said, so we're not derating below {v2} A.",
    "Encoder counts per rev confirmed at {v1}, gear ratio still {v2}:1 same as last season.",
    "CAN bus utilization sitting around {v1} percent at full tele-op load.",
    "Scratch that — the {part} spec sheet says {v1} V max, we were running it at {v2} V.",
    "Arm holding torque needs about {v1} N·m at full extension, gearbox rated for {v2} N·m.",
    "Ambient in the electronics bay hit {v1} deg C during the long auto test, fans kick on at {v2} deg C.",
    "Swapped in the {part}, new draw is {v1} A vs {v2} A on the old part — logged in the test doc.",
    "Quote for the {part} came back at {v1} USD, {v2} USD cheaper than the first vendor.",
    "Field wiring run is {v1} mm gauge core, {v2} mm insulation OD, matches the harness doc.",
    "Reviewed {part} torque spec: rated {v1} N·m continuous, {v2} N·m peak for 2 seconds.",
    "Now, not later — bus target moves to {v1} V nominal, precharge resistor stays {v2} ohm.",
]

THREAD_REPLIES = [
    "Confirmed, matches what I have: {v1} {u1}.",
    "Pushed the fix, retest shows {v1} {u1} now.",
    "Good catch — updating the doc to {v1} {u1}.",
    "Ran it again, got {v1} {u1} this time, closer to spec.",
    "Agreed, going with {v1} {u1} for the design review.",
    "Can we get {v1} {u1} confirmed by Friday before we order?",
    "That lines up with the {part} datasheet.",
    "Attaching the updated numbers now.",
]

DOC_EXTS = ["docx", "xlsx", "pdf"]
DOC_STEMS = [
    "precharge-review", "bus-capacitance-memo", "drivetrain-current-budget",
    "shock-travel-spec", "chassis-weight-log", "purchasing-quote",
    "pdh-breaker-sizing", "can-bus-utilization", "arm-torque-review",
]


def rand_value(lo: float, hi: float, decimals: int = 0) -> str:
    v = rng.uniform(lo, hi)
    return str(round(v, decimals)) if decimals else str(int(round(v)))


def gen_filename() -> str:
    stem = rng.choice(DOC_STEMS)
    rev = rng.choice(["r1", "r2", "r3", "final"])
    ext = rng.choice(DOC_EXTS)
    return f"{stem}-{rev}.{ext}"


def sha256_hex(seed_text: str) -> str:
    return hashlib.sha256(seed_text.encode("utf-8")).hexdigest()


def fill_template(tpl: str) -> str:
    part = rng.choice(PARTS)
    v1 = rand_value(1, 900, rng.choice([0, 1, 2]))
    v2 = rand_value(1, 900, rng.choice([0, 1, 2]))
    return tpl.format(part=part, v1=v1, v2=v2)


def main() -> None:
    total_seconds = int((END - START).total_seconds())
    count = 200

    # Monotonic, unique ts: evenly spread offsets, jittered, then sorted+deduped.
    offsets = sorted({rng.randint(0, total_seconds) for _ in range(count + 20)})
    offsets = offsets[:count]
    while len(offsets) < count:
        offsets.append(offsets[-1] + rng.randint(1, 500))
    micros = rng.sample(range(1000, 999999), count)

    messages = []
    for i, off in enumerate(offsets):
        epoch = int(START.timestamp()) + off
        ts = f"{epoch}.{micros[i]:06d}"
        channel_id, channel_name = rng.choice(CHANNELS)
        user_id, user_name = rng.choice(USERS)

        is_reply = messages and rng.random() < 0.30
        thread_ts = None
        if is_reply:
            # Reply to an earlier message in the same channel when possible.
            same_channel = [m for m in messages if m["channel"] == channel_id]
            parent = rng.choice(same_channel) if same_channel else rng.choice(messages)
            thread_ts = parent["ts"]
            unit = rng.choice(["uF", "ohm", "V", "A", "ms", "s", "USD", "kg", "mm"])
            val = rand_value(1, 900, rng.choice([0, 1]))
            reply_tpl = rng.choice(THREAD_REPLIES)
            text = reply_tpl.format(v1=val, u1=unit, part=rng.choice(PARTS))
        else:
            text = fill_template(rng.choice(TEMPLATES))

        files = []
        if rng.random() < 0.12:
            fname = gen_filename()
            files.append(fname)
            text = f"{text} See {fname}."

        messages.append({
            "ts": ts,
            "channel": channel_id,
            "channel_name": channel_name,
            "user": user_id,
            "user_name": user_name,
            "thread_ts": thread_ts,
            "text": text,
            "files": files,
        })

    messages.sort(key=lambda m: float(m["ts"]))
    assert len({m["ts"] for m in messages}) == len(messages), "ts collision"

    header = """/* GENERATED by apps/web/scripts/gen-workspace-synthetic.py — do not edit by hand.
 * Synthetic FRC-style engineering chatter that widens the Workspace page's
 * exact-match message index (apps/web/src/lib/workspace-index.ts) beyond the
 * ~39-message fixtures/workspace/kestrel-workspace.json seed. Merged into
 * WORKSPACE by build-demo-data.py; run gen-workspace-synthetic.py again to
 * regenerate this file, then re-run build-demo-data.py.
 */
import type { WorkspaceMessage } from "../workspace-index";

export const WORKSPACE_SYNTHETIC: WorkspaceMessage[] = %s;
"""
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(header % json.dumps(messages, indent=2, ensure_ascii=False))
    print(OUT, len(messages), "messages")


if __name__ == "__main__":
    main()
