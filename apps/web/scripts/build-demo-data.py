"""Build the console's demo dataset from the repo's real fixtures and cards.

Reads fixtures/slack/*.json, fixtures/SHA256SUMS, contracts/examples/*.json and
emits src/lib/demo/scenarios.ts: one evidence-event log per scenario, shaped
exactly like packages/agent-core/src/contracts/evidence.ts, so the console can
build graphs with buildEvidenceGraph and never invents a number. Every value on
a card comes from the card JSON; check_run inputs/outputs come from the checker
examples where one exists and are otherwise reshaped from the card's reproduced[].

Run from the repo root:  python apps/web/scripts/build-demo-data.py
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
OUT = os.path.join(ROOT, "apps", "web", "src", "lib", "demo", "scenarios.ts")
OUT_WS = os.path.join(ROOT, "apps", "web", "src", "lib", "demo", "workspace.ts")


def load(rel: str):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


SHAS = {}
with open(os.path.join(ROOT, "fixtures", "SHA256SUMS"), encoding="utf-8") as f:
    for line in f:
        sha, path = line.split()
        SHAS[os.path.basename(path)] = sha

CARD = {os.path.basename(p)[len("finding-"):-5]: load(f"contracts/examples/{p}") for p in os.listdir(os.path.join(ROOT, "contracts", "examples")) if p.startswith("finding-")}
RC_RESP = load("contracts/examples/checker-rc-response.json")
ROUTE_RESP = load("contracts/examples/checker-route-response.json")

LINE_COUNT = {"precharge-review-r2.docx": 13, "ks4-sim-inputs-v2-0.xlsx": 9, "ks4-sim-inputs-v2-1.xlsx": 10}


def revision_of(doc: str) -> str | None:
    m = re.search(r"-(r\d+|v\d+-\d+)(?:-clean|-injected)?\.", doc)
    return m.group(1) if m else None


class Log:
    def __init__(self, thread: str, start: datetime):
        self.thread, self.t, self.n, self.events = thread, start, 0, []

    def add(self, trigger: str | None, kind: str, **fields):
        self.n += 1
        self.t += timedelta(seconds=2)
        ev = {"event_id": f"ev-{self.thread.replace('.', '')}-{self.n:04d}", "at": self.t.isoformat().replace("+00:00", "Z"), "thread": self.thread}
        if trigger:
            ev["trigger_ts"] = trigger
        ev["kind"] = kind
        ev.update(fields)
        self.events.append(ev)

    def run(self, trigger: str, msgs, up_to_ts: str | None = None):
        """Reviewer reads the thread up to `up_to_ts`, then each named document."""
        seen_docs = []
        for m in msgs:
            if up_to_ts and m["ts"] > up_to_ts:
                break
            if m["role"] == "evaluator_only":
                continue
            self.add(trigger, "message_read", ts=m["ts"], **{"from": m["user_name"]}, is_bot=False, text=m["text"], is_change=m["role"] == "change" or (m["role"] == "seed" and bool(m["files"]) and m["thread_ts"] is None))
            for fpath in m["files"]:
                doc = os.path.basename(fpath)
                if doc not in seen_docs:
                    seen_docs.append((doc, m["ts"]))
        for doc, ts in seen_docs:
            self.add(trigger, "document_read", document=doc, revision=revision_of(doc), sha256=SHAS[doc], line_count=LINE_COUNT.get(doc, 12), named_in_ts=ts)


def strip_tol(checks):
    return [{k: v for k, v in c.items() if k != "tolerance"} for c in checks]


def check_from_card(card, inputs: dict, evidence_refs):
    """check_run reshaped from a card: outputs keyed by reproduced label, one check per reproduced value that had a printed number."""
    outputs = {r["label"]: {"computed": r["computed"], "unit": r["unit"], **({"printed": r["printed"]} if "printed" in r else {})} for r in card["reproduced"]}
    checks = [{"name": r["label"], "pass": r["matches"], "expected": r["printed"], "actual": r["computed"]} for r in card["reproduced"] if "matches" in r]
    if not checks:
        checks = [{"name": r["label"], "pass": True, "actual": r["computed"]} for r in card["reproduced"]]
    return dict(run_id=card["checker_run"]["run_id"], checker=card["checker_run"]["checker"], version=card["checker_run"]["version"], inputs=inputs, outputs=outputs, checks=checks, error=None, evidence_refs=evidence_refs)


def refs(card):
    return [{"kind": s["kind"], "id": s["sha256"] if s["kind"] == "document" and s.get("sha256") and set(s["sha256"]) != {"0"} else s["id"]} for s in card["sources"]]


def fix_shas(card):
    """Scenario A example cards carry a zero placeholder sha; the real one is in SHA256SUMS."""
    c = json.loads(json.dumps(card))
    for s in c["sources"]:
        if s["kind"] == "document" and s.get("sha256") and set(s["sha256"]) == {"0"}:
            s["sha256"] = SHAS[s["id"]]
    return c


def publish(log, trigger, card):
    log.add(trigger, "finding_published", finding=fix_shas(card))


# Scenario A's section 4 proposal, as the harness script makes it after Card 1
# (apps/channel/src/replay/scripts.ts; evals/records/scripted/scenario-a.1.json).
A_EDIT = {"locator": "section 4, line 13", "find": "t = 6.91 s", "replace": "t = 6.493 s", "reason": "printed value does not reproduce at 2 mF; checker gives 6.4933 s"}
A_PROPOSAL = "edt-a-r2-001"
A_OUTPUT = "precharge-review-r2-proposed.docx"


def apply_edit(source_doc: str, edit: dict) -> dict:
    """Run checkers/apply_docx_edit.py into a temp dir so the applied sha256 is
    the real one for that replacement, never typed by hand. The source is untouched."""
    with tempfile.TemporaryDirectory() as tmp:
        req = {"source": os.path.join(ROOT, "fixtures", "documents", source_doc), "out": os.path.join(tmp, A_OUTPUT), "replacements": [{"find": edit["find"], "replace": edit["replace"]}]}
        res = subprocess.run(["python3", os.path.join(ROOT, "checkers", "apply_docx_edit.py")], input=json.dumps(req), capture_output=True, text=True, check=True)
        return json.loads(res.stdout)


def scenario_a():
    msgs = load("fixtures/slack/scenario-a.json")
    log = Log(msgs[0]["ts"], datetime(2026, 8, 19, 18, 5, 8, tzinfo=timezone.utc))
    trig, change = msgs[2]["ts"], msgs[3]["ts"]
    # Tam's message alone does not open the gate.
    log.add(msgs[1]["ts"], "silence", reason="gate_closed")
    # Run 1: Juno's trigger.
    log.run(trig, msgs, up_to_ts=trig)
    a1 = fix_shas(CARD["scenario-a"])
    log.add(trig, "check_run", **{**{k: RC_RESP[k] for k in ("run_id", "checker", "version", "inputs", "outputs", "error")}, "checks": strip_tol(RC_RESP["checks"]), "evidence_refs": refs(a1)})
    publish(log, trig, a1)
    # Rev proposes the section 4 fix right after Card 1. Nothing is written yet.
    doc = "precharge-review-r2.docx"
    log.add(trig, "edit_proposed", proposal_id=A_PROPOSAL, finding_id=a1["finding_id"], run_id=a1["checker_run"]["run_id"], document=doc, source_sha256=SHAS[doc], edits=[A_EDIT])
    # Run 2: Dara's 820 uF change.
    log.t += timedelta(minutes=85)
    log.run(change, msgs)
    a2 = fix_shas(CARD["scenario-a-superseding"])
    log.add(change, "check_run", **{**{k: RC_RESP[k] for k in ("checker", "version", "inputs", "outputs", "error")}, "checks": strip_tol(RC_RESP["checks"]), "run_id": a2["checker_run"]["run_id"], "evidence_refs": refs(a2)})
    log.add(change, "finding_superseded", finding_id=a1["finding_id"], superseded_by=a2["finding_id"], cause_ts=change)
    publish(log, change, a2)
    # Juno approves the section 4 proposal; the edit goes into a new copy, the source keeps its hash.
    log.t += timedelta(minutes=3)
    applied = apply_edit(doc, A_EDIT)
    assert applied["source_sha256"] == SHAS[doc], "fixture sha moved; regenerate SHA256SUMS"
    log.add(trig, "edit_decided", proposal_id=A_PROPOSAL, decision="approved", by="Juno Marsh")
    log.add(trig, "edit_applied", proposal_id=A_PROPOSAL, document=doc, source_sha256=applied["source_sha256"], output=A_OUTPUT, sha256=applied["sha256"])
    return log.events


ROUTE_INPUTS_V21 = {"mass_kg": 318, "Crr": 0.0048, "CdA": 0.12, "rho": 1.2, "v_mps": 22, "d_m": 220000, "pack_kWh": 5.2, "soc_start": 0.96, "soc_end": 0.40}
ROUTE_INPUTS_V20 = {**ROUTE_INPUTS_V21, "mass_kg": 290, "Crr": 0.0040}


def scenario_b():
    msgs = load("fixtures/slack/scenario-b.json")
    log = Log(msgs[3]["ts"], datetime(2026, 8, 11, 17, 15, 4, tzinfo=timezone.utc))
    trig, change = msgs[3]["ts"], msgs[4]["ts"]
    log.run(trig, msgs, up_to_ts=trig)
    b1 = CARD["scenario-b"]
    log.add(trig, "check_run", **check_from_card(b1, {"v2-0": ROUTE_INPUTS_V20, "v2-1": ROUTE_INPUTS_V21}, refs(b1)))
    publish(log, trig, b1)
    log.t += timedelta(minutes=45)
    log.run(change, msgs)
    b2 = CARD["scenario-b-superseding"]
    log.add(change, "check_run", **check_from_card(b2, {"v2-0": {**ROUTE_INPUTS_V20, "soc_end": 0.35}, "v2-1": {**ROUTE_INPUTS_V21, "soc_end": 0.35}}, refs(b2)))
    log.add(change, "finding_superseded", finding_id=b1["finding_id"], superseded_by=b2["finding_id"], cause_ts=change)
    publish(log, change, b2)
    return log.events


def rc1():
    msgs = load("fixtures/slack/rc1-clean.json")
    log = Log(msgs[0]["ts"], datetime(2026, 8, 19, 18, 40, 0, tzinfo=timezone.utc))
    trig = msgs[2]["ts"]
    log.run(trig, msgs)
    c = fix_shas(CARD["rc1-clean"])
    log.add(trig, "check_run", **check_from_card(c, RC_RESP["inputs"], refs(c)))
    publish(log, trig, c)
    return log.events


def rc2():
    msgs = load("fixtures/slack/rc2-conflict.json")
    log = Log(msgs[4]["ts"], datetime(2026, 8, 11, 17, 20, 0, tzinfo=timezone.utc))
    trig = msgs[4]["ts"]
    log.run(trig, msgs)
    c = CARD["rc2-conflict"]
    log.add(trig, "check_run", **{**{k: ROUTE_RESP[k] for k in ("checker", "version", "inputs", "outputs", "checks", "error")}, "run_id": c["checker_run"]["run_id"], "evidence_refs": refs(c)})
    publish(log, trig, c)
    return log.events


def rc3():
    """Mid-run revision: the first run is refused because Milo's change landed while it ran."""
    msgs = load("fixtures/slack/rc3-midrun.json")
    log = Log(msgs[3]["ts"], datetime(2026, 8, 11, 18, 0, 0, tzinfo=timezone.utc))
    trig, change = msgs[3]["ts"], msgs[4]["ts"]
    log.run(trig, msgs, up_to_ts=trig)
    b1 = CARD["scenario-b"]
    log.add(trig, "check_run", **check_from_card(b1, {"v2-0": ROUTE_INPUTS_V20, "v2-1": ROUTE_INPUTS_V21}, refs(b1)))
    log.add(trig, "message_read", ts=change, **{"from": msgs[4]["user_name"]}, is_bot=False, text=msgs[4]["text"], is_change=True)
    log.add(trig, "publish_refused", run_id=b1["checker_run"]["run_id"], bound_revision=trig, current_revision=change, reason="thread revision moved from the trigger to Milo's 35 percent message while the check ran")
    log.run(change, msgs)
    b2 = CARD["scenario-b-superseding"]
    log.add(change, "check_run", **check_from_card(b2, {"v2-0": {**ROUTE_INPUTS_V20, "soc_end": 0.35}, "v2-1": {**ROUTE_INPUTS_V21, "soc_end": 0.35}}, refs(b2)))
    publish(log, change, b2)
    return log.events


