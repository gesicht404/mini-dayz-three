# Mini DayZ Three

A top-down pixel-art survival game (inspired by Mini DayZ) built with Three.js.

## Run

```bash
npm start
```

Then open http://localhost:5173. No install needed: Three.js loads from a CDN.
Add `?seed=12345&x=100&y=-50` to the URL to open a specific seed at a tile position.

## Controls

WASD / arrows move · Shift run · C switch character · F explore mode (fast, no collision) · + / − zoom · M minimap · hover objects to see resources

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
