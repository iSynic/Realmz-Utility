# Semantic Schema

`analyzeScenario(path)` now returns `semanticSchema`, a normalized layer over the
existing parser output. Existing fields remain in place for UI compatibility.

## Top-Level Shape

```js
{
  schemaVersion: 1,
  scenario: {},
  sources: [],
  records: [],
  entities: [],
  links: [],
  evidence: [],
  diagnostics: [],
  summary: {}
}
```

## Concepts

| Concept | Purpose |
| --- | --- |
| `sources` | Files and resource forks with hash/size/layout evidence. |
| `records` | Raw decoded records with record IDs, source IDs, byte ranges, and compact primitive summaries. |
| `entities` | Semantic objects a curious reader can browse: maps, triggers, macros, encounters, battles, monsters, shops, messages, assets, quest flags, random areas, generated caches. |
| `links` | Typed graph edges: `located_on`, `configures_map`, `shows_message`, `uses_monster`, `calls_battle_macro`, `describes_map`, opcode/control-flow edges, and action links. |
| `evidence` | Source anchors, generated reports, fixtures, runtime observations, and confidence markers. |
| `diagnostics` | Unknown/trailing bytes, partial records, unresolved references, malformed containers, and parser confidence gaps. |

## Stable ID Conventions

| Object | ID |
| --- | --- |
| Scenario | `scenario:<name>` |
| File source | `source:file:<file name>` |
| Resource fork source | `source:resource-fork:Scenario` |
| Map | `map:<land|dungeon>:<level>` |
| Trigger | `trigger:<land|dungeon>:<level>:<record>` |
| Macro | `macro:<record>` |
| EDCD row | `record:Data EDCD:<record>` |
| Encounter | `encounter:<simple|complex>:<record>` |
| Battle | `battle:<record>` |
| Monster | `monster:<record>` |
| Shop | `shop:<record>` |
| Message/string | `message:<record>` |
| Map record | `map-record:<record>` |
| Quest flag | `quest-flag:<index>` |
| Random area | `random:<land|dungeon>:<level>:<rect>` |

These IDs are intentionally readable rather than compact. They are intended to
support browser navigation, reverse links, generated docs, and test fixtures.

## Evidence And Confidence

Every schema object can carry:

- `source`: container name or source subsystem.
- `recordRef`: decoded record reference when applicable.
- `byteRange`: source byte range for raw records.
- `evidence`: explicit source anchors, record refs, or generated observations.
- `confidence`: one of the shared confidence values in
  [Evidence Map](evidence-map.md).

Derived semantic entities should never replace raw records. A trigger entity, for
example, points back to its `Data DD`/`Data DDD`/`Data ED3` record and action
slots.

## Current Parser Integration

The schema builder lives at:

```text
src/semantic-schema.mjs
```

It is called from:

```text
src/realmz-parser.mjs
```

The first version normalizes the surfaces already parsed by the utility:

- file sources and alignment summaries
- map field records and map entities
- random metadata and random encounter regions
- all door/action records, with active doors as trigger/macro entities
- EDCD rows plus `extracodeUsage` summaries on actions that consume them
- simple and complex encounter entities
- quest flag read/write entities
- fixed record collections for battles, monsters, shops, strings, maps,
  treasure, thief/time encounters, contact info, solids, and menu cache, with
  per-record byte ranges
- scenario resource type inventory
- graph/action links, unresolved-reference diagnostics, unknown-opcode
  diagnostics, and missing-EDCD diagnostics

## Planned Expansion

Next passes should add:

- reverse index generation for "what links here?"
- complete opcode-specific link expansion by opcode and `extracode` shape
- resource-level asset entities for individual `PICT`, `cicn`, `STR#`, and
  custom tile/icon resources
- generated-cache and save-state entities for one-shot and runtime-mutating
  behaviors
