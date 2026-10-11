# Defensa 1807 — notes for agents

Turn-based strategy PoC, mobile-first, static site (GitHub Pages from `main` root). Vanilla JS, no build step, no images yet.

- `game.js` — everything: map, units, rules, canvas render. Tunables at the top.
- `telemetry.js` — dev-only; on localhost/LAN posts console errors, exceptions and long tasks to `serve.py`. Disabled on github.io.
- `serve.py` — static + `POST /log` → `/tmp/defensa1807-console.jsonl`. Read that log instead of asking the user.
- `data/` — reference maps and docs supplied by the team (none yet).

Rules for this project:
- No web search. Historical sources come only from documents the team provides in `data/`.
- Assets will be generated with the Meshy API later (docs to be provided); don't add images until then.
- Publishing beyond the PoC waits for the team to approve the core concepts.

Map: schematic grid, 1 street tile + 2x2 block tiles. Street labels use modern names for orientation only. Landmark positions (Cabildo, Catedral, Fuerte, Recova, San Francisco, Santo Domingo) are approximate and must be checked against period maps. The 1807 street layout and riverbank differ from today's.

Historical points to validate with the supplied sources:
- "Granaderos": the Regimiento de Granaderos a Caballo (San Martín) dates from 1812, so it is anachronistic here. A period option is the Granaderos de Liniers (infantry raised 1806–07).
- Criollos fought alongside the Spanish, not as a separate side; the game treats Granaderos and Criollos as allies.
- In 1807 the Recova split the plaza into Plaza de la Victoria (west) and Plaza del Fuerte (east); the Fuerte stood where the Casa Rosada is, next to the river.
- Santo Domingo is where Craufurd's column held out and surrendered on 5 July 1807.
