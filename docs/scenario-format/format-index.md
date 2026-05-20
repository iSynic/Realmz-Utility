# Format Index

This index summarizes current known scenario files/resources. Confidence terms
are defined in [Evidence Map](evidence-map.md).

| Container | Record/block size | Meaning | Runtime consumers / anchors | Confidence | Utility coverage |
| --- | ---: | --- | --- | --- | --- |
| `Data LD` | `16200` bytes per level | Land `short[90][90]` field grids | `setupnewgame.c`, `editstring.c`, `loadland-loadpixmap.c` | confirmed | Parsed as map levels with tile summaries and render metadata. |
| `Data DL` | `16200` bytes per level | Dungeon `short[90][90]` field grids | `setupnewgame.c`, `editstring.c`, `threed.c` | confirmed | Parsed as dungeon levels; rendered through shared top-down dungeon art. |
| `Data DD` | `100 * 40` bytes per level | Land trigger/action records | `setupnewgame.c`, `editstring.c`, `newland.c` | source-backed | Parsed as doors/triggers with eight action slots. |
| `Data DDD` | `100 * 40` bytes per level | Dungeon trigger/action records | `setupnewgame.c`, `editstring.c`, `newland.c` | source-backed | Parsed as dungeon triggers and action slots. |
| `Data RD` | `644` bytes per level | Land random metadata, LOS/dark flags, encounter rectangles, landlook | `setupnewgame.c`, `editstring.c`, `loadland-loadpixmap.c` | source-backed | Parsed for map config and random encounter boxes. |
| `Data RDD` | `644` bytes per level | Dungeon random metadata and rectangles | `setupnewgame.c`, `editstring.c` | source-backed | Parsed for dungeon config and random encounter boxes. |
| `Data ED3` | `40` bytes | Macro/action door records | `flashrange-loaddoor.c`, `newland.c` | source-backed | Parsed as reusable macros and script graph nodes. |
| `Data EDCD` | `10` bytes | Five signed shorts of extra action parameters | `misc.c:loadextracode`, `newland.c` | source-backed | Parsed as EDCD rows and linked from action opcodes. |
| `Data ED` | `426` bytes, partial legacy records accepted | Simple encounters | `setupnewgame.c`, `newland.c`, `saveshop.c` | source-backed | Parsed for choice action slots and text buffers. |
| `Data ED2` | `520` bytes, partial legacy records accepted | Complex encounters | `setupnewgame.c`, `newland.c`, `saveshop.c` | source-backed | Parsed for choice, word, spell, item, thief, and text slots. |
| `Data MD` | `210` bytes | Monsters | `beast.c`, `combatsetup.c`, `newland.c` | source-backed | Parsed for names, icon IDs, combat summary fields. |
| `Data BD` | `346` bytes | Battles | `combat.c`, `combatsetup.c` | source-backed | Parsed for monster grid occupancy, messages, and battle macro. |
| `Data SD` | `3002` bytes | Shops | `setupnewgame.c`, `editstring.c`, `question.c` | source-backed | Parsed for item counts, quantity slots, inflation. |
| `Data SD2` | usually `256` bytes | Scenario strings/messages | `editstring.c`, `question.c`, `textbox-time.c`, `handlemenuchoice.c` | source-backed | Parsed as Pascal-style text slots. |
| `Data MD2` | `340` bytes | Map records/notes/start positions | map UI paths and scenario resource map names | source-backed partial | Parsed and linked to level entities when possible. |
| `Data TD` | `48` bytes | Treasure records | setup/runtime treasure paths need deeper anchoring | inferred | Parsed as item/value summary. |
| `Data TD2` | `118` bytes | Thief encounter records | setup/runtime thief paths need deeper anchoring | inferred | Parsed as success/fail action summaries. |
| `Data TD3` | `40` bytes | Timed encounters | `setupnewgame.c`, `textbox-time.c` | source-backed | Parsed as timing/action summary records. |
| `Data CI` | `4608` bytes | Scenario contact/info strings | `contactinfo.c:loadcontact` | confirmed | Parsed into scenario metadata strings. |
| `Data MENU` | `502` bytes | Generated monster menu cache | `menuinit.c` | confirmed | Indexed as generated cache metadata. |
| `Data Solids` | `1024` bytes | Tile solidity/contact table | contact/menu/solids paths need deeper anchoring | source-backed partial | Indexed as a fixed table, semantics pending. |
| `Scenario` / `Scenario.rsrc` | resource fork | Scenario resource fork: `PICT`, `cicn`, `STR#`, metadata, names | `ResourceManager.cpp`, classic resource chain | fixture-backed | Inventoried by type/id/name/hash; individual resource records/entities emitted; map names from `STR# -102/-101`. |
| Family Jewels resource fork | resource fork | Shared base tile/icon/picture art | Realmz resource chain | fixture-backed | Used for real tile atlas and dungeon top-down `PICT 302` fallback. |
| `:Data Files:CL` / `CD` | generated cache | Runtime land/dungeon caches | `setupnewgame.c`, save/load paths | confirmed | Not edited by utility; documented as runtime relationship. |
| `:Data Files:CE` / `CE2` | generated cache | Runtime encounter/shop state | `setupnewgame.c`, `saveshop.c` | confirmed | Not edited by utility; source files parsed for browsing. |
| `:Data Files:CS` / `CT` / `CTD3` | generated cache | Shop, thief, timed encounter runtime state | `setupnewgame.c`, `saveshop.c` | confirmed | Documented as runtime/writeback relationship. |

