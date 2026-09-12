# Handoff: demo narrative, domain realism, and the judge's view

Project: ThreadRev, a Slack-native engineering change reviewer. Agents, Everywhere hackathon, deadline 5 PM EDT today, September 12, 2026. Repo: https://github.com/gabegraves/ThreadRev (private, `main`).

You own what the judges see and whether an engineer would believe it. Agents are generating fixtures, checkers, and code. Nobody else is asking whether the precharge scenario is something a real electrical lead would recognize, whether the two-minute video lands, or whether the description scores. That is yours.

## Company frame (changed 1:30 PM)

The fixture company is Kestrel Motors, a fictional maker of light electric city vehicles, not a student solar team. KS-4 is the platform in development. Dara Voss owns the precharge board, Tam Holloway owns firmware, Juno Marsh joined in August and is signing the r2 review. Say this in the first fifteen seconds. The consequence that makes the finding matter: a relay that closes before the bus is charged puts inrush through the main contactor on every key-on, and the number in the signed review is the number that ships. The two-minute shot list in `research/hackathon-design.md` is the current cut; `submission/video-shotlist.md` starts from it.

## Read first

1. `research/synthetic-fixture-spec.md`, section 4 Scenario A and section 5 replay cases. This is the story as currently written.
2. `research/hackathon-design.md`, "Recommended two-minute demonstration" and "Lessons from actual recent winners".
3. `hackathon-overview.md` judging criteria, `hackathon-rules.md` deliverables, `SUBMISSION.md` checklist.
4. `research/change-agent-novelty-audit.md` and `research/engineering-change-competitors.md`: the competitors we cannot pretend do not exist.
5. `contracts/examples/finding-scenario-a.json` and `finding-scenario-a-superseding.json`: exactly what the bot will say.

## Decisions you own

**D-NAR1. Is Scenario A believable?** Put on the electrical lead hat. A design review document with a text/diagram capacitance mismatch and a wrong printed example: would you be glad the bot caught it, or annoyed it flagged a typo? If the latter, change the scenario within the same arithmetic (same R, same three capacitances, same checker) so the discrepancy has a consequence the lead cares about. The requirement change to 820 µF already crosses the relay timer; decide whether that moment should be the first finding rather than the second. You can change the script and the card text; you cannot change the numbers the checker verifies without telling the integration owner.

**D-NAR2. The two-minute cut.** Write the shot list with timestamps, what is on screen, and the exact words spoken. The rubric wants one complete interaction with a visible result, and an explanation of what is lost if the context is removed. Decide where in the two minutes that sentence lands. Include the stale card being superseded on screen. Decide whether the replay scorecard appears at all, and if so, for how many seconds. Cut anything that is infrastructure pride rather than user benefit.

**D-NAR3. The claim we make.** Write the 250-word description. It has to survive a judge who knows AllSpice, Glean, or CodeRabbit exist. Do not claim a market gap. Claim the specific thing: the bot knew the July message superseded the document because it read the thread, and it recomputed instead of trusting the printed number. Say what "verified" means and what it does not mean. Say what the bot cannot see.

**D-NAR4. Inherited versus built.** The rules require the team to explain what was created during the event. Write `submission/inherited-vs-built.md` from `git diff --name-only 9ed46e0..HEAD`, refreshed before submission, in plain language a judge can check against the repo. Anything that looks like starter code renamed gets called out as inherited.

**D-NAR5. Score us.** At 3:00 PM, score the current state 1 to 5 on each of the four criteria as a hostile judge would, with one sentence of evidence per score. Name the single change that moves the lowest score most. That is what the last ninety minutes go to.

## Deliverables, committed to the repo

- `submission/description.md`
- `submission/video-shotlist.md`
- `submission/social-post.md`, tagging the partners named in `hackathon-rules.md`, no link until the repo is public
- `submission/inherited-vs-built.md`
- `submission/rubric-self-score.md`
- `SUBMISSION.md` filled in
- Any change to the Scenario A script committed to `research/synthetic-fixture-spec.md` with the reason in the commit message

Recording the video is yours too, with the environment owner driving Slack. Nothing gets posted or published; preparing is your job, publishing is the team lead's.

Commit and push after each deliverable.

## Report back

Two messages. At 3:00 PM: the rubric self-score and the one change you recommend. At the end: file list with commit hashes, the final description, and anything in the story you still do not believe.
