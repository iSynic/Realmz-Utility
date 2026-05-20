# Source Anchor Index

This index is the working trail from scenario bytes to Realmz runtime behavior.
Paths under `F:\Realmz` are read-only evidence.

## Struct Definitions

| Struct | Source | Notes |
| --- | --- | --- |
| `struct door` | `F:\Realmz\src\realmz_orig\structs.h:49` | 40-byte action record used by `Data DD`, `Data DDD`, `Data ED3`, and generated `CL`/`CD`. |
| `struct battle` | `F:\Realmz\src\realmz_orig\structs.h:125` | 346-byte battle grid, message fields, and battle macro. |
| `struct timeencounter` | `F:\Realmz\src\realmz_orig\structs.h:133` | 40-byte timed encounter record copied to `CTD3`. |
| `struct monster` | `F:\Realmz\src\realmz_orig\structs.h:159` | 210-byte monster record; includes combat stats, icon id, death action, and name. |
| `struct thief` | `F:\Realmz\src\realmz_orig\structs.h:192` | 118-byte thief encounter record copied to `CT`. |
| `struct randlevel` | `F:\Realmz\src\realmz_orig\structs.h:206` | 644-byte random-map metadata: 20 rectangles, battle ranges, random doors, landlook, LOS/dark flags. |
| `struct treasure` | `F:\Realmz\src\realmz_orig\structs.h:221` | 48-byte treasure record. |
| `struct encount2` | `F:\Realmz\src\realmz_orig\structs.h:226` | 160-byte complex encounter header followed by nine 40-byte text buffers in source/cache files. |
| `struct encount` | `F:\Realmz\src\realmz_orig\structs.h:242` | 106-byte simple encounter header followed by four 80-byte text buffers in source/cache files. |
| `struct shop` | `F:\Realmz\src\realmz_orig\structs.h:338` | 3002-byte shop record copied to `CS`. |

## Endian Conversion

| Function | Source | Applies To |
| --- | --- | --- |
| `CvtDoorToPc` | `F:\Realmz\src\realmz_orig\convert.c:195` | `doorid`, `code[8]`, `id[8]`; char fields remain byte values. |
| `CvtRandLevelToPc` | `F:\Realmz\src\realmz_orig\convert.c:223` | Random rectangles, percents, battle ranges, random door references, booleans, sounds, text ids. |
| `CvtMonsterToPc` | `F:\Realmz\src\realmz_orig\convert.c:236` | Monster short fields; byte stats and name bytes are not byte-swapped. |
| `CvtEncount2ToPc` | `F:\Realmz\src\realmz_orig\convert.c:260` | Complex encounter id matrix, spell/item ids, booleans, prompt. |
| `CvtEncountToPc` | `F:\Realmz\src\realmz_orig\convert.c:269` | Simple encounter id matrix, boolean, prompt. |
| `CvtBattleToPc` | `F:\Realmz\src\realmz_orig\convert.c:275` | Battle grid, message ids, battle macro. |
| `CvtShopToPc` | `F:\Realmz\src\realmz_orig\convert.c:282` | Shop item ids and inflation. |

## Scenario Setup And Runtime Cache Copy

`setupnewgame.c` copies source scenario files into generated runtime caches. The
copy loops are the strongest evidence for container ownership and record
packing:

| Source Files | Runtime Cache | Source Anchor | Notes |
| --- | --- | --- | --- |
| `Data DD`, `Data LD`, `Data RD` | `:Data Files:CL` | `F:\Realmz\src\realmz_orig\setupnewgame.c:76` | Repeats door table, field grid, randlevel, and land `site`. |
| `Data DDD`, `Data DL`, `Data RDD` | `:Data Files:CD` | `F:\Realmz\src\realmz_orig\setupnewgame.c:104` | Repeats door table, field grid, randlevel. |
| `Data SD` | `:Data Files:CS` | `F:\Realmz\src\realmz_orig\setupnewgame.c:128` | Shops copied as fixed `struct shop` records. |
| `Data TD2` | `:Data Files:CT` | `F:\Realmz\src\realmz_orig\setupnewgame.c:139` | Thief records copied as fixed structs. |
| `Data TD3` | `:Data Files:CTD3` | `F:\Realmz\src\realmz_orig\setupnewgame.c:151` | Timed encounter records copied as fixed structs. |
| `Data ED` | `:Data Files:CE` | `F:\Realmz\src\realmz_orig\setupnewgame.c:164` | Header plus four 80-byte text buffers per simple encounter. |
| `Data ED2` | `:Data Files:CE2` | `F:\Realmz\src\realmz_orig\setupnewgame.c:184` | Header plus nine 40-byte text buffers per complex encounter. |

## Runtime Consumers

