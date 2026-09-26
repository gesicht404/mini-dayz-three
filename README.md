# Mini DayZ Three

A top-down pixel-art survival game (inspired by Mini DayZ) built with Three.js.

## Run

```bash
npm start
```

Then open http://localhost:5173. No install needed: Three.js loads from a CDN.
Add `?seed=12345&x=100&y=-50` to the URL to open a specific seed at a tile position.

## Controls

WASD / arrows move · Shift (or the boot button) run · C switch character · J journal ·
F3 (or the gear button) debug panel with seed, teleport and minimap · F explore mode ·
+ / − zoom · M minimap · hover objects to see resources

## HUD

Laid out like Mini DayZ: portrait and score (top-left), health / water / food /
temperature bars (top), clock with settings and journal buttons (top-right),
interact (right), backpack (bottom-left), walk/run toggle (bottom-right), and
thoughts above the player. Water and food drain over time (faster when running),
health drops when starving, dehydrated or freezing, and the day/night clock
runs one game minute per real second.

## Structure

- `src/world/rng.js`: seeded random and hashing (seed + coordinates → same result)
- `src/world/noise.js`: seeded simplex noise
- `src/world/biomes.js`: biome ids and names
- `src/world/objects.js`: world objects, their resources, biome spawn tables
- `src/world/generator.js`: biomes and chunk contents (pure, no rendering)
- `src/world/chunks.js`: loads/unloads chunks around the player and builds meshes
- `src/gfx/sprites.js`: pixel art drawn in code, packed into one atlas
- `src/gfx/hero-data.js`: the player's frames as pixel data (generated, don't edit)
- `tools/extract_hero.py`: regenerates `hero-data.js` from the CraftPix Swordsman sheets
- `src/gfx/ground.js`: paints each chunk's ground texture
- `src/player.js`: movement, animation, collision
- `src/survival.js`: health, water, food, temperature, clock, thoughts
- `src/hud.js`: the HUD (pixel-art icons, parchment, bars, portrait)
- `src/main.js`: renderer, pixel-perfect camera, HUD, game loop

## Player art

The player is the CraftPix "Swordsman" (level 2), © CraftPix.net, used under
https://craftpix.net/file-licenses/. The frames are stored as pixel data in
`src/gfx/hero-data.js` and drawn in code, so no image files are loaded. The
Soldier character is made from the same frames in `soldierFrame()` (sprites.js):
an army recolour plus a helmet drawn over the hair. To switch
level or re-extract (needs Python + Pillow):

```bash
python tools/extract_hero.py "<pack>/PNG/Swordsman_lvl2/Without_shadow"
```
