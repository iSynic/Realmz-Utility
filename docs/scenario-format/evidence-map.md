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
