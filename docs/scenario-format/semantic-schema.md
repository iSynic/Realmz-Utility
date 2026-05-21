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
  decoding: {},
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
| `decoding` | Additive semantic clarity workbench data: coverage, open issue clusters, ED3 reachability, hypotheses, and format notes. |

## Stable ID Conventions

| Object | ID |
| --- | --- |
| Scenario | `scenario:<name>` |
| File source | `source:file:<file name>` |
| Resource fork source | `source:resource-fork:Scenario` |
| Resource type | `resource-type:<type>` |
| Resource entry/reference | `resource:<type>:<id>` |
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
- scenario resource type inventory plus individual resource-fork records/entities
  for every decoded `PICT`, `cicn`, `STR#`, and other resource entry
- graph/action links, unresolved-reference diagnostics, unknown-opcode
  diagnostics, and missing-EDCD diagnostics
- monster links to individual `cicn` resource references and death macros
- decoding coverage and unknown-cluster summaries for the app's Decoding
  explorer tab

## Decoding Workbench

`semanticSchema.decoding` is optional additive schema v1 data. It does not
replace raw records or diagnostics. It groups existing evidence into UI-friendly
surfaces:

- `coverage`: high-level action, EDCD, record, resource, map, encounter, and
  runtime-cache coverage rows.
- `unknownClusters`: grouped diagnostics and active unknown action examples,
  ranked by count and user-facing impact.
- `dispatcherNoops`: source-backed nonzero action words that `newland.c` reads
  but ignores because no dispatcher case exists.
- `ed3Reachability`: classified `Data ED3` macro/action rows with conservative
  reachability evidence, entry-path evidence, source anchors, incoming refs,
  neighbor signatures, promotion rules, and next steps.
- `hypotheses`: friendly inferred labels with `confidence` and `evidenceRef`.
  These remain hypotheses until promoted by the evidence rules.
- `formatNotes`: registry notes for known containers, action semantics, and
  resource types.
- `confidenceLedger`: one row per low-confidence semantic claim, with examples,
  evidence refs, promotion target, blocking question, and next step.
- `confidenceDebt`: ranked groups of ledger entries such as active unknowns,
  inferred format evidence, fixture-backed taxonomy, fixture-backed resources,
  inferred semantic labels, and missing source anchors.

The decoding summary also reports `unreferencedMacroCount` and
`ed3Reachability` counts for non-empty `Data ED3` rows. Reachable macro entities
are seeded from decoded map triggers, recursive macro calls, `Global` macro
slots, timed encounters, random-region doors, negative battle macro fields, and
monster death hooks. Positive battle macro fields are not promoted unless
another source-backed path reaches them. EDCD copy/replace references are shown
as `runtime-mutation-candidate` evidence, not direct macro execution.

Normal inspector views may show friendly labels first, but raw fields and JSON
stay in Technical Evidence unless the user opens a Decoding detail.

Tile atlas entities keep semantic confidence separate from preview/cache state:
when a Land/Look value has a source-backed atlas clue, the entity is
`source-backed` even if the generated PNG is unavailable. The unavailable preview
remains visible in the entity summary as runtime status.

Resource coverage confidence follows the weakest unresolved taxonomy note:
catalogues whose resource types are all source-backed or explicitly inferred
format evidence report source-backed coverage, while genuinely fixture-only
resource roles remain in confidence debt.

## Planned Expansion

Next passes should add:

- reverse index generation for "what links here?"
- complete opcode-specific link expansion by opcode and `extracode` shape
- shared-resource provenance that distinguishes scenario resource bytes from
  Family Jewels/base-resource fallback bytes
- generated-cache and save-state entities for one-shot and runtime-mutating
  behaviors
