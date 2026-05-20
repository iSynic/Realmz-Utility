# Opcode Runtime Reference

This is the working reference for scenario action opcodes. The complete source
authority is `F:\Realmz\src\realmz_orig\newland.c`; the generated source map at
`F:\Realmz\docs\modernization\newland-opcode-map-generated.md` provides line
ranges, installed reference counts, EDCD-use markers, and branch markers.

## Classification Rules

- `rawCode` is the signed opcode as stored in a `struct door` action slot.
- `code` is the normalized opcode used for semantic classification.
- Negative opcodes usually behave like gosub-style variants, except documented
  special cases such as `-14` and `-23`.
- If an opcode loads `Data EDCD`, the action must link to the EDCD row by raw
  source id even when the row's semantic field names are still incomplete.
- Unknown opcodes and missing EDCD rows are diagnostics, not ignored bytes.

## Confirmed High-Linkage Shapes

| Opcode | Runtime meaning | Important links |
| ---: | --- | --- |
| `1` | show text/message | `shows_message` |
| `2` | start battle, optionally message/sound/booty/branch | `starts_battle`, `shows_message`, `calls_macro` |
| `3` | choice prompt and branch | `shows_message`, `branches_to`, `calls_macro` |
| `4` / `5` | simple/complex encounter | `starts_encounter` |
| `6` / `73` | shop or restricted shop | `opens_shop` |
| `7` | copy/patch action data or encounter result | `uses_parameter_row`, `calls_macro`, `mutates_trigger`, `mutates_encounter_state` |
| `10` | treasure reward | `gives_treasure` |
| `12` / `13` / `25` | map icon or trigger/door mutation | `mutates_tile`, `mutates_trigger` |
| `20` / `45` | teleport or teleport-only | `loads_map`, `moves_party`, `shows_message` |
| `23` / `-23` / `92` | random-region mutation | `mutates_random_region` |
| `27` | show picture | `uses_resource:PICT:<id>` |
| `29` | give/display map | `uses_map_record` |
| `30` / `31` | pick/branch by attribute or special ability check | `branches_to`, `calls_macro` |
| `39` | extend/load more door codes | `calls_macro` |
| `41` / `43` | mutate encounter option or apply condition | `mutates_encounter_state`, `alters_character_state` |
| `46` / `47` / `72` / `76` / `77` | quest flag/value read/write | `reads_flag`, `writes_flag`, `branches_to` |
| `48` / `56` / `107` | selective/battle outcome flow | `starts_battle`, `calls_macro`, `shows_message` |
| `50` / `52` / `53` | character selection filters | `selects_characters` |
| `54` | timed encounter mutation | `mutates_time_encounter` |
| `57` / `106` | landlook/darkness mutation | `changes_rendering`, `mutates_runtime_state` |
| `67` / `68` / `69` / `70` / `74` / `90` / `108` | item-charge branch and party/character state changes | `branches_to`, `alters_party_state`, `alters_character_state` |
| `85` / `86` / `87` | random/misc/allies branch | `branches_to`, `calls_macro`, `shows_message` |
| `120` / `123` / `124` / `125` / `126` | combat monster mutation/spawn/rout/destroy or combat-round macro | `uses_monster`, `uses_resource:cicn:<id>`, `calls_macro` |

## EDCD Coverage Policy

The utility currently records every EDCD row as five signed shorts, then adds
source-backed field labels for common opcodes. Low-frequency opcodes keep a
generic five-short row shape until the exact `newland.c` field use is
documented. Corpus reports aggregate these shapes so the next archaeology pass
can target the highest-use generic rows first.

## Current Normalized Opcode Coverage

This table mirrors the parser's current normalized opcode labels. It is not the
final semantic spec for every opcode; it is the audited coverage surface that
must either link to source-backed behavior or emit diagnostics.