## High-Linkage Priorities

Current schema work prioritizes these because they produce cross-reference graph
edges used by the browser:

1. `Data DD` / `Data DDD` / `Data ED3` action records.
2. `Data EDCD` action parameters.
3. `Data ED` / `Data ED2` encounter choices.
4. `Data BD`, `Data MD`, `Data SD2`, and `Data MD2` references.
5. Scenario resource fork names and art resources.

## Deep Container Specs

These pages expand the table above into source-backed field notes:

- [Action Records](containers/action-records.md): `Data DD`, `Data DDD`,
  `Data ED3`, `Data EDCD`, dispatch, macro loading, and mutation behavior.
- [Runtime Consumer Matrix](runtime-consumer-matrix.md): every known scenario
  container mapped to source consumers, cache/save behavior, semantic outputs,
  and remaining gaps.
- [Byte Layout Reference](byte-layout-reference.md): fixed record sizes,
  confirmed offsets, endian behavior, and compatibility rules.
- [Opcode Runtime Reference](opcode-runtime-reference.md): normalized opcode
  behavior, EDCD coverage policy, and high-linkage action shapes.
- [Resource Fork Taxonomy](resource-fork-taxonomy.md): classic resource fork
  parsing, observed resource types, individual resource entities, and open
  taxonomy questions.
- [Maps, Random Metadata, And Fields](containers/maps-random-and-fields.md):
  `Data LD`, `Data DL`, `Data RD`, `Data RDD`, landlook, dungeon bitfields,
  LOS, darkness, random regions, and secret/pass-through modeling.
- [Encounters](containers/encounters.md): `Data ED`, `Data ED2`, embedded action
  slots, generated caches, and partial-record compatibility.
- [Supporting Records](containers/supporting-records.md): battles, monsters,
  shops, strings, treasure, thief, timed encounters, map notes, contact info,
  menu caches, solids, and save-linked state.
- [Assets And Runtime Caches](containers/assets-and-runtime-caches.md):
  scenario resources, shared Realmz art, custom icons/tiles, and generated cache
  provenance.

## Open Format Gaps

- Full field semantics for every `struct door` opcode and `extracode` shape.
- Complete `Data TD`, `Data TD2`, `Data Solids`, and `Data MENU` field names.
- Scenario metadata/start location in resource forks beyond the current map-name
  `STR#` support.
- Generated runtime cache mutation/writeback semantics as first-class graph
  links.
- Save-linked scenario state and one-shot trigger state.
