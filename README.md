<sub>Built in collaboration with [Claude](https://claude.com)</sub>

<div align="center">

# Refy

**A PureRef-style reference board that lives in your browser.**

Collect images, arrange them freely, then lock the screen and trace right on your tablet.

**[Open Refy →](https://romainguerif.github.io/refy/)**

*No account. No server. No dependencies. One HTML file.*

*Best in **Chrome** — see [Which browser](#which-browser).*

</div>

---

## What it does

- **Boards, plural** — a built-in library lets you create, rename and switch between boards. Everything is saved automatically in your browser (IndexedDB), nothing ever leaves your device.
- **Arrange freely** — move, resize, rotate and mirror images with touch gestures or the mouse. Rotation snaps to 0/90/180/270°.
- **Draw & write** — a freehand pencil (color, weight, undo) for arrows and annotations, plus proper text blocks: typed, resizable, rotatable, serif or sans.
- **Import almost anything** — photos, PDFs (pages become images), plain-text notes, drag & drop, or paste. Pasted text becomes a text block.
- **Trace mode** — per-image black & white, contrast, opacity and **edge extraction** to turn any photo into clean outlines; then the padlock freezes the whole screen and keeps the display awake. Hold it one second to unlock.
- **Song plans** — drop a `.json` arrangement on the board (or just paste it) and it becomes a card: title, tempo, section strip, energy curve. Double-tap it for the full screen — timeline, list view, and a playhead that runs at the tempo and tells you which section you are in and when the next one lands.
- **A quiet calendar** — a local agenda in the ··· menu. Dates and events live in Refy only; there is no sync and no account.
- **Backups on your device** — export any board as a portable `.refy.json` file and re-import it anywhere (imports become a new board, nothing gets overwritten).
- **Installs like an app** — add it to your home screen and it runs full screen, offline, and updates itself: it checks for a new version on every launch and reloads once when one lands.
- **Made for iPad** — install it from Safari as a full-screen app, works offline, imports straight from your photo library. Large photos are downscaled on import to keep the tab fast.
- **Minimal by design** — the toolbar stays small; tools and options only appear when they are relevant, with discreet animations throughout. Cream paper surfaces, hand-drawn monochrome icons, Klein blue accent, curated board backgrounds.

## Which browser

Refy stores everything on your device, so what matters is whether the browser
lets it keep that data. They do not behave the same.

**Chrome — recommended.** It grants persistent storage to installed apps and to
bookmarked sites, which means the browser will not wipe your boards on its own.
Installed from Chrome, Refy also updates itself reliably.

Other Chromium browsers work, but some refuse persistent storage or clear site
data when you close the last window. If that happens, Refy warns you at startup
and offers a **Protect from erasure** button in ··· → Dropbox. Two things help:
bookmark the site, and allow notifications — Chromium treats both as a signal
that the site matters. Refy never sends notifications; the permission is only
the key to that lock.

Safari on iPad works and installs cleanly, with one caveat: a home screen app
and Safari itself do not always share the same storage, so boards created in one
may not appear in the other.

Whatever the browser, the durable copy is the one that lives elsewhere: connect
Dropbox, or export a board to a file.

## Controls

| Action | Touch | Mouse / keyboard |
|---|---|---|
| Add images | `+` button (photo library) | `+`, drag & drop, or paste `Ctrl/Cmd V` |
| Import PDF / notes | ··· menu → Import a document | same, or drag & drop |
| Pencil | pencil button, two fingers to navigate while drawing | `D`, `Ctrl/Cmd Z` to undo a stroke |
| Text block | T button, double-tap to edit | `T`, double-click to edit |
| Move an element | one-finger drag | drag |
| Resize / rotate | two-finger pinch on the element | corner handles / top handle, `R` to rotate, `M` to mirror |
| Image adjustments | sliders button when an image is selected | black & white, contrast, opacity, edge extraction |
| Pan / zoom the board | one-finger drag / pinch on the background | drag / scroll wheel |
| Boards library | boards button | `B` |
| Calendar | ··· menu | `C` |
| Fit everything | frame button | `F` |
| Trace mode | padlock (hold ~1 s to unlock) | padlock |
| Delete selection | trash button | `Delete` |

## Song plan format

A plan is written in bars, never in seconds: timecodes are derived from the tempo, so changing
the BPM updates the whole grid. Colours are not part of the format — the screen is black and
white, and each section takes its shade from its own energy.

```json
{
  "title": "Quantum In Se",
  "bpm": 100,
  "meter": [4, 4],
  "bars": 208,
  "phrase": 16,
  "notes": "free text",
  "sections": [{ "bar": 1, "name": "Intro" }],
  "lanes": [{ "name": "Kick", "clips": [{ "from": 49, "to": 144, "fade": "grow", "label": "double-time", "accent": false }] }],
  "markers": [{ "bar": 161, "label": "2nd chord" }],
  "zones": [{ "from": 49, "to": 200, "label": "mixable range" }],
  "energy": [{ "bar": 1, "v": 0.05 }, { "bar": 129, "v": 0.9 }],
  "history": [{ "title": "Previous version", "bars": 200, "sections": [{ "from": 1, "to": 24, "name": "pad + field recording" }] }]
}
```

`from` and `to` are inclusive bars. A section runs until the next one starts. `fade` is
`in`, `out`, `both` or `grow`. `v` runs from 0 to 1 — one point per inflection, not per bar.
Only `title`, `bpm` and `bars` are required.

## Install on iPad

1. Open **[the app](https://romainguerif.github.io/refy/)** in Safari
2. Tap **Share → Add to Home Screen**
3. Launch it from the icon — full screen, offline-ready

## Under the hood

Vanilla JavaScript in a single `index.html` — no framework, no build step, no tracking. Pointer Events drive a small gesture state machine (drag / pinch / rotate / pan / zoom), boards persist in IndexedDB with an in-browser library, and a tiny service worker makes the whole thing work offline as a PWA.

Serve the folder with any static server to hack on it:

```bash
python3 -m http.server 8000
```