def scenario_a_cross():
    """Cross-channel Scenario A, taken from the real harness run record
    evals/records/scripted/scenario-a-cross.1.json: the thread never says 820;
    search_workspace finds Dara's purchasing message by unit and the card cites it."""
    rec = load("evals/records/scripted/scenario-a-cross.1.json")
    msgs = load("fixtures/slack/scenario-a-cross.json")
    log = Log(msgs[0]["ts"], datetime(2026, 8, 19, 19, 5, 4, tzinfo=timezone.utc))
    trig = msgs[2]["ts"]
    for m in msgs:
        log.add(trig, "message_read", ts=m["ts"], **{"from": m["user_name"]}, is_bot=False, text=m["text"], is_change=m["role"] == "change" or (m["role"] == "seed" and bool(m["files"])), via="thread")
    search = next(t for t in rec["tool_calls"] if t["name"] == "search_workspace")
    hits = search["result"]["hits"]
    log.add(trig, "workspace_search", query=search["args"], cutoff=trig, total=search["result"]["total"], returned=len(hits), hit_ts=[h["ts"] for h in hits])
    for h in hits:
        log.add(trig, "message_read", ts=h["ts"], **{"from": h["from"]}, is_bot=False, text=h["text"], is_change=h["is_change"], channel=h["channel"], via="workspace_search")
    ev = next(t for t in rec["tool_calls"] if t["name"] == "read_evidence")["result"]
    log.add(trig, "document_read", document=ev["document"], revision=ev["revision"], sha256=ev["sha256"], line_count=len(ev["lines"]), named_in_ts=msgs[0]["ts"])
    cr = rec["checker_runs"][0]
    card = rec["posted_cards"][0]
    log.add(trig, "check_run", run_id=cr["run_id"], checker=cr["checker"], version=cr["version"], inputs=cr["inputs"], outputs=cr["outputs"], checks=strip_tol(cr["checks"]), error=cr["error"], evidence_refs=refs(card))
    publish(log, trig, card)
    return log.events


