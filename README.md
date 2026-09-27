# Mini DayZ Three

A top-down pixel-art survival game (inspired by Mini DayZ) built with Three.js.

## Run

```bash
npm run dev
```

Then open http://localhost:5173. No install needed: Three.js loads from a CDN.
Add `?seed=12345&x=100&y=-50` to the URL to open a specific seed at a tile position.

## Controls

WASD / arrows move · Shift (or the boot button) run · I / Tab (or the backpack button) inventory ·
J journal ·
F3 (or the gear button) debug panel with seed, teleport and minimap · F explore mode ·
+ / − or mouse wheel / pinch: zoom · M minimap · hover objects to see resources

## HUD

Laid out like Mini DayZ: portrait and score (top-left), health / water / food /
temperature bars (top), clock with settings and journal buttons (top-right),
interact (right), backpack (bottom-left), walk/run toggle (bottom-right), and
thoughts above the player. Water and food drain over time (faster when running),
health drops when starving, dehydrated or freezing, and the day/night clock
runs one game minute per real second.

## Fog of war

The minimap only shows ground that has been on your screen; the rest stays
dark until you explore it (zooming out reveals more). Explored ground is saved per seed
in the browser.

## Inventory

Like Mini DayZ: **Vicinity** on the left lists what's near you (berries from
berry bushes, mushrooms, sticks from bushes, stones from rocks, wood from logs
and stumps, loot in supply crates and hunting towers, and anything you dropped).
The right side has equipment slots (face, head, shirt, vest, trousers, gloves,
backpack; pistol and rifle are shown but locked until weapons exist). Worn
clothing shows its condition, heat and pockets; a backpack adds 8 slots.

Drag items between slots, drag onto Vicinity to drop, double-click to use
(eat, drink, fill the canteen next to a lake, or wear clothing). Worn clothing
heat raises your temperature. You start with a T-shirt (berries) and jeans
(canteen), like the original.

## Structure

- `src/world/rng.js`: seeded random and hashing (seed + coordinates → same result)
- `src/world/noise.js`: seeded simplex noise
- `src/world/biomes.js`: biome ids and names
- `src/world/objects.js`: world objects, their resources, biome spawn tables
- `src/world/generator.js`: biomes and chunk contents (pure, no rendering)
- `src/world/chunks.js`: loads/unloads chunks around the player and builds meshes
- `src/world/fog.js`: fog of war for the minimap (which tiles you've seen, saved per seed)
- `src/gfx/sprites.js`: pixel art drawn in code, packed into one atlas
- `assets/player.aseprite`: the player's art; `player.png` + `player.json` are its Aseprite export
- `src/gfx/ground.js`: paints each chunk's ground texture
- `src/player.js`: movement, animation, collision
- `src/survival.js`: health, water, food, temperature, clock, thoughts
- `src/hud.js`: the HUD (pixel-art icons, parchment, bars, portrait)
- `src/items.js`: item types, equipment slots, loot table, item icons
- `src/inventory.js`: equipment, pockets, vicinity piles, moving/using items
- `src/inventoryUI.js`: the inventory panel with drag and drop
- `src/main.js`: renderer, pixel-perfect camera, HUD, game loop

## Player art

The player is a bald survivor in shorts, made from the CraftPix "Swordsman"
(level 1), © CraftPix.net, used under https://craftpix.net/file-licenses/.
Edit it in `assets/player.aseprite`: layers body, shorts, head and a hidden
hair layer; one tag per animation and direction (`idle_down`, `walk_left`,
`run_up`, ...), with the frame timings the game uses. After editing, use
File > Export Sprite Sheet with Output > JSON Data (Array), Tags checked,
saved over `assets/player.png` and `assets/player.json`. The game loads those
two files as they are. Keep the bottom row of the canvas empty (the feet stand on
the row above it).
