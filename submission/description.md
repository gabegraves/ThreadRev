# ThreadRev: demo video description

Draft 2:00 PM EDT, 2026-09-12. Demo lane refines wording; do not change the claims without checking README "What Slack already does, and what ThreadRev adds".

## Spoken, in the video (after Card 1 goes stale, about 85 to 105 s)

Slack AI can summarize this thread, and the summary is right: bus 680 microfarads, timer 2.5 seconds, doc matches. It is the wrong answer. The document contradicts itself, its printed result only works with a capacitance the thread already replaced, and the correction that breaks the timer is not in any document yet.

ThreadRev recomputed the numbers with a local checker. It bound the card to the document revision and the message it was checked against. And when Dara changed the bus, the old card went stale instead of sitting next to a new summary.

Slack keeps the conversation. ThreadRev keeps the decision, what it was decided against, and whether it is still true.

## Written description (submission form, 250 words)

**What we built.** ThreadRev is a Slack-native engineering change reviewer. Asked to check a document, or when a message changes an input an earlier finding used, it reads the thread, searches other channels for the values, recomputes them with a local Python checker, and posts one card: the discrepancy, why it matters, the sources with revision and hash, which numbers were reproduced versus inferred, and who can resolve it.

**Who it is for.** Juno Marsh joined Kestrel Motors in August and has to sign the KS-4 precharge board review. The thread says the bus is 680 uF and the firmware timer matches. The document's printed result only reproduces at 750 uF, and a later correction to 820 uF pushes charge time past the relay timer. Then every key-on puts inrush through the main contactor.

**Why the context matters.** Slack AI tells you what was said. ThreadRev tells you what was decided and whether it still holds. A summary of this thread is accurate and wrong. ThreadRev recomputes instead of repeating, binds every card to the document revision and message it was checked against, and when the input changes marks the old card stale and posts a new one. A standalone chatbot would have checked the document against itself and passed it.

**What verified means.** The named checks passed against the stated inputs. Not approval, not sign-off, not a claim about hardware. The model never writes a number on a card.

**Sponsors.** OpenAI model through CopilotKit Channels for Slack delivery.

## Word count check

```sh
awk '/^## Written description/,/^## Word count/' submission/description.md | wc -w
```