| Surface | Source Anchor | Why It Matters |
| --- | --- | --- |
| Map load | `F:\Realmz\src\realmz_orig\loadland-loadpixmap.c:5` | Reads `CL`/`CD`, converts door/field/randlevel, and loads outdoor tile art by `randlevel.landlook`. |
| Macro/action load | `F:\Realmz\src\realmz_orig\flashrange-loaddoor.c:47` | `loaddoor2(id)` loads a `Data ED3` record, converts it, then preserves the current trigger location/percent fields. |
| EDCD load | `F:\Realmz\src\realmz_orig\misc.c:560` | `loadextracode(id)` reads five signed shorts from `Data EDCD` and byte-swaps them. |
| Trigger dispatcher | `F:\Realmz\src\realmz_orig\newland.c:108` | Main opcode switch. This is the authority for action semantics. |
| Random encounter check | `F:\Realmz\src\realmz_orig\textbox-time.c:375` | Uses `randlevel` rectangles, percents, random-door percent slots, battle ranges, sounds, and text. |
| Timed encounter check | `F:\Realmz\src\realmz_orig\textbox-time.c:238` | Reads generated `CTD3` and can trigger doors from timed conditions. |
| Dungeon movement/secrets | `F:\Realmz\src\realmz_orig\threed.c:532` | Tests dungeon field bits for collision, secret pass-through, and encounter flags. |
| Dungeon overhead render | `F:\Realmz\src\realmz_orig\threed.c:741` | Draws top-down dungeon tiles from `Data DL` field bits and shared tiny sprites. |
| Tiny dungeon sprites | `F:\Realmz\src\realmz_orig\main.c:1078` | Defines 16x16 source rects at `PICT 302`, x 576, y 320. |
| Shared dungeon art load | `F:\Realmz\src\realmz_orig\GWorldInit.c:148` | Loads `PICT 302` into `gthePixels`. |

## Mutation Anchors

These callsites are useful when deciding whether a source record describes
authored content, runtime state, or both.

| Behavior | Source Anchor | Schema Impact |
| --- | --- | --- |
| Random door one-shot state | `F:\Realmz\src\realmz_orig\textbox-time.c:375` | Positive `randdoorpercent` can be zeroed after firing, then the map cache is saved. |
| Timed encounter day state | `F:\Realmz\src\realmz_orig\textbox-time.c:238` | `dotime.day` advances and is written back to `CTD3`. |
| Map/random metadata save | `F:\Realmz\src\realmz_orig\save-direction-order.c:584` | Runtime `randlevel` and map state can be written back by level. |
| Opcode random region edit | `F:\Realmz\src\realmz_orig\newland.c:942` | Opcode `92` adjusts random region percent and rectangles via EDCD rows. |
| Opcode battle range edit | `F:\Realmz\src\realmz_orig\newland.c:2268` | Opcode `23` writes random-region percent and battle range. |
| Opcode battle range edit inverse | `F:\Realmz\src\realmz_orig\newland.c:2299` | Negative opcode path mirrors the random-region mutation behavior. |
| Opcode landlook/dark edit | `F:\Realmz\src\realmz_orig\newland.c:3450` | Opcode `57` changes rendering metadata and dark state. |
| Monster death macro | `F:\Realmz\src\realmz_orig\killbody.c:116` | Monster `todoondeath` can load a macro, creating combat-to-script links. |
| Battle macro | `F:\Realmz\src\realmz_orig\getup.c:78` | Battle `battlemacro` can load an action macro. |

## Render And Asset Anchors

| Behavior | Source Anchor | Schema Impact |
| --- | --- | --- |
| Land tile atlas selection | `F:\Realmz\src\realmz_orig\loadland-loadpixmap.c:32` | Outdoor map render profile comes from `randlevel.landlook`. |
| Custom landlook paths | `F:\Realmz\src\realmz_orig\loadland-loadpixmap.c:42` | Landlooks `6..8` use scenario custom tile resources/files. |
| PICT atlas id | `F:\Realmz\src\realmz_orig\loadland-loadpixmap.c:88` | Standard/custom atlas lookup uses `PICT 300 + landlook`. |
| Dungeon overhead background | `F:\Realmz\src\realmz_orig\threed.c:765` | `tiny[15]` is the black background tile. |
| Dungeon party marker | `F:\Realmz\src\realmz_orig\threed.c:786` | Party direction markers use `tiny[15 + head]`. |
| Dungeon bitfield sprites | `F:\Realmz\src\realmz_orig\threed.c:798` | Field bits choose tiny dungeon sprites. |

## Documentation Rule

When a parser or UI claim cannot be traced to this index, a generated inventory,
or a fixture, it should be marked `inferred` or `unknown`.
