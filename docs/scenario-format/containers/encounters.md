# Encounters

Realmz encounters are scriptable conversation/event records. They can show text,
offer choices, check words, check spells/items, invoke thief mechanics, and
execute action slots that behave like miniature door scripts.

## Containers

| File | Header | Text payload | Runtime cache | Confidence |
| --- | ---: | ---: | --- | --- |
| `Data ED` | `sizeof(struct encount)` = `106` bytes | `4 * 80` bytes | `:Data Files:CE` | source-backed |
| `Data ED2` | `sizeof(struct encount2)` = `160` bytes | `9 * 40` bytes | `:Data Files:CE2` | source-backed |

`setupnewgame.c` copies both source files into generated runtime caches:

- `Data ED` loop starts at `F:\Realmz\src\realmz_orig\setupnewgame.c:164`;
- `Data ED2` loop starts at `F:\Realmz\src\realmz_orig\setupnewgame.c:184`.

The copy loops are important because they show that text buffers are physically
part of each encounter record even though the struct declarations only describe
the header.

## Simple Encounter Header

`struct encount` is defined in `F:\Realmz\src\realmz_orig\structs.h:242`.

Known fields:

| Field | Shape | Meaning |
| --- | --- | --- |
| `code` | `4 x 8` bytes | Four choice/script rows of eight action opcodes. |
| `id` | `4 x 8` shorts | Matching action ids/parameters. |
| `choiceresult` | `4` bytes | Choice result behavior. |
| `canbackout` | Boolean | Whether the user can exit without choosing. |
| `maxtimes` | byte | Use-count or repeat limit. |
| `castesuccess` | byte | Caste-related result behavior. |
| `prompt` | short | Prompt/message id. |

The text payload is four 80-byte buffers. These are copied directly after the
header in setup, so the practical record size is:

```text
106 + (4 * 80) = 426 bytes
```

## Complex Encounter Header

`struct encount2` is defined in `F:\Realmz\src\realmz_orig\structs.h:226`.

Known fields:

| Field | Shape | Meaning |
| --- | --- | --- |
| `code` | `4 x 8` bytes | Four action rows. |
| `id` | `4 x 8` shorts | Matching ids/parameters. |
| `choiceresult` | byte | Choice resolution. |
| `wordresult` | byte | Word-entry resolution. |
| `group` | `8` bytes | Group or gating bytes, unresolved. |
| `spellid` | `10` shorts | Spell checks/options. |
| `spellresult` | `10` bytes | Results for spell checks. |
| `itemid` | `5` shorts | Item checks/options. |
| `itemresult` | `5` bytes | Results for item checks. |
| `canbackout` | Boolean | Whether exit is allowed. |
| `thief` | Boolean | Thief mechanic flag. |
| `maxtimes` | byte | Use-count or repeat limit. |
| `castesuccess` | byte | Spell/caste success behavior. |
| `thiefsuccess` | byte | Thief success behavior. |
| `thieffail` | byte | Thief failure behavior. |
| `prompt` | short | Prompt/message id. |

The text payload is nine 40-byte buffers. Practical record size:

```text
160 + (9 * 40) = 520 bytes
```

## Action Slots Inside Encounters

Encounter `code/id` matrices should be normalized like action slots:

- row identity: encounter record plus row/slot;
- raw opcode and id bytes;
- semantic classification from the same opcode map as door scripts when the
  runtime path matches;
- links to messages, battles, shops, macros, flags, resources, and map targets.

This is the main bridge from "conversation text" to the rest of the scenario
graph.

## Runtime Mutation

The generated `CE` and `CE2` files are runtime state. Some actions can change
encounter availability or repeat state. The source files are the browsing
authority for authored content, while generated caches explain save-linked
state.

Schema implication:

- source encounter records should have stable source IDs;
- runtime mutations should be modeled as `writes_runtime_state` or
  `mutates_encounter_state`, not as a different source encounter.

## Partial And Legacy Records

Some scenarios have trailing or partial encounter/string data. The original
copy loops read a struct header first, then attempt text-buffer reads without
strong validation. This means partial records can be compatibility facts rather
than immediate parser failures.

Utility behavior should be:

- parse full records normally;
- report trailing bytes and partial text payloads as diagnostics;
- keep any source byte range that was successfully decoded;
- avoid inventing missing choice rows or missing text.

## Utility Schema Mapping

Recommended entities:

- `encounter_simple:<index>`;
- `encounter_complex:<index>`;
- `encounter_choice:<index>:<row>`;
- `encounter_action_slot:<index>:<row>:<slot>`;
- `encounter_text:<index>:<buffer>`.

Recommended links:

- `starts_encounter` from action slots to encounter entities;
- `offers_choice` from encounter to choice rows;
- `executes` from choice rows to action slots;
- `requires_item`, `requires_spell`, `uses_prompt`, `uses_text`;
- `mutates_encounter_state` for repeat/max-times behavior.

## Open Questions

- Complete `choiceresult`, `wordresult`, `group`, and result-byte meanings need
  source pass and fixtures.
- Complex encounter thief behavior should be tied directly to `Data TD2`.
- Encounter text encoding edge cases need a small fixture set with raw bytes and
  expected display strings.
