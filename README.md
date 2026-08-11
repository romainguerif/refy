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
- **Trace mode** — the padlock freezes the whole screen and keeps the display awake, so you can put paper on your tablet and trace. Hold the padlock for one second to unlock.
- **Backups on your device** — export any board as a portable `.refy.json` file and re-import it anywhere (imports become a new board, nothing gets overwritten).
- **Made for iPad** — install it from Safari as a full-screen app, works offline, imports straight from your photo library. Large photos are downscaled on import to keep the tab fast.
- **Pantone-ish** — cream paper toolbar, hand-drawn monochrome icons, Klein blue accent, and a curated set of board backgrounds (Charcoal, Graphite, Night, Sage, Paper, White).

## Controls

| Action | Touch | Mouse / keyboard |
|---|---|---|
| Add images | `+` button (photo library) | `+`, drag & drop, or paste `Ctrl/Cmd V` |
| Move an image | one-finger drag | drag |
| Resize / rotate | two-finger pinch on the image | corner handles / top handle, `R` to rotate, `M` to mirror |
| Pan / zoom the board | one-finger drag / pinch on the background | drag / scroll wheel |
| Boards library | boards button | `B` |
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
