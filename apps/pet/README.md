# ThreadRev Pet

A desktop companion for ThreadRev: a small character that sits in the bottom-right
corner of the screen, above the Slack desktop app, and expands into a findings
panel when clicked.

```bash
npm run dev --workspace pet       # build, then launch
npm run build --workspace pet     # build only
npm run test --workspace pet      # unit tests for the pure logic
npm run start --workspace pet     # launch an existing build
```

Quit from the tray menu. The tray icon is also how you get Rev back after
hiding it, or if a saved position ever puts it somewhere awkward.

Two flags help when demoing or checking a change:

```bash
electron . --open                 # start with the panel already expanded
electron . --state=checking       # pin one state: idle reading searching
                                  # checking found clear stale asleep
```

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

The window is a 412x620 transparent rectangle. If it captured mouse input across
that whole area it would kill the bottom-right corner of Slack. Instead the
window starts click-through (`setIgnoreMouseEvents(true, { forward: true })`) and
the renderer hit-tests every `mousemove`, turning interactivity on only while the
cursor is over the pet or the open panel. `forward: true` is what keeps
`mousemove` arriving while click-through is on — without it the hit test never
runs.

## The menu

Clicking Rev fans a semicircle of five destinations out around it:

| Item | Goes to |
| --- | --- |
| Findings | the review panel, in the overlay |
| Review console | `http://localhost:3000/` in the real browser |
| Voice review | `http://localhost:3000/voice` |
| Settings | the same native menu as the tray icon |
| Hide Rev | hides the overlay; the tray icon brings it back |

A full circle cannot fit in a screen corner, and against the right edge an arc
can only open about 110 degrees before its items run off the screen. So Rev
steps out of the corner while the menu is open and settles back after — that
shift is what buys the full 180 degrees.

The items travel out along the arc with a staggered spring, and collapse back in
reverse order so the menu gathers into Rev rather than vanishing. A guide arc is
drawn under them with `stroke-dashoffset`, sized from the same radius the items
use, read back from the stylesheet so there is one source of truth.

Hovering or focusing an item names it in a single shared label. At this radius
the items are about 59px apart; five separate labels would collide.

Arrow keys walk the arc and wrap at its ends, Escape closes it, and the closed
menu is `inert` so it takes no Tab stops.

## The character

Rev is a revision stamp with an aperture where a face would be — an instrument,
not a mascot. Everything it does maps to something ThreadRev actually does, so
the look is a status display rather than decoration:

- The **aperture** stops down when a checker is recomputing and opens wide when
  there is something to decide. `--aperture` is one number the state machine
  drives; the iris is a scaled hexagon because that is a single composited
  transform, which matters inside a transparent window.
- The **ring arc** carries the state colour, so status is legible across a room.
- The **tab** on top shows the revision the findings are bound to.
- The **hairline crack** appears when a card has been superseded.
- The **thread** unspools from Rev up to the panel as it opens, drawn with
  `stroke-dashoffset` so it reads as being drawn rather than fading in.

| State       | Look                                 | Means                         |
| ----------- | ------------------------------------ | ----------------------------- |
| `idle`      | half aperture, blue, slow breathe    | watching                      |
| `reading`   | open, pupil scanning                 | reading the thread            |
| `searching` | wide, sonar ring                     | searching the workspace       |
| `checking`  | stopped down, tick marks             | a checker is recomputing      |
| `found`     | wide, amber, alert hop               | live findings need a decision |
| `clear`     | relaxed, green                       | nothing to flag               |
| `stale`     | desaturated, fracture across the lens| superseded                    |
| `asleep`    | shut, zzz                            | idle past the sleep threshold |

## What it does

- Click Rev for the menu, click again or press Escape to close it. Drag Rev anywhere; the
  position is saved and restored, clamped so it can never be stranded off-screen
  or on a monitor that has since been unplugged.
- Right-click Rev, or the tray icon, for show/hide, always-on-top, reduce
  motion, sleep threshold, reset position and quit.
- The tray glyph turns amber when findings are waiting, so attention is visible
  even with Rev hidden.
- A badge counts unacknowledged live findings. Stale cards never badge — a
  superseded card is not news, and badging it would train you to ignore it.
- Blinks on a randomised cadence, tracks the cursor, and dozes off when idle.
- Honours `prefers-reduced-motion` and the tray's own reduce-motion toggle.

## Wiring it to the reviewer

`src/renderer/findings.ts` is the only file that talks to ThreadRev. It polls
`http://localhost:3000/api/pet/findings` every 3s and expects:

```json
{ "findings": [ /* Finding[] */ ] }
```

shaped like `packages/agent-core/src/contracts/finding.ts`.

The reviewer may also send `phase` (`reading` / `searching` / `checking`) and the
`revision` it is bound to; those drive the aperture and the tab directly, so Rev
shows what the agent is really doing rather than a generic spinner.

**That endpoint does not exist yet.** Until it does, the panel renders the sample
set from `findings.ts` and the footer reads "sample data — reviewer offline".
The sample data is never presented as real output. Serve the endpoint and nothing
else here needs to change.

## Tests

`src/logic.ts` holds the parts that are pure — the mouse hit test, the clamp, the
value formatter, the filter and the badge count — so the fiddly bits are checked
by `npm run test --workspace pet` rather than by looking at a screenshot. The
most important case is that the overlay stays click-through over its own empty
space: that assertion is what keeps the corner of the app underneath usable.
