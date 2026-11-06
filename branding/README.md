# Branding

> Agent Sessions is a Four Ounces project. Its colors, type and studio mark come from the Four Ounces brand kit (`kratner/four-ounces-brand`); take them from there. This folder keeps the extension's own icon: its concepts and the shipping version.

Working files for the Agent Sessions Dashboard icon.

![Concepts at 128, 32 and 16 px on dark and light backgrounds](preview/sheet.png)

## The shipping icon

`icon/g-board-lapis.svg` is a copy of the kit's `logo/products/agent-sessions.svg`: the three-column board in cream
(`#F4EAD5`) on a lapis tile (`#2B4C9B`), corner radius 28 on 128. The earlier indigo tile (`#1A2236`, concept F)
vanished against dark backgrounds, so on 2026-10-30 it moved to the same treatment as MingTab's red seal: a cream
glyph on a mid-tone pigment. The options are in [`icon-ground/`](icon-ground/index.html). The filled card is the
session waiting on you. The webview's header shows the same icon, tile and all, from `ProductIcon` in
`src/webview/components/BrandMarks.tsx`.

## Earlier concepts

Concepts A–C predate the brand and are kept for reference. They used the dashboard's own state colors on an ink-blue tile. The KR versions of the mark and icon were retired with the move to Four Ounces; they're in git history before v0.6.0.

| File | Concept |
| --- | --- |
| `icon/a-board.svg` | Three Kanban columns; the single glowing amber card is the session waiting on you. |
| `icon/b-stack.svg` | Three session rows with status dots, like the List view; the waiting row is outlined. |
| `icon/c-pulse.svg` | Board columns with a live heartbeat line crossing them. |
| `icon/e-board-fo.svg` | The v0.6.0 icon: the board on the ink tile, before each tool got its own ground. |
| `icon/f-board-indigo.svg` | **Shipping icon** (see above). |

## Rendering

```sh
npm run brand
```

This renders every SVG in `icon/` to `preview/<group>-<name>-128.png` and `-512.png`, and draws `preview/sheet.png`, which shows each mark at 128, 32 and 16 px on dark and light backgrounds. Edit an SVG, re-run the command and check the sheet. Small sizes are where icons fail.

The extension's Marketplace icon is `media/icon.png`, referenced from `package.json` (`"icon"`). `npm run brand` renders the shipping icon there. Nothing in `branding/` ships in the `.vsix`.
