# Agent brief: synthetic fixtures (W1)

Project: ThreadRev, a Slack-native engineering change reviewer. Agents, Everywhere hackathon, deadline 5 PM EDT today, September 12, 2026. Repo: https://github.com/gabegraves/ThreadRev (private, `main`).

You own **W1**, the synthetic fixture assets. No credentials, no application code. The submission package belongs to the human owner of `research/handoff-demo-narrative.md`; do not write under `submission/` or edit `SUBMISSION.md`.

## Read first, in this order

1. `research/synthetic-fixture-spec.md`, all of it. Every number, name, channel, and message you produce comes from here. It is the only source. Section 6 lists what must never appear.
2. `contracts/checker-io.md` and `contracts/examples/`, so your documents contain exactly the values the checker will recompute.

## Rules

- Commit and push to `origin main` after every file that is done. Small commits, no batching. Pull before you push.
- Fictional data only. The team is Kestrel Solar Racing at the fictional Halvern Institute. If a name, number, supplier, or part is not in the spec, invent one that is obviously fictional.
- Do not edit anything under `apps/`, `packages/`, or `checkers/`. If a fixture needs the spec changed, say so in your commit message and tell the integration owner; do not silently diverge.
- No credentials, no real Slack IDs, no real people.

## W1. Fixture assets

Output directory: `fixtures/`. Layout:

```
fixtures/
  README.md                       what each file is, which scenario and replay case uses it
  documents/
    precharge-review-r2.docx      Scenario A, all five sections exactly as the spec states them, including both planted errors
    precharge-review-r2-clean.docx  RC1, same document with the three corrections from spec section 5
    ks4-sim-inputs-v2-0.xlsx      Scenario B, sheet `params`, rows 2 to 5
    ks4-sim-inputs-v2-1.xlsx      Scenario B, plus change note in cell A8
    ks4-hv-interface-req-r1.xlsx  optional, only if time allows
  slack/
    scenario-a.json               ordered message list
    scenario-b.json
    rc1-clean.json
    rc2-conflict.json
    rc3-midrun.json
  SHA256SUMS                      sha256 of every file under documents/
```

Slack message JSON shape, one object per message, in spec order:

```json
{
  "ts": "1787062320.000100",
  "channel": "C00SYN01",
  "channel_name": "ks4-electrical",
  "user": "U00SYN01",
  "user_name": "Dara Voss",
  "thread_ts": null,
  "text": "Precharge board r2 review doc is up. Dropped one film cap, bus is now 680 uF.",
  "files": ["documents/precharge-review-r2.docx"],
  "role": "seed"
}
```

`role` is one of `seed`, `trigger`, `change`, `evaluator_only`. `thread_ts` is the parent `ts` for replies. Use the exact `ts`, IDs, and text from the spec. Messages the spec marks as belonging to the evaluator get `evaluator_only`.

Documents: generate with python-docx and openpyxl, or write them by hand in Word and Excel. Either is fine. What matters is that the text inside matches the spec verbatim, because the reviewer extracts values from it. After generating, run `shasum -a 256 fixtures/documents/* > fixtures/SHA256SUMS` and commit the sums.

Acceptance for W1:

- A reader can open each document and find every value the spec lists in the stated section.
- `python3 -c "import json;[json.load(open(f'fixtures/slack/{n}.json')) for n in ['scenario-a','scenario-b','rc1-clean','rc2-conflict','rc3-midrun']]"` exits 0.
- `grep -rniE 'clickup|notion|srsim' fixtures/` returns nothing.
- `fixtures/README.md` maps every file to a scenario or replay case.

## Report back

When done, one message: list of files committed with commit hashes, the acceptance checks you ran with their output, and anything in the spec you found ambiguous or had to change.