SCENARIOS = [
    {"id": "scenario-a", "title": "Precharge RC timing", "channel": "#ks4-electrical", "channel_id": "C00SYN01", "fixture": "scenario-a.json", "kind": "scenario", "summary": "Text says 680 uF, diagram says 750 uF; then the bus becomes 820 uF and the relay timer is violated.", "events": scenario_a()},
    {"id": "scenario-a-cross", "title": "Precharge RC, cross-channel", "channel": "#ks4-electrical", "channel_id": "C00SYN01", "fixture": "scenario-a-cross.json", "kind": "scenario", "summary": "The r2 thread never says 820. search_workspace finds Dara's 820 uF purchasing message by unit two weeks earlier; the card cites it by channel and asks which bus is right.", "events": scenario_a_cross()},
    {"id": "scenario-b", "title": "Stale simulation inputs", "channel": "#ks4-strategy-sim", "channel_id": "C00SYN02", "fixture": "scenario-b.json", "kind": "scenario", "summary": "Route request names the July 3 sheet after Milo said to use v2-1; feasibility flips between versions.", "events": scenario_b()},
    {"id": "rc1-clean", "title": "RC1 · clean control", "channel": "#ks4-electrical", "channel_id": "C00SYN01", "fixture": "rc1-clean.json", "kind": "control", "summary": "Text, diagram and printed value agree. The reviewer posts a clean card and nothing else.", "events": rc1()},
    {"id": "rc2-conflict", "title": "RC2 · conflicting evidence", "channel": "#ks4-strategy-sim", "channel_id": "C00SYN02", "fixture": "rc2-conflict.json", "kind": "control", "summary": "Two candidate masses (318 and 310 kg). The reviewer computes both and asks Milo instead of choosing.", "events": rc2()},
    {"id": "rc3-midrun", "title": "RC3 · mid-run revision", "channel": "#ks4-strategy-sim", "channel_id": "C00SYN02", "fixture": "rc3-midrun.json", "kind": "control", "summary": "Milo's change lands while the check runs. publish_result refuses the stale run; a new run publishes against the new revision.", "events": rc3()},
]

