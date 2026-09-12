# Handoff A: synthetic fixtures and submission package

Project: ThreadRev, a Slack-native engineering change reviewer. Agents, Everywhere hackathon, deadline 5 PM EDT today, September 12, 2026. Repo: https://github.com/gabegraves/ThreadRev (private, `main`).

You own two packages that need no credentials and no application code: **W1** the synthetic fixture assets, and **W5** the submission package. Someone else owns the checkers, the replay harness, the Slack card, and the live workspace.

## Read first, in this order

1. `research/synthetic-fixture-spec.md`, all of it. Every number, name, channel, and message you produce comes from here. It is the only source. Section 6 lists what must never appear.
2. `contracts/checker-io.md` and `contracts/examples/`, so your documents contain exactly the values the checker will recompute.
3. `hackathon-rules.md`, `hackathon-overview.md`, and `SUBMISSION.md` for W5.

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

## W5. Submission package

Output: fill in `SUBMISSION.md` in place, and create `submission/` with:

- `description.md`: project title ThreadRev, what it does, who it is for, why the Slack context matters. Under 250 words. Written for a judge scoring the four rubric criteria in `hackathon-overview.md`.
- `video-shotlist.md`: a two-minute shot list built from Scenario A's script and the "Recommended two-minute demonstration" section of `research/hackathon-design.md`. Timestamps, what is on screen, what is said. Include the requirement-change moment and the stale card.
- `social-post.md`: one draft post tagging the event partners named in `hackathon-rules.md`. No link yet; the repo goes public at submission.
- `inherited-vs-built.md`: two lists. Inherited: everything in the CopilotKit starter as of commit `9ed46e0`. Built during the event: every path added after that commit, generated from `git diff --stat 9ed46e0..HEAD --name-only` at the time you write it, and refreshed once more before submission.

Acceptance for W5: every required deliverable row in `hackathon-rules.md` has a corresponding file or a filled `SUBMISSION.md` section. Nothing is published or posted; preparing is your job, publishing is the team lead's.

## Report back

When done, one message: list of files committed with commit hashes, the acceptance checks you ran with their output, and anything in the spec you found ambiguous or had to change.
