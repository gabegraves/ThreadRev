# ThreadRev: demo video description

Draft 2:00 PM EDT, 2026-09-12. Demo lane refines wording; do not change the claims without checking README "What Slack already does, and what ThreadRev adds".

## Spoken, in the video (after Card 1 goes stale, about 85 to 105 s)

Slack AI can summarize this thread, and the summary is right: bus 680 microfarads, timer 2.5 seconds, doc matches. It is the wrong answer. The document contradicts itself, its printed result only works with a capacitance the thread already replaced, and the correction that breaks the timer is not in any document yet.

ThreadRev recomputed the numbers with a local checker. It bound the card to the document revision and the message it was checked against. And when Dara changed the bus, the old card went stale instead of sitting next to a new summary.

Slack keeps the conversation. ThreadRev keeps the decision, what it was decided against, and whether it is still true.

## Written description (submission form, about 250 words)

**What we built.** ThreadRev is a Slack-native engineering change reviewer. When someone asks it to check a document, or when a message changes an input an earlier finding depended on, it reads the thread, searches the other channels for the document and the values it rests on, recomputes the numbers with a local Python checker, and posts one card: the discrepancy, why it matters, the sources with revision and hash, which numbers were reproduced versus inferred, and who can resolve it.

**Who it is for.** Juno Marsh joined Kestrel Motors in August and has to sign the KS-4 precharge board review. The thread says the bus is 680 uF and the firmware timer matches. The document's own printed result only reproduces at 750 uF, and a later correction to 820 uF pushes the charge time past the relay timer. If the relay closes before the bus is charged, every key-on puts inrush through the main contactor.

**Why the context matters.** Slack AI tells you what was said. ThreadRev tells you what was decided and whether it still holds. A thread summary here is accurate and wrong. ThreadRev does three things a summary never does: it recomputes instead of repeating, it binds every card to the document revision and the message it was checked against, and when the input changes the old card is marked stale in place and a new one is posted. A standalone chatbot handed the same document would have checked it against itself and passed it.

**What verified means.** The named checks passed against the stated inputs. It is not approval, sign-off, or a statement about hardware. The model never writes a number on a card.

**Sponsor technologies.** OpenAI model through CopilotKit Channels for Slack delivery. Exa is configured but not part of the core workflow.

**Live versus recorded.** State on screen whether the run is live Slack delivery or the offline replay harness.

## Word count check

```sh
awk '/^## Written description/,/^## Word count/' submission/description.md | wc -w
```
