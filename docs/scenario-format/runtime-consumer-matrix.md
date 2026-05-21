# Runtime Consumer Matrix

This matrix is the compact answer to: "Who consumes this scenario data, what
does it become at runtime, and what semantic links should the utility expose?"
Source paths under `F:\Realmz` are read-only evidence.

| Container | Runtime consumers | Cache/save behavior | Semantic output | Current gaps |
| --- | --- | --- | --- | --- |
| `Data LD` | `setupnewgame.c`, `loadland-loadpixmap.c`, outdoor drawing paths | Copied into `CL`; save/load paths can persist mutated map state | land map, field grid, tile/value evidence, render links | full outdoor field-value taxonomy |
| `Data DL` | `setupnewgame.c`, `loadland-loadpixmap.c`, `threed.c` | Copied into `CD`; dungeon state can be saved | dungeon map, bitfield cells, top-down dungeon render evidence | exact secret/pass-through bit names need more fixtures |
| `Data DD` | `setupnewgame.c`, `loadland-loadpixmap.c`, `newland.c` | Copied into `CL`; trigger percent/state can mutate | land trigger entities, action slots, graph links | unreachable/editor records need confidence labels |
| `Data DDD` | `setupnewgame.c`, `loadland-loadpixmap.c`, `newland.c` | Copied into `CD`; trigger percent/state can mutate | dungeon trigger entities, action slots, graph links | same as `Data DD` |
| `Data RD` | `setupnewgame.c`, `loadland-loadpixmap.c`, `textbox-time.c`, `newland.c` | Copied into `CL`; random-door percent and rect/battle metadata can mutate | render profile, random regions, battle ranges, macro/event links | `site` and all `option` meanings |
| `Data RDD` | `setupnewgame.c`, `textbox-time.c`, `newland.c` | Copied into `CD`; dungeon random metadata can mutate | dungeon random regions, battle ranges, macro/event links | dungeon-only region semantics |
| `Data ED3` | `flashrange-loaddoor.c:loaddoor2`, `newland.c`, combat death/battle macro paths | Source macro records are loaded into the active action context | macro entities, callable script graph nodes | macro header/location bytes are not placement evidence |
| `Data EDCD` | `misc.c:loadextracode`, many `newland.c` cases | Read on demand; neighboring rows may be consumed by some opcodes | parameter-row records, opcode field shapes, branch/mutation links | low-frequency opcode shapes |
| `Global` | `misc.c`, `partyloss.c`, `handlemenuchoice.c`, `buttonchoice.c` | Source-wide macro ids read on demand | source-backed ED3 roots for start/death/quit/shop/temple slots | remaining unnamed slots |
| `Data ED` | `setupnewgame.c`, `newland.c`, encounter runtime paths | Copied into `CE`; repeat/option state can mutate | simple encounter entities, text buffers, choice action slots | exact result-byte meanings |
| `Data ED2` | `setupnewgame.c`, `newland.c`, encounter runtime paths | Copied into `CE2`; repeat/option state can mutate | complex encounter entities, word/spell/item/thief gates | exact group/result-byte meanings |
| `Data BD` | `combat.c`, `combatsetup.c`, battle macro paths | Read as authored battle definitions | battle entities, monster/message/macro links | complete battle-grid value taxonomy |
| `Data MD` | `beast.c`, `combatsetup.c`, `spelllist.c`, `newland.c` | Monster templates are copied into combat state | monster entities, icon/resource/death-macro links | battle-time mutations vs source templates |
| `Data SD` | `setupnewgame.c`, shop/question paths, `newland.c` | Copied into `CS`; stock and inflation can mutate | shop entities and item-stock summaries | item database links |
| `Data SD2` | `editstring.c`, `question.c`, `textbox-time.c`, `newland.c` | Source text pool, read by many systems | message entities, prompt/text links | string encoding edge fixtures |
| `Data MD2` | `mapstuff.c`, map UI/resource-name paths | Source map-note records | map-note entities, start positions, name evidence | exact icon and rectangle use |
| `Data TD` | `newland.c` treasure paths | Source reward records | treasure entities and item/value summaries | treasure one-shot/cache ownership |
| `Data TD2` | `setupnewgame.c`, thief/encounter paths | Copied into `CT` | thief encounter entities, success/fail action/text/sound links | complex encounter integration details |
| `Data TD3` | `setupnewgame.c`, `textbox-time.c`, `newland.c` | Copied into `CTD3`; day/percent state mutates | timed encounter entities, time/item/quest/location gates | all `stuff[]` meanings |
| `Data CI` | `contactinfo.c:loadcontact` | Source metadata | scenario contact/info entity | label verification for every string slot |
| `Data MENU` | `menuinit.c` | Generated/effective monster menu cache | menu-cache diagnostics and monster-menu evidence | rebuild precedence and malformed-cache behavior |
| `Data Solids` | contact/solidity paths | Source lookup table | solidity/contact lookup entity | all byte meanings and tile-index mapping |
| Scenario resource fork | Resource Manager, `GetPicture`, `GetIndString`, map names, icon loaders | Read-only scenario assets | individual resource records/entities, resource-type rollups, map-name evidence, render/resource links | full resource type taxonomy |
| Family Jewels / shared resources | `GWorldInit.c`, `loadpixmap`, icon/tile drawing paths | Shared base art fallback | shared asset provenance and fallback diagnostics | explicit packaged fallback manifest |

## Mutation Model

The authored scenario files and generated runtime caches must be modeled as
different sources. `setupnewgame.c` creates `CL`, `CD`, `CE`, `CE2`, `CS`,
`CT`, and `CTD3`; later runtime code writes to those generated caches. The
schema should use links such as `copied_to_cache`, `mutates_cache`,
`writes_runtime_state`, and `calls` instead of overwriting source semantics.

## Implementation Rule

When a consumer is unknown or only partially known, keep the raw record in the
schema and emit a diagnostic. Do not hide the bytes behind a friendly name.
