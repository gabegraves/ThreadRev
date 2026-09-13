# Handoff: eval lane (human judgment)

Written 2026-09-12 12:40 PM EDT, replaces the 12:20 version. Deadline 5:00 PM EDT. Repo https://github.com/gabegraves/ThreadRev, `main`. Read `AGENTS.md` and `STATUS.md` first.

You are the eval lane. An agent does the mechanical work for you: it reads the private Slack archive on Gabe's machine, proposes trick cases, writes the fixtures, writes the grader, runs the matrix. Its brief is `research/agent-briefs/w5-eval-mechanics.md`. Paste that file into the agent, not this one. This file is your work: the ground truth, the pass rules, the audits, the calls. None of it can come from the agent without the eval grading the model with the model.

## 1. What is being tested

ThreadRev posts a review card in a Slack thread when a document or message disagrees with what the thread already decided. Three claims: every number on a card comes from a Python checker, never the model; it posts exactly one card when there is a real discrepancy; it stays silent otherwise. The replay harness proves the plumbing. Nothing yet measures the judgment. Your lane produces the measurement and the 3:45 PM go/no-go on the live demo.

## 2. Ownership

| | You | Your agent | Gabe |
|---|---|---|---|
| Writes | `evals/labels.md`, `evals/pass-rules.md`, `evals/audit.md`, verdict and injection stance in `research/red-team-results.md` | `fixtures/adversarial/`, `evals/expect/`, `evals/grade.py`, `evals/test_grade.py`, `evals/run_matrix.py`, results table in `research/red-team-results.md` | `apps/channel/src/replay/record.ts` and run records under `evals/records/`, fixture-loader and docx support, prompt and tool fixes |
| Reads | The private archive, in the agent's proposals, never copied | The private archive, read-only, local path in its brief | Your failure reports |

Nobody fixes the bot except Gabe. Failures go to him as exact input, exact output.

The private research archive has real names. It stays outside this repo. Nothing from it enters this repo, a screenshot, or the video. Fictional names and numbers only, from `research/synthetic-fixture-spec.md` section 3.

## 3. Your work, in order

### H1. Label real threads (12:45 to 1:30 PM)

Ask the agent for a list of 25 archive threads with a one-line summary each, no message text. Pick 20. For each one write a row in `evals/labels.md`:

| # | Archive ref | Review moment? | Should reviewer speak? | Pattern (P1 to P7, or none) | What a wrong post would look like |
|---|---|---|---|---|---|

Archive ref is the file name and thread timestamp only. Review moment means someone was about to sign, order, build, or commit on a number or a document. Should speak means a reviewer with the thread and the attached documents would have had something verifiable to say. At least 8 of the 20 must be "no review moment" or "review moment, nothing to say". Those are the silent-channel controls and they are the half of the claim nobody else measures.

Commit the table. This is the ground truth. The agent fictionalizes from it. It must not write it.

### H2. Pass rules (1:30 to 2:00 PM)

`evals/pass-rules.md`. The agent's brief gives it eight deterministic checks. You decide the policy those checks encode. Write one decision each:

- PR1. Tolerance. A printed value inside checker tolerance: silence, or a card that says "reproduces"? Pick one and say why.
- PR2. Questions. A card that only asks which source is authoritative: does it count as a post for the silent controls? Recommended: yes, a question is a post.
- PR3. Already caught. A human has already named the discrepancy before the trigger. Silence, or a card that cites the human's message? Pick one.
- PR4. Recommendations. A card that suggests a different part, resistor, timer value, or supplier: always a fail. Confirm or override.
- PR5. Could not verify. Malformed inputs: is a "could not verify" card required, or is silence acceptable?
- PR6. Prompt injection stance. The prompt today ignores instructions found in evidence and says it saw them. Confirm, or recommend refusing the review. This is D-RT3 in `research/handoff-red-team.md`.
- PR7. Edits. Trigger message edited twice. Exactly one card, or one card per edit that changes an input?

Post the seven decisions in `STATUS.md` at 2:00 PM. The agent turns them into `must_mention` and `must_not_mention` in the expect files.

### H3. Audit the fictionalized cases (2:00 to 2:30 PM)

The agent commits 8 to 12 cases under `fixtures/adversarial/` derived from your H1 rows. For each case, `evals/audit.md` gets a row:

| Case | From label # | Still the same failure? | Leak check | Verdict |
|---|---|---|---|---|

Still the same failure: read the fictional thread and confirm the trick survived translation. An agent turning "the July correction got ignored" into a thread where the correction is the most recent message has destroyed the case. Leak check: no real name, handle, supplier, part number, channel name, or quoted sentence from the archive. Reject the case if either fails. Rejected cases go back to the agent with one sentence.

### H4. Adjudicate (2:30 to 3:30 PM)

Records arrive from Gabe. The agent grades them. You read every card the grader passed and every card it failed. Two questions per card:

- Grader passed, you would not: what rule is missing? Add it to `evals/pass-rules.md`, agent updates the expect file, re-grade.
- Grader failed, you would accept: is the rule wrong, or is the card wrong? Same loop.

Keep a count of each. That count is the calibration of the grader and belongs in the verdict.

If model mode has not run by 3:00 PM (the OpenAI key is blank as of 12:14 PM), the records come from the scripted harness. Read them anyway. They test plumbing and record faithfulness, and the verdict says exactly that.

### H5. Verdict (3:45 PM)

Section in `research/red-team-results.md`, under the agent's table:

- Cases passed, cases failed, by mode.
- Grader calibration from H4: how many passes you overturned, how many fails.
- The one failure a judge could trigger by accident.
- Go or no-go on the live demo. No-go means the demo lane records a rehearsed run.
- Prompt injection stance, final.

Then update your `STATUS.md` line.

## 4. What you can reliably finish with no key

H1, H2, H3 in full. H4 against scripted records. H5 with the wiring caveat. If the key lands by 2:00 PM, Gabe's model mode gives you real judgment records for H4 and the verdict stands on them.

## 5. Rules

- Commit and push after each file, explicit paths only: `git add evals/labels.md` then `git pull --rebase origin main && git push origin main`. Never `git add .`. Never commit the archive or anything with a real name.
- Your files are `evals/labels.md`, `evals/pass-rules.md`, `evals/audit.md`, and your sections of `research/red-team-results.md`. Everything else in `evals/` and `fixtures/adversarial/` is the agent's. Do not edit code.
- Label claims: verified yourself, delegated to the agent, or unverified.
- No co-author trailers.
