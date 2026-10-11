# Defensa 1807 — notes for agents

Turn-based strategy PoC, mobile-first, static site (GitHub Pages from `main` root). Vanilla JS, no build step. Three layers, kept separate so each can change alone:

- `rules.js` — data only: map grid, landmarks, factions, unit stats, setup, alliances, turn limit.
- `engine.js` — state, movement, combat, turns, win checks and the HTML HUD. Calls `draw()`, which forwards to the renderer.
- `render3d.js` — Three.js scene (ES module, vendored in `vendor/`). Reads engine globals, sets `window.render3d`, turns taps into `onTap(x, y)`. Unit types listed in `MODELS` load a GLB from `assets/`; the rest use placeholder geometry.
- `assets/` — Meshy GLBs, compressed with `gltf-transform` (weld, simplify ~8%, 512px WebP textures, quantize): ~250 KB each.
- `INTENT.md` — design intent from the team, appended as it arrives. Check it before changing behavior.
- `telemetry.js` — dev-only; on localhost/LAN posts console errors, exceptions and long tasks to `serve.py`. Disabled on github.io.
- `serve.py` — static + `POST /log` → `/tmp/defensa1807-console.jsonl`. Read that log instead of asking the user.
- `data/` — reference maps and docs supplied by the team (none yet).

Rules for this project:
- No web search. Historical sources come only from documents the team provides in `data/`.
- Assets will be generated with the Meshy API (`~/projects/know-how/meshy-assets`); compress every GLB before adding it.
- Publishing beyond the PoC waits for the team to approve the core concepts.

Map: schematic grid, 1 street tile + 2x2 block tiles. Street labels use modern names for orientation only. Landmark positions (Cabildo, Catedral, Fuerte, Recova, San Francisco, Santo Domingo) are approximate and must be checked against period maps. The 1807 street layout and riverbank differ from today's.

Historical points to validate with the supplied sources:
- "Granaderos": the Regimiento de Granaderos a Caballo (San Martín) dates from 1812, so it is anachronistic here. A period option is the Granaderos de Liniers (infantry raised 1806–07).
- Criollos fought alongside the Spanish, not as a separate side; the game treats Granaderos and Criollos as allies.
- In 1807 the Recova split the plaza into Plaza de la Victoria (west) and Plaza del Fuerte (east); the Fuerte stood where the Casa Rosada is, next to the river.
- Santo Domingo is where Craufurd's column held out and surrendered on 5 July 1807.
