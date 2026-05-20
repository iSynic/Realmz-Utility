# Action Records

Action records are the highest-linkage scenario container. They are the source
of most "what happens here?" behavior: messages, battles, map movement, flag
changes, shops, macros, one-shot actions, and runtime mutations.

## Containers

| File | Shape | Runtime role | Confidence |
| --- | ---: | --- | --- |
| `Data DD` | `100 * sizeof(struct door)` per land level | Land trigger/action table. | source-backed |
| `Data DDD` | `100 * sizeof(struct door)` per dungeon level | Dungeon trigger/action table. | source-backed |
| `Data ED3` | `sizeof(struct door)` per macro | Reusable action/macro records loaded by script opcodes. | source-backed |
| `Data EDCD` | five signed shorts per row | Extra parameters for many action opcodes. | source-backed |

The `struct door` definition is in
`F:\Realmz\src\realmz_orig\structs.h:49`. `CvtDoorToPc` in
`F:\Realmz\src\realmz_orig\convert.c:195` confirms the byte-swapped fields:
`doorid`, `code[8]`, and `id[8]`. The byte fields are copied as-is.

## `struct door` Layout

Current utility interpretation:

| Offset | Size | Field | Notes |
| ---: | ---: | --- | --- |
| `0` | `4` | `doorid` | Signed 32-bit. Usually packs level/tile identity. |
| `4` | `1` | `landid` | Byte. Runtime also uses current context for macros. |
| `5` | `1` | `landx` | Byte x coordinate. |
| `6` | `1` | `landy` | Byte y coordinate. |
| `7` | `1` | `percent` | Activation chance or disabled marker, depending on runtime context. |
| `8` | `16` | `code[8]` | Eight signed 16-bit action opcodes. |
| `24` | `16` | `id[8]` | Eight signed 16-bit action ids/parameters. |
| `40` | | end | Fixed record size. |

For map trigger records, `doorid` is normally decoded as:

```text
level = floor(doorid / 10000)
x = doorid % 100
y = floor((doorid % 10000) / 100)
```

This packing is fixture-backed and matches utility behavior, but macro records
should not be treated as map coordinates. `loaddoor2` loads `Data ED3`, then
copies the current action context back into the loaded record.

## Land And Dungeon Trigger Tables

`setupnewgame.c` copies source trigger tables into generated runtime caches:

- land: `Data DD` plus `Data LD` plus `Data RD` to `:Data Files:CL`;
- dungeon: `Data DDD` plus `Data DL` plus `Data RDD` to `:Data Files:CD`.

The copy loops at `F:\Realmz\src\realmz_orig\setupnewgame.c:76` and
`F:\Realmz\src\realmz_orig\setupnewgame.c:104` read one `door` table per
level, then the matching field grid and random metadata. This means the level
count for trigger tables should align with the matching `LD/RD` or `DL/RDD`
files. Mismatches are diagnostics.

`loadland` later seeks by level into the generated cache and reads the same
blocks back. See `F:\Realmz\src\realmz_orig\loadland-loadpixmap.c:5`.

## Macro Loading

`loaddoor2(id)` in `F:\Realmz\src\realmz_orig\flashrange-loaddoor.c:43` loads
one `Data ED3` record, converts it, and then preserves the active trigger's
location/percent context. Practical consequences:

- `Data ED3` is action-script storage, not a map surface.
- Header/location bytes in a macro can be junk, placeholders, or editor
  leftovers.
- Semantic identity should be `macro:<record-index>`, while map placement
  belongs to the trigger that invoked it.

## EDCD Extra Code Rows

`loadextracode(id)` in `F:\Realmz\src\realmz_orig\misc.c:560` reads five signed
16-bit values from `Data EDCD` and converts them. `newland.c` treats the five
values differently depending on opcode. Some opcodes also load neighboring EDCD
rows, so a single script slot can consume more than one ten-byte row.

The normalized schema should preserve both layers:

- raw EDCD row: five shorts with byte range evidence;
- semantic parameter shape: opcode-specific interpretation, confidence, and
  source anchor.

`docs/scenario-format/opcodes-edcd.md` is the working opcode map.

## Dispatch And Mutation Model

`newland.c` is the action dispatcher. Important source-backed behaviors:

- a percent gate runs before action execution (`newland.c` near the dispatcher
  entry);
- slots execute in record order unless an opcode branches, returns, or loads a
  macro;
- many opcodes read EDCD by `id`;
- opcode `25` removes the current trigger or door from the map;
- opcodes `23`, `-23`, and `92` mutate random encounter rectangles, percents,
  or battle ranges;
- opcode `13` mutates a door/trigger percent state;
- opcode `54` mutates timed encounters;
- opcode `57` mutates `randlevel.landlook` and dark state;
- final trigger cleanup can set the active door percent to `-1`, which is part
  of one-shot behavior.

These are not just display details. They imply graph edges such as
`calls_macro`, `shows_message`, `starts_battle`, `loads_map`, `writes_flag`,
`mutates_random_region`, `mutates_trigger`, and `changes_rendering`.

## Utility Schema Mapping

Recommended normalized records:

- `record:action-table:<land|dungeon>:<level>` for the 100-record block;
- `record:trigger:<land|dungeon>:<level>:<slot>` for each `struct door`;
- `record:macro:<index>` for `Data ED3`;
- `record:edcd:<index>` for `Data EDCD`;
- `entity:trigger`, `entity:macro`, and `entity:action-slot` for semantic
  browsing.

Recommended links:

- `triggers` from map tile entities to trigger entities;
- `calls` from action slots to macro entities;
- `uses_parameter_row` from action slots to EDCD records;
- `shows_message`, `starts_battle`, `loads_map`, `opens_shop`,
  `starts_encounter`, `mutates_tile`, `reads_flag`, `writes_flag`;
- `has_evidence` to source anchors, byte ranges, and fixtures.

## Open Questions

- Exact semantics for every negative opcode are not fully documented.
- EDCD rows that are consumed as multi-row parameter blocks need fixture tests.
- One-shot state is partly source trigger state and partly save/cache state; it
  should be modeled as runtime mutation, not as a different source record.
- Some third-party scenarios contain unreachable or editor-leftover action
  records. These should be reported as low-confidence/unlinked, not hidden.
