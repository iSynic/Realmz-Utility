# Opcode And EDCD Semantics

This page tracks the first source-backed opcode/EDCD pass. The parser's
runtime table is in `src/realmz-parser.mjs`.

## Sources

- `F:\Realmz\docs\modernization\newland-opcode-map-generated.md`
- `F:\Realmz\docs\modernization\scenario-opcode-inventory-generated.md`
- `F:\Realmz\src\realmz_orig\newland.c`
- `F:\Realmz\src\realmz_orig\misc.c:loadextracode`

## Implemented In This Pass

- The opcode label table now covers every top-level `newland.c` case from the
  generated opcode map instead of only the high-frequency subset.
- Actions that load `Data EDCD` now carry `extracodeUsage` with:
  - source-backed summary text
  - slot labels for the five signed-short parameters
  - semantic links to messages, battles, shops, treasure, timed encounters,
    map levels, macros, simple encounters, and complex encounters when the
    source behavior is understood.
- The inspector's action summaries prefer `extracodeUsage.summary`, so common
  cases like battle, teleport, restricted shop, and branch actions describe the
  real EDCD targets instead of showing the EDCD row id as if it were the target
  record.

## Important EDCD Shapes

| Opcode | Shape | Notes |
| --- | --- | --- |
| `2` battle | `[battleLow, battleHigh, soundOrReviveMacro, message, bootyMode]` | `battleHigh == 0` means a single battle. Negative `battleLow` marks surprise behavior in the game. |
| `3` choice | `[replyPolarity, branchMode, branchTarget, promptA, promptB]` | Branch mode `1/2/3` maps to macro/simple/complex. |
| `7` action data | `[-1|-2|level, targetRecord, macro, levelKind, resultSlot]` | `-1` replaces simple encounter result actions; `-2` replaces complex encounter result actions; otherwise copies a macro into a door on a level cache. |
| `12` tile mutation | `[level, xOrDungeonY, yOrDungeonX, tileValue, isDungeon]` | Writes a field value and saves the target level cache. |
| `13` trigger percent mutation | `[level, singleTrigger, percent, rangeStartWithSign, rangeEnd]` | Sign on `rangeStartWithSign` selects dungeon/land for range edits. |
| `15` / `16` damage/heal | `[multiplier, low, high, sound, message]` | Applies `multiplier * randrange(low, high)` to picked characters or party. |
| `17` / `18` cast spell | `[spell, powerLevel, saveAdjust, forceAffect, unused]` | Targets picked characters or party. |
| `20` / `45` teleport | `[level, x, y, sound, message]` | `45` performs teleport only; `20` can chain into a second trigger on arrival. |
| `21` item branch | `[item, branchMode, missingBehavior, hasTarget, missingTarget]` | Branch mode `0/1/2` maps to macro/simple/complex. Missing behavior `2` displays `missingTarget` as a message. |
| `22` item mutation | `[item, maxMatches, mode, chargeDelta, replacementItem]` | Mode `1` drops, `2` changes charges, `3` replaces item. |
| `23` / `-23` random battle mutation | `[level, randomRegion, percent, battleLowOrKeep, battleHighOrKeep]` | Land and dungeon variants mutate `randlevel` and save the target level cache. |
| `30` pick by check | `[abilityOrAttribute, adjustment, sourceSet, attributeFlag, unused]` | Selects picked characters by a special ability or attribute check; negative selector reverses the result. |
| `31` branch by check | `[abilityOrAttribute, adjustment, attributeFlag, successMacro, failureMacro]` | Branches through `loaddoor2` based on a picked character check. |
| `33` take/check gold | `[amount, failureMarker, unused, unused, unused]` | Negative amount uses the check-only path. |
| `37` dungeon move | `[mode, xOrDirection, yOrDirection, sound, message]` | Exact mode taxonomy still needs fixtures. |
| `38`, `46`, `58`, `59` force branch | `[testA, testB, branchMode, target, slot]` | These share the `forcebranch` label in `newland.c`; branch mode `0/1/2/3/-1` maps to macro/simple/complex/keep/drop. |
| `41` eliminate encounter option | `[simpleEncounter, oneBasedChoiceSlot, unused, unused, unused]` | Mutates the generated `CE` cache by clearing a simple encounter choice result. |
| `42` percent branch | `[percent, successBehavior, branchMode, target, slot]` | Uses the same force-branch tail. |
| `43` give condition | `[scope, condition, durationOrDelta, sound, unused]` | Scope `0/1/2` applies to party/picked/alive characters. |
| `48`, `56`, `107` battle variants | `[battleLow, battleHigh, branchOrSound, message, extra]` | All start a battle range; branch/treasure meaning varies by opcode. |
| `50` race/caste/gender pick | `[selector, gender, raceCasteOrClass, unused, livingOnly]` | Selector covers race, gender, caste, race class, and caste class. |
| `52` character selector | `[selector, value, sourceSet, unused, unused]` | Selector covers movement, position, item, percent, saves, selected PC, worn item, exact position. |
| `53` caste pick | `[exactCaste, casteGroup, sourceSet, unused, unused]` | Caste group `1/2/3` maps to fighter/magical/thief-monk group tests. |
| `57` change land look | `[landlook, isDark, targetLandLevel, unused, unused]` | Loads the target land cache, mutates `randlevel.landlook`/`isdark`, saves it, and reloads the current map. |
| `60` clear money | `[moneyType, pickedOnly, unused, unused, unused]` | Money type `1/2/3` maps to gold/gems/jewelry. |
| `61` shift position | `[legacyLevel, xShift, yShift, randomize, unused]` | Randomize chooses random signed offsets up to x/y. |
| `63` alter game time | `[mode, day, hour, minute, unused]` | Mode `1` sets values, mode `2` offsets them. |
| `65` random items | `[count, itemLow, itemHigh, unused, unused]` | Negative count randomizes the number of items. |
| `67` item-charge branch | `[item, branchMode, minimumCharges, successTarget, failureTarget]` | Branch mode `0/1/2` maps to macro/simple/complex. |
| `68` alter fatigue | `[mode, unused, percent, unused, unused]` | Mode `1/2/3` sets exhausted/rested/scaled fatigue. |
| `69` spell flags | `[spellcasting, monstercasting, spellcharging, unused, unused]` | Sets combat spell-casting/charging globals. |
| `70` save/restore position | `[mode, unused, unused, unused, unused]` | Mode `1` saves current party position; mode `2` restores it. |
| `72`, `75` branch to target | `[testA, testB, falseBehavior, branchMode, target]` | Branch mode `0/1/2` maps to macro/simple/complex. |
| `73` restricted shop | `[shop, range1Low, range1High, range2Low, range2High]` | Negative shop id opens item handling around the shop flow. |
| `74` spell-point change | `[rollCount, low, high, playSound, message]` | Negative roll count subtracts spell points from picked casters; source uses slot `1` as the sound id when slot `3` is truthy. |
| `76` quest value change | `[quest, delta, branchMode, threshold, target]` | Branch mode `1/2/3` maps to macro/simple/complex. |
| `77`, `78` false/true branch | `[testA, testB, branchMode, falseTarget, trueTarget]` | Branch mode `0/1/2` maps to macro/simple/complex. |
| `81` condition branch | `[condition, characterSelector, unused, trueMacro, falseMacro]` | Branches only to macros in source. |
| `85` random branch | `[branchMode, rangeLow, rangeHigh, sound, message]` | Branches to a random macro/simple/complex record in range. |
| `86`, `87` conditional branch | `[testSelector, branchModeOrValue, falseBehavior, trueTarget, falseTarget]` | `87` can also display a missing-allies message. |
| `90` take victory | `[amount, scope, unused, unused, unused]` | Removes experience/victory from picked, split-party, or each-character scopes. |
| `92` random-rect mutation | `[level, rect, isDungeon, percentDelta, shapeMode]` | Shape details are read from the next EDCD row. |
| `103` boat/camp state | `[mode, statusValue, branchModeOrBehavior, targetOrValueA, targetOrValueB]` | Source-backed at field-use level; exact mode names still need fixtures. |
| `108` alter selected character | `[statSelector, delta, unused, unused, unused]` | Mutates selected-character combat/stat fields such as attacks, movement, stamina, AR, to-hit, magic resistance, and prestige. |
| `120` alter combat monster | `[targetClass, monsterId, count, replacementIcon, traitorOverride]` | Links to matching `Data MD` monster id and replacement `cicn` resource when present. |
| `121` de-animate undead | `[unused, unused, unused, unused, unused]` | Source loads EDCD but does not read the row before destroying lower-level undead. |
| `122` fumble | `[message, sound, unused, unused, unused]` | Can show a fumble message during combat. |
| `123` cause rout | `[monster1, monster2, monster3, monster4, monster5]` | Each non-zero id is matched against active combat monster ids. |
| `124` spawn | `[unused, monster, count, sound, traiterOverride]` | Links to `Data MD` monster records. Negative count randomizes. |
| `125` destroy related monsters | `[monsterId, maxCount, unused, unused, includeTraitorSide]` | Max `0` is treated as `100` by the source path. |
| `126` battle macro | `[mode, roundOrPercent, repeatMode, macroLow, macroHigh]` | Repeat mode `2` branches to a random macro in range. |

## Remaining Gaps

- Zero-opcode slots with leftover ids are now preserved as `format_gap`
  diagnostics instead of being counted as executable unknown opcodes. They
  remain visible through Decoding and Technical Evidence until fixture or source
  evidence proves a stronger meaning.
- `Data ED3` macro records are now promoted to executable script only when they
  are reachable from decoded triggers, recursive macro calls, battle macros, or
  monster death hooks. Other non-empty ED3 rows remain raw format evidence under
  the Decoding workbench instead of inflating unknown-opcode counts.
- Several low-frequency opcodes still have generic EDCD labels even though they
  now have source-backed opcode names.
- Individual `PICT`, `cicn`, `STR#`, and other resource-fork entries now exist
  as schema records/entities, but full resource-type taxonomy is still open.
- The UI can follow more linked records now, but reverse-link panels should move
  to the normalized schema instead of recomputing links from action objects.