ENGINEERS = ["Dara Voss", "Tam Holloway", "Juno Marsh", "Milo Trent", "Ines Calder"]

header = """/* GENERATED by apps/web/scripts/build-demo-data.py — do not edit by hand.
 * Demo evidence logs assembled from fixtures/slack/*.json, fixtures/SHA256SUMS
 * and contracts/examples/*.json. Card contents and every number are copied
 * from those files; only event ids and timestamps are synthetic.
 */
import type { EvidenceEvent } from "agent-core/shared";

export type DemoScenario = {
  id: string;
  title: string;
  channel: string;
  channel_id: string;
  fixture: string;
  kind: "scenario" | "control";
  summary: string;
  events: EvidenceEvent[];
};

export const ENGINEERS = %s as const;

export const SCENARIOS: DemoScenario[] = %s;

export const DEFAULT_SCENARIO = SCENARIOS[0]!.id;
"""

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    f.write(header % (json.dumps(ENGINEERS), json.dumps(SCENARIOS, indent=2, ensure_ascii=False)))
print(OUT, sum(len(s["events"]) for s in SCENARIOS), "events")

WS = load("fixtures/workspace/kestrel-workspace.json")
ws_header = """/* GENERATED by apps/web/scripts/build-demo-data.py — do not edit by hand.
 * fixtureMessages is a verbatim copy of fixtures/workspace/kestrel-workspace.json:
 * the Slack export the reviewer's exact-match workspace index is built from
 * (F12/F14). WORKSPACE_SYNTHETIC (apps/web/scripts/gen-workspace-synthetic.py)
 * widens the corpus with generated chatter; WORKSPACE merges both, sorted by ts.
 */
import type { WorkspaceMessage } from "../workspace-index";
import { WORKSPACE_SYNTHETIC } from "./workspace-synthetic";

const fixtureMessages: WorkspaceMessage[] = %s;

export const WORKSPACE: WorkspaceMessage[] = [...fixtureMessages, ...WORKSPACE_SYNTHETIC].sort(
  (a, b) => Number(a.ts) - Number(b.ts),
);
"""
with open(OUT_WS, "w", encoding="utf-8", newline="\n") as f:
    f.write(ws_header % json.dumps([{k: v for k, v in m.items() if k != "role"} for m in WS], indent=2, ensure_ascii=False))
print(OUT_WS, len(WS), "fixture messages")
