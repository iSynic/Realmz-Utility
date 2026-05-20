# Supporting Records

These containers are not secondary in gameplay, but they become meaningful only
when linked from action records, encounters, map metadata, or runtime systems.

## Battles: `Data BD`

`struct battle` is defined in `F:\Realmz\src\realmz_orig\structs.h:125`.
Known layout:

- `battle[13][13]`: signed shorts, monster placement or battle tile contents;
- `dist`: byte distance/engagement setup;
- `messagebefore`: short message id;
- `messageafter`: short message id;
- `battlemacro`: short macro/action id.

`CvtBattleToPc` converts the grid and message/macro shorts. The utility should
create links from battles to:

- monsters referenced by the grid;
- before/after messages;
- battle macro records loaded through `loaddoor2`;
- map/random regions or action slots that start the battle.

Open issue: exact interpretation of every grid value needs combat source and
fixture assertions. Current occupancy summaries are useful but not sufficient.

## Monsters: `Data MD`

`struct monster` is defined in `F:\Realmz\src\realmz_orig\structs.h:159`.
The record includes combat stats, attack definitions, saves/immunities, carried
money/items/spells, `iconid`, experience, current stamina, state bytes,
`todoondeath`, max spell points, and a 40-byte monster name.

Important semantic links:

- `uses_icon_resource` from `iconid` to `resource:cicn:<id>`; the actual bytes
  may live in the scenario fork or shared Realmz resources;
- `drops_item` or `carries_item` from item slots;
- `casts_spell` from spell slots;
- `calls_macro` from `todoondeath`;
- `appears_in_battle` from battle grids.

Open issue: death actions and battle-time mutated monster state should be
distinguished from authored monster templates.

## Shops: `Data SD`

`struct shop` is defined in `F:\Realmz\src\realmz_orig\structs.h:338` and is
copied to `:Data Files:CS` by `setupnewgame.c`. `CvtShopToPc` confirms that
item IDs and inflation are swapped.

The current parser can summarize item counts, quantities, and inflation. Deeper
schema work should add:

- `shop` entities with stable record IDs;
- `sells_item` links per slot;
- `uses_message` links for any prompt/name text that source confirms;
- `writes_runtime_state` links for stock changes in `CS`.

## Scenario Strings And Messages: `Data SD2`

`Data SD2` is the scenario text/message pool used by multiple runtime paths:
action messages, random encounter optional text, shops, menus, and UI prompts.
The current utility parses Pascal-style text slots.

Needed semantic split:

- raw message record: byte range and decoded string;
- semantic use: shown by trigger, used as prompt, random encounter text, shop
  label, or external note;
- external display: complete text and linkable message detail page.

## Treasure: `Data TD`

`struct treasure` is defined in `F:\Realmz\src\realmz_orig\structs.h:221`:

- `itemid[20]`;
- `exp`, `gold`, `gems`, `jewelry`.

This is a compact reward container. It should link to item records once item
format coverage is part of the schema.

Open issue: treasure consumers and any one-shot/cache behavior need direct
runtime anchors.

## Thief Encounters: `Data TD2`

`struct thief` is defined in `F:\Realmz\src\realmz_orig\structs.h:192` and is
copied to `:Data Files:CT`.

Known fields include:

- ten type flags;
- success/failure codes;
- success/failure text and sound ids;
- spell, damage range, tumbler count;
- prompts and prompt sounds.

The utility should link thief records to:

- messages and sounds;
- actions executed on success/failure;
- complex encounter records that set the thief flag;
- spells/items once those records have stable entities.

## Timed Encounters: `Data TD3`

`struct timeencounter` is defined in `F:\Realmz\src\realmz_orig\structs.h:133`
and copied to `:Data Files:CTD3`. `textbox-time.c` checks it during time/day
advancement.

Known runtime behavior from `F:\Realmz\src\realmz_orig\textbox-time.c:238`:

- day advances by `increment`;
- percent gates activation;
- optional item and quest conditions can gate activation;
- optional land/dungeon level, random rectangle, x, and y gates can restrict
  location;
- successful activation calls `newland` with the timed encounter `door`.

Recommended links:

- `reads_flag` for quest requirements;
- `requires_item`;
- `uses_region` for `recrect`;
- `calls` or `triggers` to the action door/macro.

## Map Notes: `Data MD2`

The source defines `struct maps` with icon slots, start x/y, level, picture id,
icon size, show flag, dungeon flag, rectangle, and a Pascal-style note.

The utility currently uses map records and resource names as map name evidence.
Future work should separate:

- authored map note/record;
- inferred map name;
- wiki/external name;
- start/preview marker;
- picture/icon resource reference.

## Contact Info: `Data CI`

`Data CI` is source-backed through `contactinfo.c:loadcontact` and is currently
parsed as fixed scenario metadata strings. It should feed scenario-level
entities, not map-level semantics.

## Menu Cache: `Data MENU`

`Data MENU` is a generated monster menu/cache surface, source-backed through
`menuinit.c`. It is useful as runtime evidence but should not become the source
of authored monster identity while `Data MD` exists.

## Solids: `Data Solids`

`Data Solids` is a fixed table used by contact/solidity paths. It should be
treated as a terrain/contact lookup table. Current confidence is
source-backed partial because all byte meanings and consumers still need a
focused pass.

## Save-Linked Scenario State

Several containers are copied into generated runtime files and later mutated:

- `CL` and `CD` for map, trigger, and random metadata state;
- `CE` and `CE2` for encounter state;
- `CS` for shop state;
- `CT` and `CTD3` for thief/timed state.

The normalized schema should preserve authored source content and model cache
mutations as runtime state edges. This is especially important for one-shot
triggers, random-door percents, shops, and timed encounters.
