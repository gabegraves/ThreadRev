# Agent brief: trusted checkers and offline replay harness (W2, W4)

Project: ThreadRev, a Slack-native engineering change reviewer. Agents, Everywhere hackathon, deadline 5 PM EDT today, September 12, 2026. Repo: https://github.com/gabegraves/ThreadRev (private, `main`). Node 22+, Python 3.11+.

You own **W2** the stdlib Python checkers and **W4** the offline replay harness. The checker is the trusted verifier: the model never computes a number the card shows, your code does. The replay harness is the only test that runs the real checker into the real card without accounts or network.

## Read first, in this order

1. `contracts/checker-io.md`: the JSON contract you implement. The acceptance numbers are in it.
2. `packages/agent-core/src/contracts/finding.ts` and `contracts/examples/`: the schemas and worked examples. `finding.test.ts` next to it shows how examples are parsed.
3. `research/synthetic-fixture-spec.md`, sections 4 and 5: Scenario A, Scenario B, and the three replay cases RC1 to RC3.
4. `apps/channel/src/delivery.test.tsx` and `apps/channel/src/testing/managed-gateway.ts`: the starter's existing offline harness. W4 reuses this pattern.

## Rules

- Commit and push to `origin main` after every green test. Small commits. Pull before push.
- Checkers: Python standard library only. No pip installs. No network. No file writes. Read one JSON object from stdin, write one to stdout.
- Do not edit `apps/channel/src/channel.tsx`, `tools.tsx`, or `packages/agent-core/src/prompt.ts`. Those belong to the integration owner. If the contract in `contracts/` needs to change, change it and its examples and tests in the same commit, and say so in the commit message.
- No real data. Everything comes from the fixture spec.

## W2. Checkers

Files:

```
checkers/
  check_rc.py         Scenario A. Implements the `rc` checker in contracts/checker-io.md exactly.
  check_route.py      Scenario B. Implements `route`. Do this second.
  common.py           run_id generation, stdin/stdout framing, error envelope. Shared by both.
  test_checkers.py    unittest. Runs both checkers as subprocesses on the example requests.
```

`check_rc.py` must produce, for `contracts/examples/checker-rc-request.json`, a response that matches `contracts/examples/checker-rc-response.json` on every `outputs` value to 4 decimal places and on every `checks[].pass` exactly. `run_id` differs per run and is excluded from the comparison.

`check_route.py` acceptance values are in the spec's Scenario B table: v2-0 gives 2.825 kWh, v2-1 gives 3.045 kWh, budget 2.912 kWh, feasibility flips. Add the RC2 alternative mass (310 kg gives 3.0217 kWh, still infeasible) as an input list so one run returns both.

Malformed input: exit 1, still emit a response with `error` set and `outputs` empty. Test that too.

Run with:

```
python3 -m unittest checkers/test_checkers.py -v
```

Add a root `package.json` script `"test:checkers": "python3 -m unittest checkers/test_checkers.py"` and include it in `"verify"` so `npm run verify` runs it.

## W4. Offline replay harness

Location: `apps/channel/src/replay/`. Purpose: replay a fixture Slack script into the channel handlers, with a scripted agent standing in for the model, and assert the card that gets posted. This is the scorecard for the demo and the contract test for the seam between your checker and the card.

Build it in three steps and commit each:

1. `fixture-loader.ts`: reads `fixtures/slack/<name>.json` (produced by Handoff A; until it lands, use the two scenario scripts from the spec inline) and yields messages in `ts` order, splitting at a cutoff so evaluator-only messages are held back.
2. `run-checker.ts`: spawns `python3 checkers/check_rc.py`, writes a `checkerRequest`, parses stdout with `checkerResponse` from `agent-core`. This is the one place Node calls Python. The integration owner will import this from the real tool handler, so keep the signature `runChecker(req: CheckerRequest): Promise<CheckerResponse>`.
3. `replay.test.tsx`: follows `delivery.test.tsx`. A scripted `AbstractAgent` emits the tool calls a good reviewer would make: read the thread, run the checker with the Scenario A request, post a finding card. Assert against the `ManagedGateway` deliveries that the posted card's fields parse as a `finding` and match `contracts/examples/finding-scenario-a.json` on `discrepancy`, `reproduced[].matches`, and `checker_run.checker`. The card component itself is being written by the integration owner as `FindingCard` in `components.tsx`; until it exists, post the finding as a `Markdown` block containing the JSON and assert on that. Swap to the component when it lands.

Then the three replay cases as separate tests in the same file, pass rules verbatim from spec section 5:

- RC1: card has `discrepancy: "none"`, every `reproduced[].matches` is true, no suggestion to change 470 ohm.
- RC2: both masses computed, neither declared final, `question` present naming Milo.
- RC3: a requirement-change message with a later `ts` is injected between checker start and publish. Assert exactly one live card, one stale record with the original `run_id` preserved, and the live card's `requirements_revision` equals the change message `ts`. This needs a `publish_result` guard that compares the card's revision to the current one; write it as a pure function in `apps/channel/src/replay/publish-guard.ts` with its own test so the integration owner can drop it into the real tool.

`npm test --workspace channel` must stay green throughout. Do not skip or delete the starter's existing tests.

## Report back

One message: files and commit hashes, the `unittest` and `npm test` output tails, which of RC1 to RC3 pass, and anything in the contract you had to change.
