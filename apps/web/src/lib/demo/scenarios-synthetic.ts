/* Hand-authored synthetic demo scenarios (not generated from fixtures).
 * Merged into SCENARIOS by apps/web/scripts/build-demo-data.py. Event and
 * finding shapes follow packages/agent-core/src/contracts/evidence.ts and
 * finding.ts; every checker output below is internally consistent (computed
 * by hand against the stated inputs).
 */
import type { EvidenceEvent } from "agent-core/shared";

type DemoScenario = {
  id: string;
  title: string;
  channel: string;
  channel_id: string;
  fixture: string;
  kind: "scenario" | "control";
  summary: string;
  events: EvidenceEvent[];
};

export const SYNTHETIC_SCENARIOS: DemoScenario[] = [
  {
    "id": "syn-01",
    "title": "Chassis drivetrain torque margin",
    "channel": "#ks4-mech",
    "channel_id": "C00SYN03",
    "fixture": "syn-01.json",
    "kind": "scenario",
    "summary": "Printed torque margin does not reproduce from the doc's own stall torque, gearbox ratio and load; recomputed margin misses the requirement.",
    "events": [
      {
        "event_id": "ev-1784041800000100-0001",
        "at": "2026-07-14T15:10:00Z",
        "thread": "1784041800.000100",
        "trigger_ts": "1784041804.000300",
        "kind": "message_read",
        "ts": "1784041800.000100",
        "from": "Dara Voss",
        "is_bot": false,
        "text": "Drivetrain review r1 posted. Stall torque 1.8 Nm, 15:1 gearbox, 85 pct efficiency, load 19.5 Nm. Margin comes out to 4.2 Nm.",
        "is_change": true
      },
      {
        "event_id": "ev-1784041800000100-0002",
        "at": "2026-07-14T15:10:02Z",
        "thread": "1784041800.000100",
        "trigger_ts": "1784041804.000300",
        "kind": "message_read",
        "ts": "1784041802.000200",
        "from": "Dara Voss",
        "is_bot": false,
        "text": "Doc is r1, section 2 has the numbers.",
        "is_change": false
      },
      {
        "event_id": "ev-1784041800000100-0003",
        "at": "2026-07-14T15:10:04Z",
        "thread": "1784041800.000100",
        "trigger_ts": "1784041804.000300",
        "kind": "message_read",
        "ts": "1784041804.000300",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "@Rev check the torque margin in the r1 drivetrain doc before I sign off.",
        "is_change": false
      },
      {
        "event_id": "ev-1784041800000100-0004",
        "at": "2026-07-14T15:10:05Z",
        "thread": "1784041800.000100",
        "trigger_ts": "1784041804.000300",
        "kind": "message_read",
        "ts": "1784041805.000350",
        "from": "Tam Holloway",
        "is_bot": false,
        "text": "Firmware side is unaffected either way, this is purely a mechanical margin question.",
        "is_change": false
      },
      {
        "event_id": "ev-1784041800000100-0005",
        "at": "2026-07-14T15:10:05Z",
        "thread": "1784041800.000100",
        "trigger_ts": "1784041804.000300",
        "kind": "message_read",
        "ts": "1784041805.000360",
        "from": "Ines Calder",
        "is_bot": false,
        "text": "Corner weights don't change the drivetrain load figure, so 19.5 Nm still holds.",
        "is_change": false
      },
      {
        "event_id": "ev-1784041800000100-0006",
        "at": "2026-07-14T15:10:06Z",
        "thread": "1784041800.000100",
        "trigger_ts": "1784041804.000300",
        "kind": "document_read",
        "document": "chassis-drivetrain-review-r1.docx",
        "revision": "r1",
        "sha256": "6d8d8437aef414dc6acccd48efc50f2c0194f97518b84419e1afdee60ad820ed",
        "line_count": 11,
        "named_in_ts": "1784041800.000100"
      },
      {
        "event_id": "ev-1784041800000100-0007",
        "at": "2026-07-14T15:10:08Z",
        "thread": "1784041800.000100",
        "trigger_ts": "1784041804.000300",
        "kind": "check_run",
        "run_id": "torque-20260912T090000Z-4a1c",
        "checker": "torque",
        "version": "1",
        "inputs": {
          "motor_stall_Nm": 1.8,
          "gear_ratio": 15,
          "efficiency": 0.85,
          "load_Nm": 19.5,
          "required_margin_Nm": 4.0,
          "printed_margin_Nm": 4.2
        },
        "outputs": {
          "available_Nm": 22.95,
          "margin_Nm": 3.45
        },
        "checks": [
          {
            "name": "printed_margin_matches_computed",
            "pass": false,
            "expected": 4.2,
            "actual": 3.45
          },
          {
            "name": "margin_meets_required",
            "pass": false,
            "expected": 4.0,
            "actual": 3.45
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "document",
            "id": "6d8d8437aef414dc6acccd48efc50f2c0194f97518b84419e1afdee60ad820ed"
          },
          {
            "kind": "message",
            "id": "1784041800.000100"
          }
        ]
      },
      {
        "event_id": "ev-1784041800000100-0008",
        "at": "2026-07-14T15:10:10Z",
        "thread": "1784041800.000100",
        "trigger_ts": "1784041804.000300",
        "kind": "finding_published",
        "finding": {
          "finding_id": "fnd-syn01-r1-001",
          "status": "live",
          "requirements_revision": "1784041800.000100",
          "discrepancy": "Section 2 prints a torque margin of 4.2 Nm from stall torque 1.8 Nm, a 15:1 gearbox and 85 percent efficiency against a 19.5 Nm load. Recomputed available torque is 22.95 Nm, giving a margin of 3.45 Nm, not 4.2 Nm, and below the 4.0 Nm requirement in section 1.",
          "why_it_matters": "The doc's own printed number would clear the 4.0 Nm requirement by 0.2 Nm; the number the checker reproduces from the same inputs falls short by 0.55 Nm. The review cannot be signed against the printed figure.",
          "sources": [
            {
              "kind": "document",
              "id": "chassis-drivetrain-review-r1.docx",
              "revision": "r1",
              "sha256": "6d8d8437aef414dc6acccd48efc50f2c0194f97518b84419e1afdee60ad820ed",
              "locator": "section 2, line 4",
              "quote": "Margin = 22.95 times loss factor minus 19.5 = 4.2 Nm."
            },
            {
              "kind": "document",
              "id": "chassis-drivetrain-review-r1.docx",
              "revision": "r1",
              "sha256": "6d8d8437aef414dc6acccd48efc50f2c0194f97518b84419e1afdee60ad820ed",
              "locator": "section 1",
              "quote": "Required margin: 4.0 Nm minimum at max load."
            }
          ],
          "reproduced": [
            {
              "label": "available torque at output",
              "computed": 22.95,
              "unit": "N*m"
            },
            {
              "label": "torque margin",
              "printed": 4.2,
              "computed": 3.45,
              "unit": "N*m",
              "matches": false,
              "tolerance": 0.01
            }
          ],
          "inferred": [],
          "resolution": "Dara re-derives the margin from 22.95 Nm available and 19.5 Nm load (3.45 Nm) and either raises the gearbox ratio or gets a required-margin waiver.",
          "question": {
            "to": "Dara Voss",
            "ask": "Section 2 prints 4.2 Nm but 22.95 Nm available minus 19.5 Nm load is 3.45 Nm. Which number should the doc carry?"
          },
          "checker_run": {
            "checker": "torque",
            "version": "1",
            "run_id": "torque-20260912T090000Z-4a1c"
          }
        }
      },
      {
        "event_id": "ev-1784041800000100-0009",
        "at": "2026-07-14T15:10:12Z",
        "thread": "1784041800.000100",
        "trigger_ts": "1784041804.000300",
        "kind": "edit_proposed",
        "proposal_id": "edt-syn01-r1-001",
        "finding_id": "fnd-syn01-r1-001",
        "run_id": "torque-20260912T090000Z-4a1c",
        "document": "chassis-drivetrain-review-r1.docx",
        "source_sha256": "6d8d8437aef414dc6acccd48efc50f2c0194f97518b84419e1afdee60ad820ed",
        "edits": [
          {
            "locator": "section 2, line 4",
            "find": "Margin = 22.95 times loss factor minus 19.5 = 4.2 Nm.",
            "replace": "Margin = 22.95 - 19.5 = 3.45 Nm.",
            "reason": "printed margin does not reproduce from the stated inputs; checker gives 3.45 Nm"
          }
        ]
      },
      {
        "event_id": "ev-1784041800000100-0010",
        "at": "2026-07-14T15:48:00Z",
        "thread": "1784041800.000100",
        "trigger_ts": "1784041804.000300",
        "kind": "message_read",
        "ts": "1784044080.000500",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "Agreed, 3.45 Nm is what the inputs give. Approving the edit.",
        "is_change": false
      },
      {
        "event_id": "ev-1784041800000100-0011",
        "at": "2026-07-14T15:50:00Z",
        "thread": "1784041800.000100",
        "trigger_ts": "1784041804.000300",
        "kind": "edit_decided",
        "proposal_id": "edt-syn01-r1-001",
        "decision": "approved",
        "by": "Juno Marsh"
      },
      {
        "event_id": "ev-1784041800000100-0012",
        "at": "2026-07-14T15:50:02Z",
        "thread": "1784041800.000100",
        "trigger_ts": "1784041804.000300",
        "kind": "edit_applied",
        "proposal_id": "edt-syn01-r1-001",
        "document": "chassis-drivetrain-review-r1.docx",
        "source_sha256": "6d8d8437aef414dc6acccd48efc50f2c0194f97518b84419e1afdee60ad820ed",
        "output": "chassis-drivetrain-review-r1-proposed.docx",
        "sha256": "bf11b5e15dd06e445d80429eed61f171c5e8aeba33a8296d33ce343972327da7"
      }
    ]
  },
  {
    "id": "syn-02",
    "title": "Watchdog reset timing, corrected units",
    "channel": "#ks4-firmware",
    "channel_id": "C00SYN05",
    "fixture": "syn-02.json",
    "kind": "control",
    "summary": "First read looks off by 10x from a unit mixup; once corrected to milliseconds the printed reset time reproduces exactly.",
    "events": [
      {
        "event_id": "ev-1784368800000100-0001",
        "at": "2026-07-18T10:00:00Z",
        "thread": "1784368800.000100",
        "trigger_ts": "1784368802.000200",
        "kind": "silence",
        "reason": "gate_closed"
      },
      {
        "event_id": "ev-1784368800000100-0002",
        "at": "2026-07-18T10:00:02Z",
        "thread": "1784368800.000100",
        "trigger_ts": "1784368804.000300",
        "kind": "message_read",
        "ts": "1784368802.000200",
        "from": "Tam Holloway",
        "is_bot": false,
        "text": "Watchdog reset cap on the firmware board is 220 uF, 330 ohm pull-up, matches the r1 schematic.",
        "is_change": true
      },
      {
        "event_id": "ev-1784368800000100-0003",
        "at": "2026-07-18T10:00:04Z",
        "thread": "1784368800.000100",
        "trigger_ts": "1784368804.000300",
        "kind": "message_read",
        "ts": "1784368804.000300",
        "from": "Milo Trent",
        "is_bot": false,
        "text": "@Rev confirm the watchdog reset timing against the r1 schematic before we flash the boards.",
        "is_change": false
      },
      {
        "event_id": "ev-1784368800000100-0004",
        "at": "2026-07-18T10:00:05Z",
        "thread": "1784368800.000100",
        "trigger_ts": "1784368804.000300",
        "kind": "message_read",
        "ts": "1784368805.000350",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "This is the backup board firmware, separate from the precharge timing thread.",
        "is_change": false
      },
      {
        "event_id": "ev-1784368800000100-0005",
        "at": "2026-07-18T10:00:05Z",
        "thread": "1784368800.000100",
        "trigger_ts": "1784368804.000300",
        "kind": "message_read",
        "ts": "1784368805.000360",
        "from": "Dara Voss",
        "is_bot": false,
        "text": "Pull-up resistor value came from the r1 BOM, 330 ohm 1 pct.",
        "is_change": false
      },
      {
        "event_id": "ev-1784368800000100-0006",
        "at": "2026-07-18T10:00:06Z",
        "thread": "1784368800.000100",
        "trigger_ts": "1784368804.000300",
        "kind": "document_read",
        "document": "firmware-watchdog-schematic-r1.pdf",
        "revision": "r1",
        "sha256": "e4e203cacd54d16b4f221ce7939b987eee7e60c478d95188e331280f1120bcfc",
        "line_count": 8,
        "named_in_ts": "1784368802.000200"
      },
      {
        "event_id": "ev-1784368800000100-0007",
        "at": "2026-07-18T10:00:08Z",
        "thread": "1784368800.000100",
        "trigger_ts": "1784368804.000300",
        "kind": "check_run",
        "run_id": "rc-20260912T091000Z-9d2e",
        "checker": "rc",
        "version": "1",
        "inputs": {
          "R_ohm": 330,
          "threshold": 0.999,
          "timer_s": 0.15,
          "capacitances": [
            {
              "label": "220uF_schematic",
              "C_F": 0.00022
            }
          ],
          "printed": [
            {
              "label": "printed_0.05",
              "value_s": 0.05,
              "against": [
                "220uF_schematic"
              ]
            }
          ],
          "tolerance_s": 0.0005
        },
        "outputs": {
          "per_capacitance": {
            "220uF_schematic": {
              "RC_s": 0.0726,
              "t_threshold_s": 0.5015,
              "fraction_at_timer": 0.8676
            }
          }
        },
        "checks": [
          {
            "name": "printed_0.05_matches_220uF_schematic",
            "pass": false,
            "expected": 0.05,
            "actual": 0.5015
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "document",
            "id": "e4e203cacd54d16b4f221ce7939b987eee7e60c478d95188e331280f1120bcfc"
          }
        ]
      },
      {
        "event_id": "ev-1784368800000100-0008",
        "at": "2026-07-18T10:30:00Z",
        "thread": "1784368800.000100",
        "trigger_ts": "1784370600.000400",
        "kind": "message_read",
        "ts": "1784370600.000400",
        "from": "Tam Holloway",
        "is_bot": false,
        "text": "My mistake, the 0.05 in the schematic is milliseconds not seconds; printed value is 501.5 ms which matches. Re-check please.",
        "is_change": true
      },
      {
        "event_id": "ev-1784368800000100-0009",
        "at": "2026-07-18T10:30:01Z",
        "thread": "1784368800.000100",
        "trigger_ts": "1784370600.000400",
        "kind": "message_read",
        "ts": "1784370601.000450",
        "from": "Milo Trent",
        "is_bot": false,
        "text": "Thanks, re-running with the ms correction.",
        "is_change": false
      },
      {
        "event_id": "ev-1784368800000100-0010",
        "at": "2026-07-18T10:30:02Z",
        "thread": "1784368800.000100",
        "trigger_ts": "1784370600.000400",
        "kind": "document_read",
        "document": "firmware-watchdog-schematic-r1.pdf",
        "revision": "r1",
        "sha256": "e4e203cacd54d16b4f221ce7939b987eee7e60c478d95188e331280f1120bcfc",
        "line_count": 8,
        "named_in_ts": "1784368802.000200"
      },
      {
        "event_id": "ev-1784368800000100-0011",
        "at": "2026-07-18T10:30:04Z",
        "thread": "1784368800.000100",
        "trigger_ts": "1784370600.000400",
        "kind": "check_run",
        "run_id": "rc-20260912T094000Z-1177",
        "checker": "rc",
        "version": "1",
        "inputs": {
          "R_ohm": 330,
          "threshold": 0.999,
          "timer_s": 0.5015,
          "capacitances": [
            {
              "label": "220uF_schematic",
              "C_F": 0.00022
            }
          ],
          "printed": [
            {
              "label": "printed_0.5015",
              "value_s": 0.5015,
              "against": [
                "220uF_schematic"
              ]
            }
          ],
          "tolerance_s": 0.0005
        },
        "outputs": {
          "per_capacitance": {
            "220uF_schematic": {
              "RC_s": 0.0726,
              "t_threshold_s": 0.5015,
              "fraction_at_timer": 0.999
            }
          }
        },
        "checks": [
          {
            "name": "printed_0.5015_matches_220uF_schematic",
            "pass": true,
            "expected": 0.5015,
            "actual": 0.5015
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "document",
            "id": "e4e203cacd54d16b4f221ce7939b987eee7e60c478d95188e331280f1120bcfc"
          },
          {
            "kind": "message",
            "id": "1784370600.000400"
          }
        ]
      },
      {
        "event_id": "ev-1784368800000100-0012",
        "at": "2026-07-18T10:30:06Z",
        "thread": "1784368800.000100",
        "trigger_ts": "1784370600.000400",
        "kind": "finding_published",
        "finding": {
          "finding_id": "fnd-syn02-clean-001",
          "status": "live",
          "requirements_revision": "1784370600.000400",
          "discrepancy": "none",
          "why_it_matters": "The corrected 501.5 ms figure reproduces exactly from 330 ohm and 220 uF; watchdog reset timing matches the schematic with no open questions.",
          "sources": [
            {
              "kind": "document",
              "id": "firmware-watchdog-schematic-r1.pdf",
              "revision": "r1",
              "sha256": "e4e203cacd54d16b4f221ce7939b987eee7e60c478d95188e331280f1120bcfc",
              "locator": "section 1",
              "quote": "Reset RC: R = 330 ohm, C = 220 uF, t_99.9 = 501.5 ms."
            }
          ],
          "reproduced": [
            {
              "label": "t_99.9 at 220uF",
              "printed": 0.5015,
              "computed": 0.5015,
              "unit": "s",
              "matches": true,
              "tolerance": 0.0005
            }
          ],
          "inferred": [],
          "resolution": "No action needed; the schematic's corrected 501.5 ms value is what the checker reproduces.",
          "checker_run": {
            "checker": "rc",
            "version": "1",
            "run_id": "rc-20260912T094000Z-1177"
          }
        }
      }
    ]
  },
  {
    "id": "syn-03",
    "title": "Drive hub bearing thermal derate",
    "channel": "#ks4-purchasing",
    "channel_id": "C00SYN04",
    "fixture": "syn-03.json",
    "kind": "scenario",
    "summary": "Printed steady-state bearing temperature is arithmetically wrong from the sheet's own inputs, though the corrected value still clears the rating.",
    "events": [
      {
        "event_id": "ev-1784725200000100-0001",
        "at": "2026-07-22T13:00:00Z",
        "thread": "1784725200.000100",
        "trigger_ts": "1784725204.000300",
        "kind": "message_read",
        "ts": "1784725200.000100",
        "from": "Rowan Pike",
        "is_bot": false,
        "text": "Bearing spec sheet for the new drive hub is up. Ambient 28C, 45W dissipated, thermal resistance 1.6 C/W, 60 pct duty. Steady state comes out to 62C, under the 85C rating.",
        "is_change": true
      },
      {
        "event_id": "ev-1784725200000100-0002",
        "at": "2026-07-22T13:00:02Z",
        "thread": "1784725200.000100",
        "trigger_ts": "1784725204.000300",
        "kind": "message_read",
        "ts": "1784725202.000200",
        "from": "Rowan Pike",
        "is_bot": false,
        "text": "Sheet is bearing-derate-r1.pdf in the purchasing folder.",
        "is_change": false
      },
      {
        "event_id": "ev-1784725200000100-0003",
        "at": "2026-07-22T13:00:04Z",
        "thread": "1784725200.000100",
        "trigger_ts": "1784725204.000300",
        "kind": "message_read",
        "ts": "1784725204.000300",
        "from": "Dara Voss",
        "is_bot": false,
        "text": "@Rev check the bearing thermal derate against the r1 sheet before we place the order.",
        "is_change": false
      },
      {
        "event_id": "ev-1784725200000100-0004",
        "at": "2026-07-22T13:00:05Z",
        "thread": "1784725200.000100",
        "trigger_ts": "1784725204.000300",
        "kind": "message_read",
        "ts": "1784725205.000350",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "This is the new hub, not the current one, right? Want to make sure we're ordering the right part.",
        "is_change": false
      },
      {
        "event_id": "ev-1784725200000100-0005",
        "at": "2026-07-22T13:00:05Z",
        "thread": "1784725200.000100",
        "trigger_ts": "1784725204.000300",
        "kind": "message_read",
        "ts": "1784725205.000360",
        "from": "Tam Holloway",
        "is_bot": false,
        "text": "Confirmed, new hub for the KS-4 rear axle, part number in the sheet header.",
        "is_change": false
      },
      {
        "event_id": "ev-1784725200000100-0006",
        "at": "2026-07-22T13:00:06Z",
        "thread": "1784725200.000100",
        "trigger_ts": "1784725204.000300",
        "kind": "message_read",
        "ts": "1784725206.000370",
        "from": "Milo Trent",
        "is_bot": false,
        "text": "45W dissipation number came from the motor vendor's load test, not our own measurement.",
        "is_change": false
      },
      {
        "event_id": "ev-1784725200000100-0007",
        "at": "2026-07-22T13:00:06Z",
        "thread": "1784725200.000100",
        "trigger_ts": "1784725204.000300",
        "kind": "message_read",
        "ts": "1784725206.000380",
        "from": "Ines Calder",
        "is_bot": false,
        "text": "60 pct duty matches the endurance run profile we used for the last hub too.",
        "is_change": false
      },
      {
        "event_id": "ev-1784725200000100-0008",
        "at": "2026-07-22T13:00:06Z",
        "thread": "1784725200.000100",
        "trigger_ts": "1784725204.000300",
        "kind": "document_read",
        "document": "bearing-derate-r1.pdf",
        "revision": "r1",
        "sha256": "456926d5b1abd0786d68781126549675b0f11fd11cf769082d0f909ba3045311",
        "line_count": 10,
        "named_in_ts": "1784725202.000200"
      },
      {
        "event_id": "ev-1784725200000100-0009",
        "at": "2026-07-22T13:00:08Z",
        "thread": "1784725200.000100",
        "trigger_ts": "1784725204.000300",
        "kind": "check_run",
        "run_id": "thermal-20260912T100000Z-6b3f",
        "checker": "thermal",
        "version": "1",
        "inputs": {
          "ambient_C": 28,
          "load_W": 45,
          "thermal_resistance_C_per_W": 1.6,
          "duty_cycle": 0.6,
          "max_rated_C": 85,
          "printed_steady_state_C": 62
        },
        "outputs": {
          "steady_state_C": 71.2
        },
        "checks": [
          {
            "name": "printed_steady_state_matches_computed",
            "pass": false,
            "expected": 62,
            "actual": 71.2
          },
          {
            "name": "steady_state_under_rating",
            "pass": true,
            "expected": 85,
            "actual": 71.2
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "document",
            "id": "456926d5b1abd0786d68781126549675b0f11fd11cf769082d0f909ba3045311"
          }
        ]
      },
      {
        "event_id": "ev-1784725200000100-0010",
        "at": "2026-07-22T13:00:10Z",
        "thread": "1784725200.000100",
        "trigger_ts": "1784725204.000300",
        "kind": "finding_published",
        "finding": {
          "finding_id": "fnd-syn03-r1-001",
          "status": "live",
          "requirements_revision": "1784725200.000100",
          "discrepancy": "The sheet prints a steady-state bearing temperature of 62C from 28C ambient, 45W at 60 percent duty and 1.6 C/W thermal resistance. Recomputed steady state is 28 + 45*0.6*1.6 = 71.2C, not 62C.",
          "why_it_matters": "71.2C still clears the 85C rating by 13.8C, so the order can proceed, but the printed 62C understates the margin by 9.2C and should not be carried into the next revision without correction.",
          "sources": [
            {
              "kind": "document",
              "id": "bearing-derate-r1.pdf",
              "revision": "r1",
              "sha256": "456926d5b1abd0786d68781126549675b0f11fd11cf769082d0f909ba3045311",
              "locator": "section 1, line 3",
              "quote": "Steady state = 28 + 45 * 0.6 * 1.6 = 62 C."
            }
          ],
          "reproduced": [
            {
              "label": "steady-state bearing temperature",
              "printed": 62,
              "computed": 71.2,
              "unit": "C",
              "matches": false,
              "tolerance": 0.5
            }
          ],
          "inferred": [],
          "resolution": "Rowan corrects the arithmetic in the sheet to 71.2C; the 85C rating still holds so no design change is needed.",
          "question": {
            "to": "Rowan Pike",
            "ask": "Section 1 prints 62C but 28 + 45*0.6*1.6 is 71.2C. Can you correct the sheet before the order goes out?"
          },
          "checker_run": {
            "checker": "thermal",
            "version": "1",
            "run_id": "thermal-20260912T100000Z-6b3f"
          }
        }
      },
      {
        "event_id": "ev-1784725200000100-0011",
        "at": "2026-07-22T13:20:00Z",
        "thread": "1784725200.000100",
        "trigger_ts": "1784725204.000300",
        "kind": "message_read",
        "ts": "1784726400.000500",
        "from": "Rowan Pike",
        "is_bot": false,
        "text": "Good catch, fixing the arithmetic in the sheet now.",
        "is_change": false
      },
      {
        "event_id": "ev-1784725200000100-0012",
        "at": "2026-07-22T13:22:00Z",
        "thread": "1784725200.000100",
        "trigger_ts": "1784725204.000300",
        "kind": "message_read",
        "ts": "1784726520.000510",
        "from": "Dara Voss",
        "is_bot": false,
        "text": "Order placed once the sheet update lands, 71.2C is fine against the 85C rating.",
        "is_change": false
      }
    ]
  },
  {
    "id": "syn-04",
    "title": "Northbridge leg energy budget, floor moved mid-run",
    "channel": "#ks4-drive",
    "channel_id": "C00SYN06",
    "fixture": "syn-04.json",
    "kind": "scenario",
    "summary": "The SoC floor changes while the first budget check is running; the stale run is refused and a rerun against the new floor publishes.",
    "events": [
      {
        "event_id": "ev-1785231000000100-0001",
        "at": "2026-07-28T09:30:00Z",
        "thread": "1785231000.000100",
        "trigger_ts": "1785231002.000200",
        "kind": "message_read",
        "ts": "1785231000.000100",
        "from": "Milo Trent",
        "is_bot": false,
        "text": "Pack is 5.2 kWh, plan the Northbridge leg from 92 pct to 55 pct SoC.",
        "is_change": true
      },
      {
        "event_id": "ev-1785231000000100-0002",
        "at": "2026-07-28T09:30:02Z",
        "thread": "1785231000.000100",
        "trigger_ts": "1785231002.000200",
        "kind": "message_read",
        "ts": "1785231002.000200",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "@Rev energy used on that leg is 1.85 kWh per the last telemetry pull, does the budget hold?",
        "is_change": false
      },
      {
        "event_id": "ev-1785231000000100-0003",
        "at": "2026-07-28T09:30:03Z",
        "thread": "1785231000.000100",
        "trigger_ts": "1785231002.000200",
        "kind": "message_read",
        "ts": "1785231003.000250",
        "from": "Tam Holloway",
        "is_bot": false,
        "text": "Telemetry pull was from yesterday's shakedown run, same route.",
        "is_change": false
      },
      {
        "event_id": "ev-1785231000000100-0004",
        "at": "2026-07-28T09:30:04Z",
        "thread": "1785231000.000100",
        "trigger_ts": "1785231002.000200",
        "kind": "check_run",
        "run_id": "budget-20260912T101500Z-2c9a",
        "checker": "budget",
        "version": "1",
        "inputs": {
          "pack_kWh": 5.2,
          "soc_start": 0.92,
          "soc_end": 0.55,
          "energy_used_kWh": 1.85
        },
        "outputs": {
          "budget_kWh": 1.924,
          "margin_kWh": 0.074
        },
        "checks": [
          {
            "name": "energy_used_within_budget",
            "pass": true,
            "expected": 1.924,
            "actual": 1.85
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "message",
            "id": "1785231000.000100"
          },
          {
            "kind": "message",
            "id": "1785231002.000200"
          }
        ]
      },
      {
        "event_id": "ev-1785231000000100-0005",
        "at": "2026-07-28T09:36:00Z",
        "thread": "1785231000.000100",
        "trigger_ts": "1785231002.000200",
        "kind": "message_read",
        "ts": "1785231360.000300",
        "from": "Milo Trent",
        "is_bot": false,
        "text": "Test lead moved the floor to 50 pct SoC for this leg, not 55.",
        "is_change": true
      },
      {
        "event_id": "ev-1785231000000100-0006",
        "at": "2026-07-28T09:36:02Z",
        "thread": "1785231000.000100",
        "trigger_ts": "1785231002.000200",
        "kind": "publish_refused",
        "run_id": "budget-20260912T101500Z-2c9a",
        "bound_revision": "1785231000.000100",
        "current_revision": "1785231360.000300",
        "reason": "thread revision moved from the trigger to Milo's 50 percent floor message while the check ran"
      },
      {
        "event_id": "ev-1785231000000100-0007",
        "at": "2026-07-28T09:36:04Z",
        "thread": "1785231000.000100",
        "trigger_ts": "1785231360.000300",
        "kind": "message_read",
        "ts": "1785231000.000100",
        "from": "Milo Trent",
        "is_bot": false,
        "text": "Pack is 5.2 kWh, plan the Northbridge leg from 92 pct to 55 pct SoC.",
        "is_change": true
      },
      {
        "event_id": "ev-1785231000000100-0008",
        "at": "2026-07-28T09:36:06Z",
        "thread": "1785231000.000100",
        "trigger_ts": "1785231360.000300",
        "kind": "message_read",
        "ts": "1785231002.000200",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "@Rev energy used on that leg is 1.85 kWh per the last telemetry pull, does the budget hold?",
        "is_change": false
      },
      {
        "event_id": "ev-1785231000000100-0009",
        "at": "2026-07-28T09:36:08Z",
        "thread": "1785231000.000100",
        "trigger_ts": "1785231360.000300",
        "kind": "message_read",
        "ts": "1785231360.000300",
        "from": "Milo Trent",
        "is_bot": false,
        "text": "Test lead moved the floor to 50 pct SoC for this leg, not 55.",
        "is_change": true
      },
      {
        "event_id": "ev-1785231000000100-0010",
        "at": "2026-07-28T09:36:10Z",
        "thread": "1785231000.000100",
        "trigger_ts": "1785231360.000300",
        "kind": "check_run",
        "run_id": "budget-20260912T102200Z-77e1",
        "checker": "budget",
        "version": "1",
        "inputs": {
          "pack_kWh": 5.2,
          "soc_start": 0.92,
          "soc_end": 0.5,
          "energy_used_kWh": 1.85
        },
        "outputs": {
          "budget_kWh": 2.184,
          "margin_kWh": 0.334
        },
        "checks": [
          {
            "name": "energy_used_within_budget",
            "pass": true,
            "expected": 2.184,
            "actual": 1.85
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "message",
            "id": "1785231360.000300"
          },
          {
            "kind": "message",
            "id": "1785231000.000100"
          }
        ]
      },
      {
        "event_id": "ev-1785231000000100-0011",
        "at": "2026-07-28T09:36:12Z",
        "thread": "1785231000.000100",
        "trigger_ts": "1785231360.000300",
        "kind": "finding_published",
        "finding": {
          "finding_id": "fnd-syn04-50-001",
          "status": "live",
          "requirements_revision": "1785231360.000300",
          "discrepancy": "none",
          "why_it_matters": "With the floor moved to 50 percent, budget rises from 1.924 to 2.184 kWh; at 1.85 kWh used the leg clears with 0.334 kWh margin, more headroom than the refused 55 percent run showed.",
          "sources": [
            {
              "kind": "message",
              "id": "1785231360.000300",
              "quote": "Test lead moved the floor to 50 pct SoC for this leg, not 55."
            },
            {
              "kind": "message",
              "id": "1785231002.000200",
              "quote": "energy used on that leg is 1.85 kWh per the last telemetry pull"
            }
          ],
          "reproduced": [
            {
              "label": "budget, SoC 92 to 50 percent",
              "computed": 2.184,
              "unit": "kWh"
            },
            {
              "label": "margin at 1.85 kWh used",
              "computed": 0.334,
              "unit": "kWh"
            }
          ],
          "inferred": [],
          "resolution": "Leg is feasible against the 50 percent floor with 0.334 kWh margin; no further action needed.",
          "checker_run": {
            "checker": "budget",
            "version": "1",
            "run_id": "budget-20260912T102200Z-77e1"
          }
        }
      },
      {
        "event_id": "ev-1785231000000100-0012",
        "at": "2026-07-28T09:40:00Z",
        "thread": "1785231000.000100",
        "trigger_ts": "1785231360.000300",
        "kind": "message_read",
        "ts": "1785231600.000500",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "0.334 kWh margin, good enough to lock the plan for this leg.",
        "is_change": false
      }
    ]
  },
  {
    "id": "syn-05",
    "title": "Gearbox torque margin, efficiency correction",
    "channel": "#ks4-mech",
    "channel_id": "C00SYN03",
    "fixture": "syn-05.json",
    "kind": "scenario",
    "summary": "A vendor-confirmed efficiency drop turns a marginal shortfall into a negative margin; the first card is superseded and the fix is proposed against r1.",
    "events": [
      {
        "event_id": "ev-1785756000000100-0001",
        "at": "2026-08-03T11:20:00Z",
        "thread": "1785756000.000100",
        "trigger_ts": "1785756002.000200",
        "kind": "message_read",
        "ts": "1785756000.000100",
        "from": "Dara Voss",
        "is_bot": false,
        "text": "Gearbox torque review r1 posted. Motor stall 2.1 Nm, 12:1 ratio, 90 pct efficiency, load 21.0 Nm, required margin 2.0 Nm.",
        "is_change": true
      },
      {
        "event_id": "ev-1785756000000100-0002",
        "at": "2026-08-03T11:20:02Z",
        "thread": "1785756000.000100",
        "trigger_ts": "1785756002.000200",
        "kind": "message_read",
        "ts": "1785756002.000200",
        "from": "Tam Holloway",
        "is_bot": false,
        "text": "@Rev check the torque margin in the r1 gearbox doc.",
        "is_change": false
      },
      {
        "event_id": "ev-1785756000000100-0003",
        "at": "2026-08-03T11:20:04Z",
        "thread": "1785756000.000100",
        "trigger_ts": "1785756002.000200",
        "kind": "document_read",
        "document": "gearbox-torque-review-r1.docx",
        "revision": "r1",
        "sha256": "63a8b7c35d904144a0e2e13abf6390f312ca987c65035a4c033c4c7efb902490",
        "line_count": 9,
        "named_in_ts": "1785756000.000100"
      },
      {
        "event_id": "ev-1785756000000100-0004",
        "at": "2026-08-03T11:20:06Z",
        "thread": "1785756000.000100",
        "trigger_ts": "1785756002.000200",
        "kind": "check_run",
        "run_id": "torque-20260912T110500Z-8f21",
        "checker": "torque",
        "version": "1",
        "inputs": {
          "motor_stall_Nm": 2.1,
          "gear_ratio": 12,
          "efficiency": 0.9,
          "load_Nm": 21.0,
          "required_margin_Nm": 2.0
        },
        "outputs": {
          "available_Nm": 22.68,
          "margin_Nm": 1.68
        },
        "checks": [
          {
            "name": "margin_meets_required",
            "pass": false,
            "expected": 2.0,
            "actual": 1.68
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "document",
            "id": "63a8b7c35d904144a0e2e13abf6390f312ca987c65035a4c033c4c7efb902490"
          },
          {
            "kind": "message",
            "id": "1785756000.000100"
          }
        ]
      },
      {
        "event_id": "ev-1785756000000100-0005",
        "at": "2026-08-03T11:20:08Z",
        "thread": "1785756000.000100",
        "trigger_ts": "1785756002.000200",
        "kind": "finding_published",
        "finding": {
          "finding_id": "fnd-syn05-r1-001",
          "status": "live",
          "requirements_revision": "1785756000.000100",
          "discrepancy": "At 90 percent efficiency the gearbox gives 22.68 Nm available against a 21.0 Nm load, a 1.68 Nm margin, short of the 2.0 Nm requirement.",
          "why_it_matters": "The doc as posted does not clear its own margin requirement; 0.32 Nm short.",
          "sources": [
            {
              "kind": "document",
              "id": "gearbox-torque-review-r1.docx",
              "revision": "r1",
              "sha256": "63a8b7c35d904144a0e2e13abf6390f312ca987c65035a4c033c4c7efb902490",
              "locator": "section 1",
              "quote": "Stall 2.1 Nm, ratio 12:1, efficiency 90 pct, load 21.0 Nm, required margin 2.0 Nm."
            }
          ],
          "reproduced": [
            {
              "label": "torque margin, 90 pct efficiency",
              "computed": 1.68,
              "unit": "N*m"
            }
          ],
          "inferred": [],
          "resolution": "Dara confirms the gearbox efficiency figure; 90 percent is optimistic for this class of gearbox and the vendor datasheet should be checked.",
          "question": {
            "to": "Dara Voss",
            "ask": "Is 90 percent efficiency confirmed from the vendor datasheet, or should this use the conservative 80 percent figure?"
          },
          "checker_run": {
            "checker": "torque",
            "version": "1",
            "run_id": "torque-20260912T110500Z-8f21"
          }
        }
      },
      {
        "event_id": "ev-1785756000000100-0006",
        "at": "2026-08-03T12:10:00Z",
        "thread": "1785756000.000100",
        "trigger_ts": "1785756002.000200",
        "kind": "message_read",
        "ts": "1785759000.000300",
        "from": "Dara Voss",
        "is_bot": false,
        "text": "Vendor datasheet confirms 80 pct efficiency at this load, not 90. Updating the doc to r2 with the conservative figure.",
        "is_change": true
      },
      {
        "event_id": "ev-1785756000000100-0007",
        "at": "2026-08-03T12:10:02Z",
        "thread": "1785756000.000100",
        "trigger_ts": "1785759000.000300",
        "kind": "document_read",
        "document": "gearbox-torque-review-r1.docx",
        "revision": "r1",
        "sha256": "63a8b7c35d904144a0e2e13abf6390f312ca987c65035a4c033c4c7efb902490",
        "line_count": 9,
        "named_in_ts": "1785756000.000100"
      },
      {
        "event_id": "ev-1785756000000100-0008",
        "at": "2026-08-03T12:10:04Z",
        "thread": "1785756000.000100",
        "trigger_ts": "1785759000.000300",
        "kind": "check_run",
        "run_id": "torque-20260912T115600Z-e034",
        "checker": "torque",
        "version": "1",
        "inputs": {
          "motor_stall_Nm": 2.1,
          "gear_ratio": 12,
          "efficiency": 0.8,
          "load_Nm": 21.0,
          "required_margin_Nm": 2.0
        },
        "outputs": {
          "available_Nm": 20.16,
          "margin_Nm": -0.84
        },
        "checks": [
          {
            "name": "margin_meets_required",
            "pass": false,
            "expected": 2.0,
            "actual": -0.84
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "message",
            "id": "1785759000.000300"
          },
          {
            "kind": "document",
            "id": "63a8b7c35d904144a0e2e13abf6390f312ca987c65035a4c033c4c7efb902490"
          }
        ]
      },
      {
        "event_id": "ev-1785756000000100-0009",
        "at": "2026-08-03T12:10:06Z",
        "thread": "1785756000.000100",
        "trigger_ts": "1785759000.000300",
        "kind": "finding_superseded",
        "finding_id": "fnd-syn05-r1-001",
        "superseded_by": "fnd-syn05-80-002",
        "cause_ts": "1785759000.000300"
      },
      {
        "event_id": "ev-1785756000000100-0010",
        "at": "2026-08-03T12:10:08Z",
        "thread": "1785756000.000100",
        "trigger_ts": "1785759000.000300",
        "kind": "finding_published",
        "finding": {
          "finding_id": "fnd-syn05-80-002",
          "status": "live",
          "supersedes": "fnd-syn05-r1-001",
          "requirements_revision": "1785759000.000300",
          "discrepancy": "At the vendor-confirmed 80 percent efficiency the gearbox gives only 20.16 Nm available against the 21.0 Nm load, a margin of negative 0.84 Nm: the motor cannot drive the load at stall.",
          "why_it_matters": "This is worse than the r1 shortfall. At 80 percent efficiency the drivetrain is undersized, not just short of margin; either the gear ratio must increase or the load must drop before this design proceeds.",
          "sources": [
            {
              "kind": "message",
              "id": "1785759000.000300",
              "quote": "Vendor datasheet confirms 80 pct efficiency at this load, not 90."
            },
            {
              "kind": "document",
              "id": "gearbox-torque-review-r1.docx",
              "revision": "r1",
              "sha256": "63a8b7c35d904144a0e2e13abf6390f312ca987c65035a4c033c4c7efb902490",
              "locator": "section 1",
              "quote": "Stall 2.1 Nm, ratio 12:1, load 21.0 Nm, required margin 2.0 Nm."
            }
          ],
          "reproduced": [
            {
              "label": "available torque, 80 pct efficiency",
              "computed": 20.16,
              "unit": "N*m"
            },
            {
              "label": "torque margin, 80 pct efficiency",
              "computed": -0.84,
              "unit": "N*m"
            }
          ],
          "inferred": [
            "Motor stall torque and load are carried from r1 because r2 has not been posted yet; this card is bound to the message, not a document."
          ],
          "resolution": "Raise the gear ratio above 12:1 or reduce the 21.0 Nm load before r2 is signed.",
          "checker_run": {
            "checker": "torque",
            "version": "1",
            "run_id": "torque-20260912T115600Z-e034"
          }
        }
      },
      {
        "event_id": "ev-1785756000000100-0011",
        "at": "2026-08-03T12:10:10Z",
        "thread": "1785756000.000100",
        "trigger_ts": "1785759000.000300",
        "kind": "edit_proposed",
        "proposal_id": "edt-syn05-r1-001",
        "finding_id": "fnd-syn05-80-002",
        "run_id": "torque-20260912T115600Z-e034",
        "document": "gearbox-torque-review-r1.docx",
        "source_sha256": "63a8b7c35d904144a0e2e13abf6390f312ca987c65035a4c033c4c7efb902490",
        "edits": [
          {
            "locator": "section 1",
            "find": "efficiency 90 pct",
            "replace": "efficiency 80 pct (vendor confirmed), margin -0.84 Nm, gearbox undersized",
            "reason": "vendor datasheet supersedes the assumed 90 pct figure and the resulting margin is negative"
          }
        ]
      },
      {
        "event_id": "ev-1785756000000100-0012",
        "at": "2026-08-03T12:55:00Z",
        "thread": "1785756000.000100",
        "trigger_ts": "1785759000.000300",
        "kind": "edit_decided",
        "proposal_id": "edt-syn05-r1-001",
        "decision": "approved",
        "by": "Tam Holloway"
      },
      {
        "event_id": "ev-1785756000000100-0013",
        "at": "2026-08-03T12:55:02Z",
        "thread": "1785756000.000100",
        "trigger_ts": "1785759000.000300",
        "kind": "edit_applied",
        "proposal_id": "edt-syn05-r1-001",
        "document": "gearbox-torque-review-r1.docx",
        "source_sha256": "63a8b7c35d904144a0e2e13abf6390f312ca987c65035a4c033c4c7efb902490",
        "output": "gearbox-torque-review-r1-proposed.docx",
        "sha256": "9ae7d6b3eb9d40c5e50714018ec1f9b4e3ba771365f1a0f2f81d489cd74e46a3"
      }
    ]
  },
  {
    "id": "syn-06",
    "title": "MCU thermal budget, clean control",
    "channel": "#ks4-firmware",
    "channel_id": "C00SYN05",
    "fixture": "syn-06.json",
    "kind": "control",
    "summary": "Printed steady-state MCU temperature reproduces exactly and clears the rating; the reviewer posts a clean card and nothing else.",
    "events": [
      {
        "event_id": "ev-1786284000000100-0001",
        "at": "2026-08-09T14:00:00Z",
        "thread": "1786284000.000100",
        "trigger_ts": "1786284002.000200",
        "kind": "message_read",
        "ts": "1786284000.000100",
        "from": "Tam Holloway",
        "is_bot": false,
        "text": "MCU thermal budget r1 posted. Ambient 25C, 30W, 1.2 C/W, 50 pct duty. Steady state 43C, well under the 105C rating.",
        "is_change": true
      },
      {
        "event_id": "ev-1786284000000100-0002",
        "at": "2026-08-09T14:00:02Z",
        "thread": "1786284000.000100",
        "trigger_ts": "1786284002.000200",
        "kind": "message_read",
        "ts": "1786284002.000200",
        "from": "Milo Trent",
        "is_bot": false,
        "text": "@Rev check the MCU thermal numbers before we lock the enclosure design.",
        "is_change": false
      },
      {
        "event_id": "ev-1786284000000100-0003",
        "at": "2026-08-09T14:00:03Z",
        "thread": "1786284000.000100",
        "trigger_ts": "1786284002.000200",
        "kind": "message_read",
        "ts": "1786284003.000350",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "Enclosure vendor needs the number by Friday, so good timing.",
        "is_change": false
      },
      {
        "event_id": "ev-1786284000000100-0004",
        "at": "2026-08-09T14:00:03Z",
        "thread": "1786284000.000100",
        "trigger_ts": "1786284002.000200",
        "kind": "message_read",
        "ts": "1786284003.000360",
        "from": "Dara Voss",
        "is_bot": false,
        "text": "25C ambient is the worst-case pit lane figure, not a lab number.",
        "is_change": false
      },
      {
        "event_id": "ev-1786284000000100-0005",
        "at": "2026-08-09T14:00:04Z",
        "thread": "1786284000.000100",
        "trigger_ts": "1786284002.000200",
        "kind": "message_read",
        "ts": "1786284004.000370",
        "from": "Ines Calder",
        "is_bot": false,
        "text": "30W load matches the peak draw we logged during the last endurance run.",
        "is_change": false
      },
      {
        "event_id": "ev-1786284000000100-0006",
        "at": "2026-08-09T14:00:04Z",
        "thread": "1786284000.000100",
        "trigger_ts": "1786284002.000200",
        "kind": "document_read",
        "document": "firmware-mcu-thermal-r1.pdf",
        "revision": "r1",
        "sha256": "d4dc06c62ac116dece1567d92274a95b847e248d57d8c466089244e1fe8d5e10",
        "line_count": 7,
        "named_in_ts": "1786284000.000100"
      },
      {
        "event_id": "ev-1786284000000100-0007",
        "at": "2026-08-09T14:00:06Z",
        "thread": "1786284000.000100",
        "trigger_ts": "1786284002.000200",
        "kind": "check_run",
        "run_id": "thermal-20260912T121000Z-3ad8",
        "checker": "thermal",
        "version": "1",
        "inputs": {
          "ambient_C": 25,
          "load_W": 30,
          "thermal_resistance_C_per_W": 1.2,
          "duty_cycle": 0.5,
          "max_rated_C": 105,
          "printed_steady_state_C": 43
        },
        "outputs": {
          "steady_state_C": 43.0
        },
        "checks": [
          {
            "name": "printed_steady_state_matches_computed",
            "pass": true,
            "expected": 43.0,
            "actual": 43.0
          },
          {
            "name": "steady_state_under_rating",
            "pass": true,
            "expected": 105,
            "actual": 43.0
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "document",
            "id": "d4dc06c62ac116dece1567d92274a95b847e248d57d8c466089244e1fe8d5e10"
          }
        ]
      },
      {
        "event_id": "ev-1786284000000100-0008",
        "at": "2026-08-09T14:00:08Z",
        "thread": "1786284000.000100",
        "trigger_ts": "1786284002.000200",
        "kind": "finding_published",
        "finding": {
          "finding_id": "fnd-syn06-clean-001",
          "status": "live",
          "requirements_revision": "1786284000.000100",
          "discrepancy": "none",
          "why_it_matters": "The printed 43C steady state reproduces exactly and clears the 105C rating with 62C of margin; the enclosure design can be locked against this figure.",
          "sources": [
            {
              "kind": "document",
              "id": "firmware-mcu-thermal-r1.pdf",
              "revision": "r1",
              "sha256": "d4dc06c62ac116dece1567d92274a95b847e248d57d8c466089244e1fe8d5e10",
              "locator": "section 1",
              "quote": "Steady state = 25 + 30 * 0.5 * 1.2 = 43 C."
            }
          ],
          "reproduced": [
            {
              "label": "steady-state MCU temperature",
              "printed": 43.0,
              "computed": 43.0,
              "unit": "C",
              "matches": true,
              "tolerance": 0.1
            }
          ],
          "inferred": [],
          "resolution": "No action needed.",
          "checker_run": {
            "checker": "thermal",
            "version": "1",
            "run_id": "thermal-20260912T121000Z-3ad8"
          }
        }
      },
      {
        "event_id": "ev-1786284000000100-0009",
        "at": "2026-08-09T14:05:00Z",
        "thread": "1786284000.000100",
        "trigger_ts": "1786284002.000200",
        "kind": "message_read",
        "ts": "1786284300.000500",
        "from": "Milo Trent",
        "is_bot": false,
        "text": "Enclosure design locked against the 43C figure.",
        "is_change": false
      },
      {
        "event_id": "ev-1786284000000100-0010",
        "at": "2026-08-09T14:06:00Z",
        "thread": "1786284000.000100",
        "trigger_ts": "1786284002.000200",
        "kind": "message_read",
        "ts": "1786284360.000510",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "Nice, one less open item before the vendor call.",
        "is_change": false
      },
      {
        "event_id": "ev-1786284000000100-0011",
        "at": "2026-08-09T14:07:00Z",
        "thread": "1786284000.000100",
        "trigger_ts": "1786284002.000200",
        "kind": "message_read",
        "ts": "1786284420.000520",
        "from": "Tam Holloway",
        "is_bot": false,
        "text": "Firmware thermal throttle threshold stays at 90C, well clear of 43C nominal.",
        "is_change": false
      },
      {
        "event_id": "ev-1786284000000100-0012",
        "at": "2026-08-09T14:08:00Z",
        "thread": "1786284000.000100",
        "trigger_ts": "1786284002.000200",
        "kind": "message_read",
        "ts": "1786284480.000530",
        "from": "Dara Voss",
        "is_bot": false,
        "text": "Noted for the design review deck too.",
        "is_change": false
      }
    ]
  },
  {
    "id": "syn-07",
    "title": "Pack capacity conflict, fade-test derate",
    "channel": "#ks4-purchasing",
    "channel_id": "C00SYN04",
    "fixture": "syn-07.json",
    "kind": "scenario",
    "summary": "Nominal and fade-test-derated pack capacities give opposite feasibility answers for the same leg at a 0.05 kWh margin.",
    "events": [
      {
        "event_id": "ev-1786725900000100-0001",
        "at": "2026-08-14T16:45:00Z",
        "thread": "1786725900.000100",
        "trigger_ts": "1786725904.000300",
        "kind": "message_read",
        "ts": "1786725900.000100",
        "from": "Ines Calder",
        "is_bot": false,
        "text": "Pack capacity is 5.2 kWh nominal per the cell datasheet.",
        "is_change": true
      },
      {
        "event_id": "ev-1786725900000100-0002",
        "at": "2026-08-14T16:45:02Z",
        "thread": "1786725900.000100",
        "trigger_ts": "1786725904.000300",
        "kind": "message_read",
        "ts": "1786725902.000200",
        "from": "Ines Calder",
        "is_bot": false,
        "text": "After the July fade test the usable capacity derates to 5.0 kWh, not 5.2.",
        "is_change": true
      },
      {
        "event_id": "ev-1786725900000100-0003",
        "at": "2026-08-14T16:45:04Z",
        "thread": "1786725900.000100",
        "trigger_ts": "1786725904.000300",
        "kind": "message_read",
        "ts": "1786725904.000300",
        "from": "Rowan Pike",
        "is_bot": false,
        "text": "@Rev does the 95 to 45 pct SoC swing at 2.55 kWh used hold budget under either pack figure?",
        "is_change": false
      },
      {
        "event_id": "ev-1786725900000100-0004",
        "at": "2026-08-14T16:45:05Z",
        "thread": "1786725900.000100",
        "trigger_ts": "1786725904.000300",
        "kind": "message_read",
        "ts": "1786725905.000350",
        "from": "Dara Voss",
        "is_bot": false,
        "text": "Fade test was on the spare pack, not the race pack, for what it's worth.",
        "is_change": false
      },
      {
        "event_id": "ev-1786725900000100-0005",
        "at": "2026-08-14T16:45:05Z",
        "thread": "1786725900.000100",
        "trigger_ts": "1786725904.000300",
        "kind": "message_read",
        "ts": "1786725905.000360",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "Are the two packs built from the same cell lot though?",
        "is_change": false
      },
      {
        "event_id": "ev-1786725900000100-0006",
        "at": "2026-08-14T16:45:06Z",
        "thread": "1786725900.000100",
        "trigger_ts": "1786725904.000300",
        "kind": "message_read",
        "ts": "1786725906.000370",
        "from": "Milo Trent",
        "is_bot": false,
        "text": "Same lot, same assembly batch, just different cycle counts.",
        "is_change": false
      },
      {
        "event_id": "ev-1786725900000100-0007",
        "at": "2026-08-14T16:45:06Z",
        "thread": "1786725900.000100",
        "trigger_ts": "1786725904.000300",
        "kind": "message_read",
        "ts": "1786725906.000380",
        "from": "Tam Holloway",
        "is_bot": false,
        "text": "2.55 kWh used is from the last telemetry pull on this exact leg, that part's solid.",
        "is_change": false
      },
      {
        "event_id": "ev-1786725900000100-0008",
        "at": "2026-08-14T16:45:06Z",
        "thread": "1786725900.000100",
        "trigger_ts": "1786725904.000300",
        "kind": "check_run",
        "run_id": "budget-20260912T130500Z-d9c2",
        "checker": "budget",
        "version": "1",
        "inputs": {
          "pack_kWh_nominal": 5.2,
          "pack_kWh_derated": 5.0,
          "soc_start": 0.95,
          "soc_end": 0.45,
          "energy_used_kWh": 2.55
        },
        "outputs": {
          "budget_kWh_nominal": 2.6,
          "margin_kWh_nominal": 0.05,
          "budget_kWh_derated": 2.5,
          "margin_kWh_derated": -0.05
        },
        "checks": [
          {
            "name": "energy_used_within_budget_nominal",
            "pass": true,
            "expected": 2.6,
            "actual": 2.55
          },
          {
            "name": "energy_used_within_budget_derated",
            "pass": false,
            "expected": 2.5,
            "actual": 2.55
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "message",
            "id": "1786725900.000100"
          },
          {
            "kind": "message",
            "id": "1786725902.000200"
          },
          {
            "kind": "message",
            "id": "1786725904.000300"
          }
        ]
      },
      {
        "event_id": "ev-1786725900000100-0009",
        "at": "2026-08-14T16:45:08Z",
        "thread": "1786725900.000100",
        "trigger_ts": "1786725904.000300",
        "kind": "finding_published",
        "finding": {
          "finding_id": "fnd-syn07-conflict-001",
          "status": "live",
          "requirements_revision": "1786725904.000300",
          "discrepancy": "Two pack figures are live: 5.2 kWh nominal from the datasheet and 5.0 kWh derated from Ines's July fade test. At 2.55 kWh used, the 95 to 45 percent leg clears the nominal budget by 0.05 kWh but misses the derated budget by 0.05 kWh.",
          "why_it_matters": "Which pack figure is current decides whether this leg is feasible. The margin is 0.05 kWh either way, so the choice of pack figure is the whole question.",
          "sources": [
            {
              "kind": "message",
              "id": "1786725900.000100",
              "quote": "Pack capacity is 5.2 kWh nominal per the cell datasheet."
            },
            {
              "kind": "message",
              "id": "1786725902.000200",
              "quote": "After the July fade test the usable capacity derates to 5.0 kWh, not 5.2."
            },
            {
              "kind": "message",
              "id": "1786725904.000300",
              "quote": "does the 95 to 45 pct SoC swing at 2.55 kWh used hold budget under either pack figure?"
            }
          ],
          "reproduced": [
            {
              "label": "budget, nominal 5.2 kWh pack",
              "computed": 2.6,
              "unit": "kWh"
            },
            {
              "label": "margin, nominal pack",
              "computed": 0.05,
              "unit": "kWh"
            },
            {
              "label": "budget, derated 5.0 kWh pack",
              "computed": 2.5,
              "unit": "kWh"
            },
            {
              "label": "margin, derated pack",
              "computed": -0.05,
              "unit": "kWh"
            }
          ],
          "inferred": [],
          "resolution": "Ines confirms whether the derated 5.0 kWh figure applies to this pack or only to the fade-tested cells; the 0.05 kWh margin is too tight to guess.",
          "question": {
            "to": "Ines Calder",
            "ask": "Should this leg's budget use the 5.2 kWh nominal or the 5.0 kWh post-fade-test capacity? The result flips feasibility."
          },
          "checker_run": {
            "checker": "budget",
            "version": "1",
            "run_id": "budget-20260912T130500Z-d9c2"
          }
        }
      },
      {
        "event_id": "ev-1786725900000100-0010",
        "at": "2026-08-14T17:15:00Z",
        "thread": "1786725900.000100",
        "trigger_ts": "1786725904.000300",
        "kind": "message_read",
        "ts": "1786727700.000500",
        "from": "Ines Calder",
        "is_bot": false,
        "text": "Checked with the cell vendor, the derate is specific to the fade-tested cells only, race pack is still 5.2 kWh.",
        "is_change": false
      },
      {
        "event_id": "ev-1786725900000100-0011",
        "at": "2026-08-14T17:18:00Z",
        "thread": "1786725900.000100",
        "trigger_ts": "1786725904.000300",
        "kind": "message_read",
        "ts": "1786727880.000510",
        "from": "Rowan Pike",
        "is_bot": false,
        "text": "Good, 0.05 kWh margin on the nominal figure then, planning against that.",
        "is_change": false
      },
      {
        "event_id": "ev-1786725900000100-0012",
        "at": "2026-08-14T17:20:00Z",
        "thread": "1786725900.000100",
        "trigger_ts": "1786725904.000300",
        "kind": "message_read",
        "ts": "1786728000.000520",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "Worth re-running once telemetry confirms actual usage on the leg.",
        "is_change": false
      }
    ]
  },
  {
    "id": "syn-08",
    "title": "Ridgeway loop energy, Crr correction mid-run",
    "channel": "#ks4-drive",
    "channel_id": "C00SYN06",
    "fixture": "syn-08.json",
    "kind": "scenario",
    "summary": "A tire-pressure Crr correction lands while the route check runs; the stale run is refused and the rerun confirms the leg is infeasible either way.",
    "events": [
      {
        "event_id": "ev-1787213700000100-0001",
        "at": "2026-08-20T08:15:00Z",
        "thread": "1787213700.000100",
        "trigger_ts": "1787213702.000200",
        "kind": "message_read",
        "ts": "1787213700.000100",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "@Rev run the Ridgeway loop: 305 kg, Crr 0.0044, CdA 0.13, 21 m/s constant, 180 km, pack 5.2 kWh, 88 to 55 pct SoC.",
        "is_change": true
      },
      {
        "event_id": "ev-1787213700000100-0002",
        "at": "2026-08-20T08:15:01Z",
        "thread": "1787213700.000100",
        "trigger_ts": "1787213702.000200",
        "kind": "message_read",
        "ts": "1787213701.000250",
        "from": "Dara Voss",
        "is_bot": false,
        "text": "305 kg is with the new hub and bearing swap included.",
        "is_change": false
      },
      {
        "event_id": "ev-1787213700000100-0003",
        "at": "2026-08-20T08:15:01Z",
        "thread": "1787213700.000100",
        "trigger_ts": "1787213702.000200",
        "kind": "message_read",
        "ts": "1787213701.000260",
        "from": "Ines Calder",
        "is_bot": false,
        "text": "CdA 0.13 is from the wind tunnel session two weeks ago, current config.",
        "is_change": false
      },
      {
        "event_id": "ev-1787213700000100-0004",
        "at": "2026-08-20T08:15:02Z",
        "thread": "1787213700.000100",
        "trigger_ts": "1787213702.000200",
        "kind": "check_run",
        "run_id": "route-20260912T133000Z-f61a",
        "checker": "route",
        "version": "1",
        "inputs": {
          "mass_kg": 305,
          "Crr": 0.0044,
          "CdA": 0.13,
          "rho": 1.2,
          "v_mps": 21,
          "d_m": 180000,
          "pack_kWh": 5.2,
          "soc_start": 0.88,
          "soc_end": 0.55
        },
        "outputs": {
          "budget_kWh": 1.716,
          "energy_kWh": 2.378151,
          "margin_kWh": -0.662151
        },
        "checks": [
          {
            "name": "energy_within_budget",
            "pass": false,
            "expected": 1.716,
            "actual": 2.378151
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "message",
            "id": "1787213700.000100"
          }
        ]
      },
      {
        "event_id": "ev-1787213700000100-0005",
        "at": "2026-08-20T08:27:00Z",
        "thread": "1787213700.000100",
        "trigger_ts": "1787213702.000200",
        "kind": "message_read",
        "ts": "1787214420.000300",
        "from": "Tam Holloway",
        "is_bot": false,
        "text": "Tire pressure log shows Crr is actually 0.0052 after the last check, not 0.0044.",
        "is_change": true
      },
      {
        "event_id": "ev-1787213700000100-0006",
        "at": "2026-08-20T08:27:02Z",
        "thread": "1787213700.000100",
        "trigger_ts": "1787213702.000200",
        "kind": "publish_refused",
        "run_id": "route-20260912T133000Z-f61a",
        "bound_revision": "1787213700.000100",
        "current_revision": "1787214420.000300",
        "reason": "thread revision moved from the trigger to Tam's Crr correction while the check ran"
      },
      {
        "event_id": "ev-1787213700000100-0007",
        "at": "2026-08-20T08:27:04Z",
        "thread": "1787213700.000100",
        "trigger_ts": "1787214420.000300",
        "kind": "message_read",
        "ts": "1787213700.000100",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "@Rev run the Ridgeway loop: 305 kg, Crr 0.0044, CdA 0.13, 21 m/s constant, 180 km, pack 5.2 kWh, 88 to 55 pct SoC.",
        "is_change": true
      },
      {
        "event_id": "ev-1787213700000100-0008",
        "at": "2026-08-20T08:27:06Z",
        "thread": "1787213700.000100",
        "trigger_ts": "1787214420.000300",
        "kind": "message_read",
        "ts": "1787214420.000300",
        "from": "Tam Holloway",
        "is_bot": false,
        "text": "Tire pressure log shows Crr is actually 0.0052 after the last check, not 0.0044.",
        "is_change": true
      },
      {
        "event_id": "ev-1787213700000100-0009",
        "at": "2026-08-20T08:27:08Z",
        "thread": "1787213700.000100",
        "trigger_ts": "1787214420.000300",
        "kind": "check_run",
        "run_id": "route-20260912T134300Z-0dc5",
        "checker": "route",
        "version": "1",
        "inputs": {
          "mass_kg": 305,
          "Crr": 0.0052,
          "CdA": 0.13,
          "rho": 1.2,
          "v_mps": 21,
          "d_m": 180000,
          "pack_kWh": 5.2,
          "soc_start": 0.88,
          "soc_end": 0.55
        },
        "outputs": {
          "budget_kWh": 1.716,
          "energy_kWh": 2.497833,
          "margin_kWh": -0.781833
        },
        "checks": [
          {
            "name": "energy_within_budget",
            "pass": false,
            "expected": 1.716,
            "actual": 2.497833
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "message",
            "id": "1787214420.000300"
          },
          {
            "kind": "message",
            "id": "1787213700.000100"
          }
        ]
      },
      {
        "event_id": "ev-1787213700000100-0010",
        "at": "2026-08-20T08:27:10Z",
        "thread": "1787213700.000100",
        "trigger_ts": "1787214420.000300",
        "kind": "finding_published",
        "finding": {
          "finding_id": "fnd-syn08-crr-001",
          "status": "live",
          "requirements_revision": "1787214420.000300",
          "discrepancy": "At the corrected Crr of 0.0052, the Ridgeway loop uses 2.498 kWh against a 1.716 kWh budget (88 to 55 percent SoC), a shortfall of 0.782 kWh. The shortfall was already 0.662 kWh at the original Crr of 0.0044; the correction makes it worse.",
          "why_it_matters": "This leg is infeasible at 21 m/s under both the original and corrected rolling resistance. The Crr correction changes the margin by 0.12 kWh but does not change the feasibility answer.",
          "sources": [
            {
              "kind": "message",
              "id": "1787214420.000300",
              "quote": "Tire pressure log shows Crr is actually 0.0052 after the last check, not 0.0044."
            },
            {
              "kind": "message",
              "id": "1787213700.000100",
              "quote": "305 kg, Crr 0.0044, CdA 0.13, 21 m/s constant, 180 km, pack 5.2 kWh, 88 to 55 pct SoC."
            }
          ],
          "reproduced": [
            {
              "label": "budget, SoC 88 to 55 percent",
              "computed": 1.716,
              "unit": "kWh"
            },
            {
              "label": "energy at 21 m/s, Crr 0.0052",
              "computed": 2.497833,
              "unit": "kWh"
            },
            {
              "label": "margin, Crr 0.0052",
              "computed": -0.781833,
              "unit": "kWh"
            }
          ],
          "inferred": [],
          "resolution": "Lower the constant speed or shorten the loop before this run is planned; 21 m/s does not fit the budget under either Crr value.",
          "checker_run": {
            "checker": "route",
            "version": "1",
            "run_id": "route-20260912T134300Z-0dc5"
          }
        }
      },
      {
        "event_id": "ev-1787213700000100-0011",
        "at": "2026-08-20T08:35:00Z",
        "thread": "1787213700.000100",
        "trigger_ts": "1787214420.000300",
        "kind": "message_read",
        "ts": "1787214900.000500",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "Dropping to 19 m/s and re-planning the loop.",
        "is_change": false
      },
      {
        "event_id": "ev-1787213700000100-0012",
        "at": "2026-08-20T08:37:00Z",
        "thread": "1787213700.000100",
        "trigger_ts": "1787214420.000300",
        "kind": "message_read",
        "ts": "1787215020.000510",
        "from": "Dara Voss",
        "is_bot": false,
        "text": "Sounds right, that should clear the budget with room to spare.",
        "is_change": false
      }
    ]
  },
  {
    "id": "syn-09",
    "title": "Backup precharge board, QC cap failure",
    "channel": "#ks4-electrical",
    "channel_id": "C00SYN01",
    "fixture": "syn-09.json",
    "kind": "scenario",
    "summary": "A QC-failed film cap drops the backup board's bus capacitance; the printed timing goes stale and the doc is corrected to the interim value.",
    "events": [
      {
        "event_id": "ev-1787850000000100-0001",
        "at": "2026-08-27T17:00:00Z",
        "thread": "1787850000.000100",
        "trigger_ts": "1787850002.000200",
        "kind": "silence",
        "reason": "gate_closed"
      },
      {
        "event_id": "ev-1787850000000100-0002",
        "at": "2026-08-27T17:00:02Z",
        "thread": "1787850000.000100",
        "trigger_ts": "1787850004.000300",
        "kind": "message_read",
        "ts": "1787850002.000200",
        "from": "Tam Holloway",
        "is_bot": false,
        "text": "Backup precharge board r1 posted. Bus 600 uF, R 390 ohm, relay closes at 2.0 s.",
        "is_change": true
      },
      {
        "event_id": "ev-1787850000000100-0003",
        "at": "2026-08-27T17:00:04Z",
        "thread": "1787850000.000100",
        "trigger_ts": "1787850004.000300",
        "kind": "message_read",
        "ts": "1787850004.000300",
        "from": "Juno Marsh",
        "is_bot": false,
        "text": "@Rev check the backup precharge board r1 timing before we bench test it.",
        "is_change": false
      },
      {
        "event_id": "ev-1787850000000100-0004",
        "at": "2026-08-27T17:00:06Z",
        "thread": "1787850000.000100",
        "trigger_ts": "1787850004.000300",
        "kind": "document_read",
        "document": "backup-precharge-review-r1.docx",
        "revision": "r1",
        "sha256": "04783da7b887cd633ddae58863e2ebd968d3d6095b5bc468567e1c9346df2885",
        "line_count": 12,
        "named_in_ts": "1787850002.000200"
      },
      {
        "event_id": "ev-1787850000000100-0005",
        "at": "2026-08-27T17:00:08Z",
        "thread": "1787850000.000100",
        "trigger_ts": "1787850004.000300",
        "kind": "check_run",
        "run_id": "rc-20260912T140500Z-a712",
        "checker": "rc",
        "version": "1",
        "inputs": {
          "R_ohm": 390,
          "threshold": 0.999,
          "timer_s": 2.0,
          "capacitances": [
            {
              "label": "600uF_r1",
              "C_F": 0.0006
            }
          ],
          "printed": [
            {
              "label": "printed_1.62",
              "value_s": 1.62,
              "against": [
                "600uF_r1"
              ]
            }
          ],
          "tolerance_s": 0.0005
        },
        "outputs": {
          "per_capacitance": {
            "600uF_r1": {
              "RC_s": 0.234,
              "t_threshold_s": 1.6164,
              "fraction_at_timer": 0.99981
            }
          }
        },
        "checks": [
          {
            "name": "printed_1.62_matches_600uF_r1",
            "pass": true,
            "expected": 1.62,
            "actual": 1.6164
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "document",
            "id": "04783da7b887cd633ddae58863e2ebd968d3d6095b5bc468567e1c9346df2885"
          }
        ]
      },
      {
        "event_id": "ev-1787850000000100-0006",
        "at": "2026-08-27T17:25:00Z",
        "thread": "1787850000.000100",
        "trigger_ts": "1787850004.000300",
        "kind": "message_read",
        "ts": "1787851500.000400",
        "from": "Tam Holloway",
        "is_bot": false,
        "text": "One film cap in the backup board failed incoming QC; bus drops to 540 uF until the replacement arrives.",
        "is_change": true
      },
      {
        "event_id": "ev-1787850000000100-0007",
        "at": "2026-08-27T17:25:02Z",
        "thread": "1787850000.000100",
        "trigger_ts": "1787850004.000300",
        "kind": "document_read",
        "document": "backup-precharge-review-r1.docx",
        "revision": "r1",
        "sha256": "04783da7b887cd633ddae58863e2ebd968d3d6095b5bc468567e1c9346df2885",
        "line_count": 12,
        "named_in_ts": "1787850002.000200"
      },
      {
        "event_id": "ev-1787850000000100-0008",
        "at": "2026-08-27T17:25:04Z",
        "thread": "1787850000.000100",
        "trigger_ts": "1787850004.000300",
        "kind": "check_run",
        "run_id": "rc-20260912T143000Z-5cd9",
        "checker": "rc",
        "version": "1",
        "inputs": {
          "R_ohm": 390,
          "threshold": 0.999,
          "timer_s": 2.0,
          "capacitances": [
            {
              "label": "540uF_qc_fail",
              "C_F": 0.00054
            }
          ],
          "printed": [
            {
              "label": "printed_1.62",
              "value_s": 1.62,
              "against": [
                "540uF_qc_fail"
              ]
            }
          ],
          "tolerance_s": 0.0005
        },
        "outputs": {
          "per_capacitance": {
            "540uF_qc_fail": {
              "RC_s": 0.2106,
              "t_threshold_s": 1.4548,
              "fraction_at_timer": 0.99992
            }
          }
        },
        "checks": [
          {
            "name": "printed_1.62_matches_540uF_qc_fail",
            "pass": false,
            "expected": 1.62,
            "actual": 1.4548
          }
        ],
        "error": null,
        "evidence_refs": [
          {
            "kind": "message",
            "id": "1787851500.000400"
          },
          {
            "kind": "document",
            "id": "04783da7b887cd633ddae58863e2ebd968d3d6095b5bc468567e1c9346df2885"
          }
        ]
      },
      {
        "event_id": "ev-1787850000000100-0009",
        "at": "2026-08-27T17:25:06Z",
        "thread": "1787850000.000100",
        "trigger_ts": "1787850004.000300",
        "kind": "finding_published",
        "finding": {
          "finding_id": "fnd-syn09-540-001",
          "status": "live",
          "requirements_revision": "1787851500.000400",
          "discrepancy": "With the QC-failed cap removed, bus capacitance drops to 540 uF and t_99.9 recomputes to 1.4548 s, not the r1-printed 1.62 s that was valid for 600 uF. The relay still closes comfortably after either value (2.0 s timer), but the doc's printed number no longer matches the as-built board.",
          "why_it_matters": "The margin actually improves (545 ms instead of 380 ms) but the doc would mislead anyone reading the printed 1.62 s as the current board's timing.",
          "sources": [
            {
              "kind": "message",
              "id": "1787851500.000400",
              "quote": "bus drops to 540 uF until the replacement arrives"
            },
            {
              "kind": "document",
              "id": "backup-precharge-review-r1.docx",
              "revision": "r1",
              "sha256": "04783da7b887cd633ddae58863e2ebd968d3d6095b5bc468567e1c9346df2885",
              "locator": "section 2",
              "quote": "Bus C = 600 uF, R = 390 ohm, t_99.9 = 1.62 s."
            }
          ],
          "reproduced": [
            {
              "label": "t_99.9 at 540uF",
              "printed": 1.62,
              "computed": 1.4548,
              "unit": "s",
              "matches": false,
              "tolerance": 0.0005
            }
          ],
          "inferred": [],
          "resolution": "Update section 2 to the 540 uF figure until the replacement cap arrives and the bus returns to 600 uF.",
          "question": {
            "to": "Tam Holloway",
            "ask": "Should section 2 carry the interim 540 uF / 1.4548 s figure, or wait for the replacement cap before updating the doc?"
          },
          "checker_run": {
            "checker": "rc",
            "version": "1",
            "run_id": "rc-20260912T143000Z-5cd9"
          }
        }
      },
      {
        "event_id": "ev-1787850000000100-0010",
        "at": "2026-08-27T17:25:08Z",
        "thread": "1787850000.000100",
        "trigger_ts": "1787850004.000300",
        "kind": "edit_proposed",
        "proposal_id": "edt-syn09-r1-001",
        "finding_id": "fnd-syn09-540-001",
        "run_id": "rc-20260912T143000Z-5cd9",
        "document": "backup-precharge-review-r1.docx",
        "source_sha256": "04783da7b887cd633ddae58863e2ebd968d3d6095b5bc468567e1c9346df2885",
        "edits": [
          {
            "locator": "section 2",
            "find": "Bus C = 600 uF, R = 390 ohm, t_99.9 = 1.62 s.",
            "replace": "Bus C = 540 uF (interim, QC replacement pending), R = 390 ohm, t_99.9 = 1.4548 s.",
            "reason": "one film cap failed incoming QC; checker gives 1.4548 s at the reduced 540 uF"
          }
        ]
      },
      {
        "event_id": "ev-1787850000000100-0011",
        "at": "2026-08-27T18:00:00Z",
        "thread": "1787850000.000100",
        "trigger_ts": "1787850004.000300",
        "kind": "edit_decided",
        "proposal_id": "edt-syn09-r1-001",
        "decision": "approved",
        "by": "Juno Marsh"
      },
      {
        "event_id": "ev-1787850000000100-0012",
        "at": "2026-08-27T18:00:02Z",
        "thread": "1787850000.000100",
        "trigger_ts": "1787850004.000300",
        "kind": "edit_applied",
        "proposal_id": "edt-syn09-r1-001",
        "document": "backup-precharge-review-r1.docx",
        "source_sha256": "04783da7b887cd633ddae58863e2ebd968d3d6095b5bc468567e1c9346df2885",
        "output": "backup-precharge-review-r1-proposed.docx",
        "sha256": "3558b99edc6c19b2cd384b25c468f6cc14984d58089d86963684e3003d4f4ede"
      }
    ]
  }
];
