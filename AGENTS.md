# Defensa 1807 — notes for agents

Turn-based strategy PoC, mobile-first, static site (GitHub Pages from `main` root). Vanilla JS, no build step. Three layers, kept separate so each can change alone:

```
index.html            entry point (GitHub Pages serves the repo root)
src/rules/rules.js    data only: map grid, landmarks, factions, unit stats, setup, alliances, turn limit
src/rules/story.js    data only: people, places, timeline (summaries of data/)
src/engine/engine.js  state, movement, combat, turns, win checks, HTML HUD; draw() forwards to the renderer
src/render/render3d.js  Three.js scene (ES module); reads engine globals, sets window.render3d, taps -> onTap(x, y)
src/audio/music.js    background music (assets/audio/musica.m4a) at 20%, fade-in on first gesture; #mute toggle
src/dev/telemetry.js  dev-only: on localhost/LAN posts console errors, exceptions, long tasks to tools/serve.py; off on github.io
vendor/               Three.js + addons, vendored (importmap in index.html)
assets/               Meshy GLBs, compressed with gltf-transform (weld, simplify ~8%, 512px WebP, quantize): ~250 KB each
data/                 reference maps and docs from the team, verbatim, one topic per file
docs/INTENT.md        design intent from the team, appended as it arrives; check it before changing behavior
tools/serve.py        dev server: static + POST /log -> /tmp/defensa1807-console.jsonl (read it instead of asking the user); GET /assets-list; never serves dotfiles
tools/meshy.py        image -> GLB via Meshy (meshy-6-lite); key in .env (git-ignored)
tools/viewer.html     GLB viewer for assets/ at /tools/viewer.html
```

Unit types listed in `MODELS` (render3d.js) load a GLB from `assets/` (granadero.glb for local infantry, soldado-ingles.glb for British line and rifles); the rest use placeholder geometry. Ships in the river load `assets/navio.glb` (`SHIP_GLB`). Landmarks (Catedral, Cabildo, Fuerte) swap their placeholders via `landmarkModel()`; block tiles get a hashed spread of `casa-colonial-1..4.glb` (instanced, stretched to the tile and roof height, boxes kept as invisible pick targets). Compress with `gltf-transform optimize in.glb assets/out.glb --compress quantize --texture-compress webp --texture-size 512 --simplify-ratio 0.92 --weld true`. Reference images for Meshy live in `assets/references/`. Script order in index.html matters: rules -> story -> engine -> render (classic scripts share globals).

Rules for this project:
- Don't open images (screenshots, references, renders) to look at them: it bloats the context. Work from file names and the team's description.
- No web search. Historical sources come only from documents the team provides in `data/`.
- Assets will be generated with the Meshy API (`tools/meshy.py`, review in `tools/viewer.html`); compress every GLB before adding it.
- Publishing beyond the PoC waits for the team to approve the core concepts.

Map: schematic grid, 1 street tile + 2x2 block tiles. Street labels use only period names from `data/calles-1806-1810.md` (pre-1808, or 1808 in the 1809 episode); streets without a known period name stay unlabeled. No modern names. Landmark positions (Cabildo, Catedral, Fuerte, Recova, San Francisco, Santo Domingo) are approximate and must be checked against period maps. The 1807 street layout and riverbank differ from today's.

Historical points to validate with the supplied sources:
- "Granaderos": the Regimiento de Granaderos a Caballo (San Martín) dates from 1812, so it is anachronistic here. A period option is the Granaderos de Liniers (infantry raised 1806–07).
- Criollos fought alongside the Spanish, not as a separate side; the game treats Granaderos and Criollos as allies.
- In 1807 the Recova split the plaza into Plaza de la Victoria (west) and Plaza del Fuerte (east); the Fuerte stood where the Casa Rosada is, next to the river.
- Santo Domingo is where Craufurd's column held out and surrendered on 5 July 1807.
