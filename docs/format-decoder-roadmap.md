# Realmz Scenario Decoder Roadmap

This project should converge on a modern, inspectable schema for classic Fantasoft, third-party, and Divinity scenario data. The working rule is that raw bytes, decoded records, semantic links, and observed engine behavior should stay separate until the evidence says they are the same thing.

The active documentation and schema track now lives under
[`docs/scenario-format`](scenario-format/README.md). This roadmap remains the
scratchpad for focused decoder discoveries.

## Current Model

- `raw`: source file/resource, record index, byte offsets, primitive values, and checksums.
- `record`: typed decoded structures such as field grids, trigger/action records, encounters, battles, shops, strings, maps, treasure, contact data, menu data, and solids.
- `semantic`: user-facing roles such as entrance, battle trigger, quest flag write, map mutation, message, random encounter area, secret path, or encounter link.
- `render`: display choices needed to match the game, including tile atlas, base tile metadata, icon resources, overlays, and coordinate systems.
- `evidence`: source of confidence, such as file layout, resource name, Realmz runtime behavior, exported art match, wiki naming, or manual confirmation.

## Dungeon Top-Down Rendering

Prelude to Pestilence `Data DL` dungeon level 0 contains coherent, action-bearing dungeon data, but looked wrong when rendered with outdoor or castle landlook atlases. The matching game path is Realmz's top-down dungeon renderer:

- Shared art: `realmz.rsrc` / `The Family Jewels` `PICT 302`.
- Tiny sprite grid: starts at `x=576`, `y=320`, with `16x16` sprites in `4` columns by `6` rows.
- Field data: scenario `Data DL`, read as `90 x 90` signed big-endian 16-bit values per dungeon level. Dungeon rendering uses the original overhead renderer's row-major access (`field[y][x]`), while outdoor maps keep the separate order used by the outdoor renderer.

The parser now exposes both values:

- `landlook metadata`: what `Data RDD` says.
- `render tileset`: the top-down dungeon renderer, driven by `Data DL` bits.

Realmz bit helpers number bits from the high end of a 16-bit word, so `MyrBitTstShort(id, 15)` tests the low bit (`1 << 0`). The full-map utility renderer fills each cell with the empty/background tiny sprite, ignores bit 8 as an explored/hidden visibility flag, then overlays terrain sprites `0..6` when Realmz bits `15..9` are set. Marker/editor bits are not drawn as dungeon terrain.

Dungeon secret overlays use the engine's dungeon-specific evidence instead of the outdoor `abs(tile) >= 3000` rule. In dungeons, `checkforsecret()` checks raw mask `0x0f00` (`3840`) for secret-direction bits, and sets Realmz bit 9 when the in-game red `S` marker has been discovered.

Map trigger overlays are only placed for `Data DD` / `Data DDD` records whose packed `doorid` resolves to the current level and a valid `(x, y)` tile. Negative placeholder records such as `doorid = -1` may contain action payloads, but `newland()` cannot reach them through tile movement, so they should not appear as placed trigger boxes.

## Resource Catalog

Scenario resource forks are now inventoried by type, id range, named resource count, total bytes, and short samples. That is not a complete decoder yet, but it gives every scenario a stable resource map so future passes can target unknown resource types instead of searching manually each time.

## Next Evidence Targets

- Decode more `PICT` variants, especially non-tile images and scenario-specific special graphics.
- Expand `cicn` and icon handling into a typed asset table with source precedence: scenario resource, base resource, extracted fallback.
- Map `Scenario` file header fields: recommended level, starting position, starting map, scenario identity, and global knobs.
- Link every text/message reference to complete text, source record, and reverse references.
- Turn Data tab records into first-class navigable entities with incoming and outgoing links.
- Build a flag/state model for quest, encounter, shop, NPC/allies, timed events, and map mutations.
- Record passability and secret-path evidence separately from trigger overlays so false positives can be inspected and corrected.
