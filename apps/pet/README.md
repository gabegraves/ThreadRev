# ThreadRev Pet

A desktop companion for ThreadRev: a small character that sits in the bottom-right
corner of the screen, above the Slack desktop app, and expands into a findings
panel when clicked.

```bash
npm run dev --workspace pet      # build, then launch
npm run build --workspace pet    # build only
npm run start --workspace pet    # launch an existing build
```

Quit from the **Quit** button in the panel footer.

## Why it is a separate window

The Slack desktop app is Electron, but it ships no extension surface — no way to
inject a view, and no supported way to draw inside its window. Slack's own app
surfaces (App Home, modals, messages, Split View) all render inside Slack's
layout and cannot float. So the pet is its own frameless, transparent,
always-on-top window parked in the corner of the work area. This is the same
approach every desktop pet takes (shimeji, OpenPets, vscode-pets' cousin
projects).

Consequences worth knowing before you demo it:

- It sits above Slack, not inside it. It does not move when the Slack window
  moves; it is anchored to the screen's work area corner. With Slack maximized
  the difference is invisible.
- **Screen sharing:** an always-on-top overlay is captured when you share a whole
  screen, and is *not* captured when you share a single window. Share the screen.
- It stays above other windows too, not only Slack.

## Mouse pass-through

The window is a 420x560 transparent rectangle. If it captured mouse input across
that whole area it would kill the bottom-right corner of Slack. Instead the
window starts click-through (`setIgnoreMouseEvents(true, { forward: true })`) and
the renderer hit-tests every `mousemove`, turning interactivity on only while the
cursor is over the pet or the open panel. `forward: true` is what keeps
`mousemove` arriving while click-through is on — without it the hit test never
runs.

## States

The expression is a status display, driven by the findings feed. One silhouette,
four expressions, so it always reads as the same creature:

| State   | Look                        | Means                          |
| ------- | --------------------------- | ------------------------------ |
| `idle`  | eyes shut, slow bob         | nothing to report              |
| `think` | eyes scanning, antenna pulse| review in progress             |
| `found` | wide eyes, amber, hopping   | live findings waiting          |
| `ok`    | wink, green                 | reviewed, nothing to flag      |

## Wiring it to the reviewer

`src/renderer/findings.ts` is the only file that talks to ThreadRev. It polls
`http://localhost:3000/api/pet/findings` every 4s and expects:

```json
{ "findings": [ /* Finding[] */ ] }
```

shaped like `packages/agent-core/src/contracts/finding.ts`.

**That endpoint does not exist yet.** Until it does, the panel renders the sample
set from `findings.ts` and the footer reads "Sample data — reviewer not
connected". The sample data is never presented as real output. Serve the endpoint
and nothing else here needs to change.
