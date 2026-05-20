# Byte Layout Reference

This page collects byte-level layout facts that are stable enough for parser and
fixture work. It complements the narrative container specs.

| Container | Record bytes | Endian behavior | Source backing |
| --- | ---: | --- | --- |
| `Data LD` | `16200` | signed big-endian shorts | `CvtFieldToPc`, `loadland` |
| `Data DL` | `16200` | signed big-endian shorts | `CvtFieldToPc`, `threed.c` |
| `Data DD` / `Data DDD` / `Data ED3` | `40` | `doorid`, `code[]`, `id[]` swapped; byte fields raw | `struct door`, `CvtDoorToPc` |
| `Data RD` / `Data RDD` | `644` | Rects and shorts swapped; byte/Boolean fields raw | `struct randlevel`, `CvtRandLevelToPc` |
| `Data EDCD` | `10` | five signed big-endian shorts | `loadextracode`, `CvtTabShortToPc` |
| `Data ED` | `426` | 106-byte header plus four 80-byte text buffers | `struct encount`, `setupnewgame.c` |
| `Data ED2` | `520` | 160-byte header plus nine 40-byte text buffers | `struct encount2`, `setupnewgame.c` |
| `Data BD` | `346` | battle grid and message/macro shorts swapped | `struct battle`, `CvtBattleToPc` |
| `Data MD` | `210` | short fields swapped; byte stats/name raw | `struct monster`, `CvtMonsterToPc` |
| `Data SD` | `3002` | item ids/inflation swapped; quantity bytes raw | `struct shop`, `CvtShopToPc` |
| `Data SD2` | `256` | Pascal-style text slot | runtime string readers |
| `Data MD2` | `340` | map-note shorts swapped; note is Pascal-style text | `struct maps` |
| `Data TD` | `48` | item ids and reward shorts swapped | `struct treasure` |
| `Data TD2` | `118` | text/sound/damage/prompt shorts swapped; code bytes raw | `struct thief` |
| `Data TD3` | `40` | all fields signed shorts | `struct timeencounter` |
| `Data CI` | `4608` | fixed contact/info text block | `contactinfo.c:loadcontact` |
| `Data MENU` | `502` | generated menu cache, indexed as fixed bytes | `menuinit.c` |
| `Data Solids` | `1024` | fixed lookup table | contact/solidity paths |
| Scenario resource fork | variable | classic Mac resource map: type list, reference list, data offsets, Pascal names | Resource Manager/resource fork parser |

## Confirmed Record Offset Highlights

- `struct door`: `doorid` at `0`, `landid` at `4`, `landx` at `5`,
  `landy` at `6`, `percent` at `7`, `code[8]` at `8`, `id[8]` at `24`.
- `struct battle`: `battle[13][13]` at `0`, `dist` at `338`,
  `messagebefore` at `340`, `messageafter` at `342`, `battlemacro` at `344`.
- `struct monster`: byte stats start at `0`, `iconid` at `98`, `exp` at `102`,
  `staminamax` at `106`, `todoondeath` at `166`, name bytes at `170..209`.
- `struct treasure`: `itemid[20]` at `0`, `exp` at `40`, `gold` at `42`,
  `gems` at `44`, `jewelry` at `46`.
- `struct timeencounter`: `day`, `increment`, `percent`, and `door` occupy
  offsets `0..7`; location/item/quest gates occupy `8..19`.
- Resource fork entries: the utility records type, id, attributes, data length,
  data byte range, reference-list offset, optional name-list offset, cleaned
  Pascal name, and content hash. Byte ranges are relative to the normalized
  resource fork after AppleSingle/AppleDouble extraction.

## Compatibility Rules

- Full fixed records are parsed normally.
- Trailing bytes are diagnostics.
- `Data ED` and `Data ED2` partial legacy records are accepted only when the
  header can be read; missing text payload bytes remain diagnostics.
- Generated runtime caches explain writeback behavior, but source files remain
  the authored browsing surface.
