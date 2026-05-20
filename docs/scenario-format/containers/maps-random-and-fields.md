# Maps, Random Metadata, And Fields

Realmz map display is a combination of field grids, random-level metadata,
runtime cache state, and art resources. The field values alone are not enough
to know what the player sees.

## Containers

| File | Shape | Meaning | Confidence |
| --- | ---: | --- | --- |
| `Data LD` | `90 * 90 * 2` bytes per level | Land field grid. | confirmed |
| `Data DL` | `90 * 90 * 2` bytes per level | Dungeon field grid. | confirmed |
| `Data RD` | `sizeof(struct randlevel)` per level | Land random/visual metadata. | source-backed |
| `Data RDD` | `sizeof(struct randlevel)` per level | Dungeon random/visual metadata. | source-backed |

`field` grids are signed 16-bit big-endian values. `CvtFieldToPc` is called by
`loadland` after reading `CL` or `CD`, which confirms endian behavior.

## Field Grid

Each level is a fixed `90 x 90` grid:

```text
90 * 90 * sizeof(short) = 16200 bytes
```

Land and dungeon grids share the same binary size but not the same renderer:

- land grids render through terrain tile atlases selected by `randlevel.landlook`;
- dungeon grids render as bitfields over shared top-down dungeon sprites.

Values above `999` participate in door/arrival logic in the runtime. The current
utility treats those as meaningful map markers rather than terrain-only tiles.
Negative values and high bits should remain raw-visible until every flag is
source-backed.

## Land Rendering

`loadland` in `F:\Realmz\src\realmz_orig\loadland-loadpixmap.c:5` reads:

1. the 100-record door table;
2. the `field` grid;
3. `randlevel`;
4. `site`, for land maps only.

If the caller requests art and the party is outdoors, `loadland` calls
`loadpixmap(randlevel.landlook)`. `loadpixmap` maps landlooks to standard or
custom art:

| Landlook | Runtime file/resource behavior |
| ---: | --- |
| `0` | Standard prairie/base art, `Data P BD`, `PICT 300`. |
| `3` | Subterranean art, `Data SUB BD`, `PICT 303`. |
| `4` | Castle art, `Data Castle BD`, `PICT 304`. |
| `5` | Desert art, `Data Desert BD`, `PICT 305`. |
| `6` | Scenario custom 1, `Data Custom 1`, `PICT 306` when present. |
| `7` | Scenario custom 2, `Data Custom 2`, `PICT 307` when present. |
| `8` | Scenario custom 3, `Data Custom 3`, `PICT 308` when present. |
| `9` | Swamp art, `Data Swamp BD`, `PICT 309`. |
| `10` | Snow art, `Data Snow BD`, `PICT 310`. |

Landlooks `1` and `2` are treated as outdated by the source. The utility should
report them explicitly if encountered.

## Dungeon Rendering

Dungeon top-down rendering does not use the landlook tile atlas. It uses shared
base art from `realmz.rsrc`, `PICT 302`, loaded into `gthePixels` by
`GWorldInit.c`.

The source rectangle grid is defined in `F:\Realmz\src\realmz_orig\main.c:1078`:

```text
x = 576
y = 320
tile = 16 x 16
grid = 4 columns x 6 rows
tiny index = col + row * 4
```

`F:\Realmz\src\realmz_orig\threed.c:741` renders dungeon overhead maps by
drawing `tiny[15]` as the black background and then overlaying sprites from
field bits. The simplified source-backed model is:

```text
normal view skips cells with bit 8 set
bit 15 -> tiny[0]
bit 14 -> tiny[1]
bit 13 -> tiny[2]
bit 12 -> tiny[3]
bit 11 -> tiny[4]
bit 10 -> tiny[5]
bit  9 -> tiny[6]
```

Door orientation and wall graphics are sprite meanings, not separate map tile
IDs. This is why dungeon field decoding has to be bitfield-oriented.

## Secret And Pass-Through Dungeon Behavior

`threed.c` also tests dungeon field bits for pass-through behavior. The known
important distinction is:

- a hidden/suppressed visual bit can affect whether an overhead tile is drawn;
- secret movement and discovered passage state use additional field-bit tests;
- not every interactable or high-bit tile should be displayed as a user-facing
  "Secret" marker.

The utility should model these as separate semantics:

- `hidden_visual`;
- `secret_passage`;
- `discovered_or_revealed`;
- `trigger_or_interaction_marker`.

This prevents all interactable dungeon cells from being named as secrets.

## `struct randlevel`

`struct randlevel` is defined in `F:\Realmz\src\realmz_orig\structs.h:206`.
`CvtRandLevelToPc` in `convert.c:223` confirms which fields are swapped.

Known structure:

| Field | Count | Meaning |
| --- | ---: | --- |
| `randrect` | `20` Rects | Random region rectangles, also reused by timed encounters. |
| `percent` | `20` shorts | Region chance. Runtime uses `Rand(10000)`. |
| `battlerange` | `20 x 2` shorts | Inclusive battle id range. |
| `randdoor` | `20 x 3` shorts | Up to three action doors/macros from a random region. |
| `randdoorpercent` | `20 x 3` shorts | Chance and one-shot behavior for random doors. |
| `landlook` | `1` byte | Outdoor render art selector. |
| `isdark` | `1` Boolean | Darkness behavior. |
| `uselos` | `1` Boolean | Line-of-sight behavior. |
| `only` | `20` Booleans | Stops random-region scan when matched. |
| `option` | `20` bytes | Surprise/text chance in random battle flow. |
| `sound` | `20` shorts | Sound id for optional random text. |
| `text` | `20` shorts | Message id for optional random text. |

The fixed record size used by the utility is `644` bytes. Byte-level offsets
should be treated as fixture-backed and source-layout-backed, but exact C
packing assumptions need continued validation across compilers and original
Mac alignment.

## Runtime Random Encounter Flow

`F:\Realmz\src\realmz_orig\textbox-time.c:375` is the main random encounter
consumer:

1. determine party map coordinate;
2. scan random rectangles from index `19` down to `0`;
3. check coordinate containment;
4. check `Rand(10000) <= percent[index]`;
5. try up to three `randdoor` slots using `randdoorpercent`;
6. positive `randdoorpercent` becomes zero after firing, then the map is saved;
7. if no random door fires and `battlerange` exists, start a battle;
8. optional text/sound can affect surprise;
9. `only[index]` stops the scan.

Important modeling consequence: random rectangles are not just "encounter
areas." They can be random script dispatchers, one-shot event triggers,
optional text emitters, battle ranges, and timed-encounter target regions.

## Utility Schema Mapping

Recommended entities:

- `map_level` for each land/dungeon level;
- `field_grid` and `field_cell` for raw grid evidence;
- `random_region` for each non-empty `randrect`;
- `render_profile` for `landlook`, darkness, LOS, and art source;
- `dungeon_bit_cell` for dungeon cells with meaningful flags.

Recommended links:

- `renders_with` from map level to art resource;
- `contains_region` from map level to random region;
- `spawns_battle` from random region to battle range;
- `triggers` from random region to action records/macros;
- `uses_message` and `uses_sound` from random region optional text behavior;
- `uses_region` from timed encounter to `randrect`.

## Open Questions

- Full field value semantics for outdoor maps are still incomplete.
- The `site` block copied into land caches is confirmed as runtime state but not
  fully documented.
- Some map records use editor leftovers or unreachable data. The inventory
  should report them separately from reachable gameplay graph nodes.
- Precise dungeon secret/pass-through field-bit taxonomy needs fixture
  assertions from known in-game examples.
