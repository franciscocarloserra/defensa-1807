# Intent

Design intent from the team, in the order it was given. Newest last.

- Turn-based strategy, playable on mobile; QA happens on phones.
- Public GitHub repo with a GitHub Pages site hosting the PoC. Wider release waits until the core concepts are approved.
- Setting: Buenos Aires historic center (Plaza de Mayo, calle Defensa, casco histórico) during the British invasions, 1806–1807. Historical accuracy to be validated.
- The 1807 street layout differs from today's; the team will supply period maps and official documentation. No web research.
- Sides: Granaderos, British invaders, Criollos.
- Assets will be generated with the Meshy API, inspired by historical illustrations; reference images and API docs to come. No images until then.
- 3D from the start, basic but eye-catching. Render the street layout and placeholder assets now.
- Keep rules, game engine and graphics engine separate so each can change without touching the others.
- Meshy GLBs replace placeholders per unit type as they arrive, compressed to stay light on mobile (first: granadero).
