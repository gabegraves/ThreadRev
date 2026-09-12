# What winning hackathon READMEs looked like, and what we ship

Checked 1:40 PM EDT, 2026-09-12, against the three winner repositories named in `recent-hackathon-winners.md` (events ending July 12 to September 12, 2026) and the Agent Natives results page. Presentation only; the mechanism lessons are in that file.

| Winner | Logo | Hero image or screenshots | Demo video in README | Tagline | Notable |
|---|---|---|---|---|---|
| KScope, first prize, Owkin Rewiring Biology | yes, top of README | yes, four screenshots, one per dashboard view | no | "A causal microscope for pathology foundation models" plus one sentence | "Honesty caveats (non-negotiable)" section; table of contents |
| TitleWise, external track winner, Agent Natives | no | no | no | "AI-powered tools for real estate closing attorneys. Save 30+ minutes per file." | Plain technical README; the win came from the demo result (eight planted signals caught, clean file passed) |
| Climatico, internal track winner, Agent Natives | no | no | no | "agent-native climate action desk" | "What's DONE vs what's LEFT" section; explicit disclosure that a narrated script is not separate services |
| Agent Natives results page | none shown | none shown | none; each project links a live demo URL and the code | one line per project | Judges rewarded a real result across a real boundary, with auditable records |

What this says: a logo and screenshots are not what won, but the first-prize project had both and every winner had a one-line tagline, a plain statement of what is done versus not, and an honesty section. Nobody embedded a video in the README; this event requires one as a separate deliverable.

What we ship, in order:

1. **Tagline** under the logo, one line, then the three verbs: recomputes, binds to a revision, goes stale. Already in the README.
2. **Logo**: `assets/threadrev-logo.svg` (light), `assets/threadrev-logo-dark.svg`, `assets/threadrev-mark.svg`. Three cards with the middle one struck through, a thread stitched through them to a green check.
3. **Hero image**: `assets/hero-scenario-a.png`, the web console in sample mode showing Card 1 with the STALE ribbon, Dara's correction, and Card 2 with "supersedes". Replace with the Slack card once the live run posts.
4. **Honesty section**: README "Status" already lists what is not true. Keep it near the top of the page after the demo, not at the bottom.
5. **Video**: two minutes, shot list in `hackathon-design.md`, spoken comparison beat in `submission/description.md`. Linked from the README header once uploaded. Label live versus harness on screen.