| Opcode | Current label | Category |
| ---: | --- | --- |
| `-23` | alter dungeon random rect | map |
| `-14` | pick inverse characters | state |
| `1` | text | ui_text |
| `2` | battle | combat |
| `3` | choice | branch |
| `4` | simple encounter | encounter |
| `5` | complex encounter | encounter |
| `6` | load shop | item_shop |
| `7` | action data / X-AP patch | branch |
| `8` | same as other door | branch |
| `9` | play sound | ui_text |
| `10` | give treasure | item_shop |
| `11` | give experience | combat |
| `12` | new land icon | map |
| `13` | enable / disable door | map |
| `14` | pick characters | state |
| `15` | damage or heal picked characters | state |
| `16` | damage or heal party | state |
| `17` | cast spell on picked characters | state |
| `18` | cast spell on party | state |
| `19` | display random string | ui_text |
| `20` | teleport | map |
| `21` | branch on item possession | branch |
| `22` | alter item status | item_shop |
| `23` | alter land random rect | map |
| `24` | keep codes | branch |
| `25` | remove door x-y | map |
| `26` | get click | ui_text |
| `27` | show picture | ui_text |
| `28` | center screen | map |
| `29` | give / display map | ui_text |
| `30` | pick by ability or attribute check | branch |
| `31` | branch on ability check | branch |
| `32` | offer temple | item_shop |
| `33` | take gold | item_shop |
| `34` | break encounter loop | flow |
| `35` | eliminate simple encounter option | encounter |
| `36` | store / give equipment | item_shop |
| `37` | dungeon move | map |
| `38` | branch on possession II | branch |
| `39` | extend door codes | branch |
| `40` | branch on party condition | branch |
| `41` | eliminate simple encounter option | encounter |
| `42` | branch on percent chance | branch |
| `43` | give condition | state |
| `44` | break complex encounter option | encounter |
| `45` | teleport only | map |
| `46` | branch on quest flag | quest_read |
| `47` | set quest flag | quest_write |
| `48` | selective combat | combat |
| `49` | bank | item_shop |
| `50` | pick by race / caste / gender | branch |
| `51` | alter shop | item_shop |
| `52` | pick by position / movement / item / percent | branch |
| `53` | pick on caste | branch |
| `54` | alter time encounter | time |
| `55` | branch on picked characters | branch |
| `56` | branch on battle outcome | branch |
| `57` | change land look | map |
| `58` | branch on difficulty level | branch |
| `59` | branch on tile id | branch |
| `60` | alter party money | item_shop |
| `61` | shift party level/x/y | map |
| `62` | display scrolling text | ui_text |
| `63` | alter game time | time |
| `64` | branch on game time | branch |
| `65` | award random items | item_shop |
| `66` | disable / enable camping | time |
| `67` | branch on item charges | branch |
| `68` | alter party fatigue | state |
| `69` | set spell casting / charging flags | state |
| `70` | save / restore party position | map |
| `71` | disable / enable coordinate display | ui_text |
| `72` | branch on range of quest flags | quest_read |
| `73` | load shop and restrict items | item_shop |
| `74` | take / give spell points | state |
| `75` | branch on spell points | branch |
| `76` | increment / decrement quest value | quest_write |
| `77` | branch on quest value | quest_read |
| `78` | branch on tile parameters | branch |
| `81` | branch on PC condition | branch |
| `82` | turn priest turning off | state |
| `83` | turn priest turning on | state |
| `84` | check scenario registration | registration |
| `85` | branch to random door | branch |
| `86` | branch on misc | branch |
| `87` | branch on allies in party | branch |
| `88` | drop allies from party | state |
| `89` | add allies to party | state |
| `90` | take away victory | state |
| `91` | drop all equipment | item_shop |
| `92` | alter random rect size | map |
| `93` | turn compass on | map |
| `94` | turn compass off | map |
| `95` | change look direction | map |
| `96` | require 3D map | map |
| `97` | allow full map | map |
| `98` | require registered game | registration |
| `99` | get scenario registration | registration |
| `100` | end battle | combat |
| `101` | back up party | map |
| `102` | level up picked characters | combat |
| `103` | test/set boat/camp status | state |
| `104` | set encounter status | encounter |
| `105` | activate / disable allies | state |
| `106` | set darkland status | map |
| `107` | improved selective battle | combat |
| `108` | alter selected character | state |
| `111` | return from gosub | flow |
| `112` | pop stack | flow |
| `119` | revive NPC / party after combat | state |
| `120` | alter NPC or monster during combat | combat |
| `121` | de-animate lower level undead | combat |
| `122` | cause fumble | combat |
| `123` | cause rout | combat |
| `124` | spawn | combat |
| `125` | destroy related monsters | combat |
| `126` | battle combat-round macro | combat |
| `127` | continue if monster present | combat |

## Remaining Work

- Promote all generic EDCD rows to opcode-specific shapes where source evidence
  exists.
- Split `branch` links into precise false/true/keep/drop/gosub variants.
- Add writeback links for every opcode that mutates generated caches.
- Add fixture assertions for rare opcodes before renaming ambiguous fields.
