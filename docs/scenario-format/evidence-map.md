# Evidence Map

The scenario parser is allowed to be incomplete. It should not be vague. Every
claim should carry a confidence value and point to the strongest evidence we
have.

## Confidence Values

| Value | Meaning |
| --- | --- |
| `confirmed` | Directly confirmed by source code, generated source reports, and stable fixture behavior. |
| `source-backed` | Supported by source anchors or modernization docs, but not yet covered by broad fixtures. |
| `fixture-backed` | Observed across generated scenario inventories or parser fixtures, but source linkage may be partial. |
| `runtime-observed` | Seen in screenshots/logs/manual runs; useful evidence, not authoritative alone. |
| `inferred` | Reasonable interpretation from structure or repeated use; needs source or fixture promotion. |
| `unknown` | Preserved and reported without a semantic claim. |

## Promotion Criteria

| From | To | Required Evidence |
| --- | --- | --- |
| `unknown` | `inferred` | Repeated structure, neighboring records, or source context makes one interpretation plausible without hiding uncertainty. |
| `inferred` | `fixture-backed` | Representative fixture assertions or generated corpus checks verify the interpretation across relevant scenarios. |
| `fixture-backed` | `source-backed` | A concrete source/report anchor explains the field, resource role, action, or link behavior. |
| `source-backed` | `confirmed` | Source anchors and regression fixtures agree, and the utility behavior is stable. |

## Anti-Criteria

- Repeated shape alone can move `unknown` to `inferred`, but it cannot move a
  claim to `fixture-backed` without fixture assertions or generated corpus
  checks.
- A broad file path is not enough for `source-backed`; the anchor must identify
  the concrete source/report location that explains the behavior.
- Friendly labels must remain `inferred` when they summarize a plausible intent
  but lack fixture or source proof.
- Preserved bytes, inactive rows, and editor leftovers should be documented as
  format evidence until a reachable runtime path proves they are executable
  semantics.
- Missing generated previews or cache files are runtime availability states, not
  semantic unknowns, when the underlying resource role is explained by a source
  anchor.

## Examples

| Claim | Correct Confidence |
| --- | --- |
| Active action word has no mapped dispatcher behavior. | `unknown` until source/runtime evidence explains it. |
| Non-empty unreferenced `Data ED3` row looks like an old macro. | `inferred` format evidence unless reachability is proven. |
| `Data ED3` row is called by a decoded map trigger, recursive macro call, `Global` macro slot, timed encounter, random-region door, negative battle macro, or monster death hook. | `source-backed` reachable macro path. |
| `Data ED3` row is referenced by EDCD copy/replace behavior but no direct `loaddoor2` path reaches it. | `possible` runtime mutation evidence, not executable semantics. |
| Positive battle macro field appears in `Data BD`. | Do not promote by itself; classic source only runs negative `battlemacro` values through `abs(value)`. |
| Trailing bytes or accepted partial records appear after decoded records. | `inferred` format evidence until source or fixtures prove a legacy record shape. |
| Resource type appears consistently in generated corpus inventories. | `fixture-backed` when fixtures assert the taxonomy or preview behavior. |
| Individual resource entries belong to a source-backed resource type such as `PICT`, `cicn`, `STR#`, `TEXT`, `styl`, `vers`, `snd `, or `RLMZ`. | `source-backed` for resource role/provenance; decoded preview availability and payload field taxonomy may remain fixture-backed, inferred, or runtime-observed. |
| Resource map contains all-zero type bytes. | `inferred` format evidence unless source proves a runtime role. |
| Land/Look tile atlas points to `PICT 300 + landlook`, but no PNG has been exported. | `source-backed` for the atlas role; preview availability stays in runtime status. |
| Opcode behavior is traced to `newland.c` and linked to decoded EDCD fields. | `source-backed`, then `confirmed` after regression fixtures cover it. |
| `Data MD2` map-note record links to a known land/dungeon level but has no resource-backed display name. | `source-backed` for the map relation; the missing name source remains metadata. |

## Primary Read-Only Evidence

| Evidence | Role |
| --- | --- |
| `F:\Realmz\docs\modernization\file-resource-formats.md` | Master modernization notes for file/resource formats, generated caches, endian behavior, and source anchors. |
| `F:\Realmz\docs\modernization\scenario-data-audit.md` | Scenario corpus audit, generated report index, runtime path rule, and setup/cache anchors. |
| `F:\Realmz\docs\modernization\binary-format-priority.md` | Phase priority list for high-linkage containers and parser gaps. |
| `F:\Realmz\docs\modernization\scenario-opcode-inventory-generated.md` | Cross-scenario decoded opcode/action inventory. |
| `F:\Realmz\docs\modernization\newland-opcode-map-generated.md` | Source-derived `newland.c` dispatcher map. |
| `F:\Realmz\docs\modernization\setupnewgame-cache-layout-generated.md` | Source-to-generated-cache relationship for new-game setup. |
| `F:\Realmz\docs\modernization\encounter-data-inventory-generated.md` | Encounter record alignment, partial record behavior, and compatibility notes. |
| `F:\Realmz\docs\modernization\resource-inventory-generated.md` | Resource fork callsites and resource type usage. |
| `F:\Realmz\src\realmz_orig\structs.h` | Struct definitions for binary records. |
| `F:\Realmz\src\realmz_orig\convert.c` | Endian conversion helpers. |
| `F:\Realmz\src\realmz_orig\setupnewgame.c` | Scenario source-file to runtime-cache setup flow. |
| `F:\Realmz\src\realmz_orig\newland.c` | Scenario action dispatcher and opcode semantics. |
| `F:\Realmz\src\realmz_orig\threed.c` | Dungeon rendering and top-down field interpretation. |
| `F:\Realmz\src\ResourceManager.cpp` | Modern resource fork bridge and resource-chain behavior. |

## Utility Evidence

| Evidence | Role |
| --- | --- |
| `src/realmz-parser.mjs` | Current parser and UI-facing decoded surfaces. |
| `src/semantic-schema.mjs` | Normalized schema emitted over current parser output. |
| `docs/scenario-format/generated/corpus-inventory.md` | Generated corpus inventory for configured scenario roots. |
| `docs/scenario-format/generated/corpus-summary.json` | Machine-readable compact corpus summary. |
| `scripts/check-scenario-format-artifacts.mjs` | Schema smoke checks over representative local fixtures. |

## Promotion Rules

- Move `unknown` to `inferred` only when the value repeats predictably across
  scenario data and has a plausible structural explanation.
- Move `inferred` to `fixture-backed` only after generator output or fixture
  assertions cover multiple representative scenarios.
- Move `fixture-backed` to `source-backed` only after a source anchor explains
  the field or link.
- Move `source-backed` to `confirmed` when source anchors and regression
  fixtures agree and the behavior is stable in the utility.

## Confidence Ledger

`semanticSchema.decoding.confidenceLedger` records each low-confidence claim with
examples, evidence refs, promotion target, blocking question, and next step.
`semanticSchema.decoding.confidenceDebt` groups those ledger entries into the
work queue shown in the Decoding explorer and generated corpus reports.
