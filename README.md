<sub>Built in collaboration with [Claude](https://claude.com)</sub>

<div align="center">

# Refy

**A PureRef-style reference board that lives in your browser.**

Collect images, arrange them freely, then lock the screen and trace right on your tablet.

**[Open Refy →](https://romainguerif.github.io/refy/)**

*No account. No server. No dependencies. One HTML file.*

</div>

---

## What it does

- **Boards, plural** — a built-in library lets you create, rename and switch between boards. Everything is saved automatically in your browser (IndexedDB), nothing ever leaves your device.
- **Arrange freely** — move, resize, rotate and mirror images with touch gestures or the mouse. Rotation snaps to 0/90/180/270°.
- **Draw & write** — a freehand pencil (color, weight, undo) for arrows and annotations, plus proper text blocks: typed, resizable, rotatable, serif or sans.
- **Import almost anything** — photos, PDFs (pages become images), plain-text notes, drag & drop, or paste. Pasted text becomes a text block.
- **Trace mode** — per-image black & white, contrast, opacity and **edge extraction** to turn any photo into clean outlines; then the padlock freezes the whole screen and keeps the display awake. Hold it one second to unlock.
- **A quiet calendar** — a local agenda in the ··· menu. Dates and events live in Refy only; there is no sync and no account.
- **Backups on your device** — export any board as a portable `.refy.json` file and re-import it anywhere (imports become a new board, nothing gets overwritten).
- **Made for iPad** — install it from Safari as a full-screen app, works offline, imports straight from your photo library. Large photos are downscaled on import to keep the tab fast.
- **Minimal by design** — the toolbar stays small; tools and options only appear when they are relevant, with discreet animations throughout. Cream paper surfaces, hand-drawn monochrome icons, Klein blue accent, curated board backgrounds.

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
