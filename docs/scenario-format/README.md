# Scenario Format Archeology

This directory is the utility-side home for source-backed Realmz scenario format
research. The goal is a modern, normalized knowledge model that can answer:

- what does this byte range decode to?
- what semantic thing does this record represent?
- what other records, resources, flags, maps, encounters, battles, or assets does
  it reference?
- how confident are we, and what source or fixture proves it?

`F:\Realmz` is treated as read-only evidence. Generated reports and schema work
live in this repository.

## Deliverables

- [Format Index](format-index.md): known files/resources, record sizes, runtime
  owners, and confidence.
- [Semantic Schema](semantic-schema.md): utility-ready normalized object model
  emitted by `analyzeScenario().semanticSchema`.
- [Opcode And EDCD Semantics](opcodes-edcd.md): source-backed action opcode and
  five-short parameter shapes.
- [Source Anchor Index](source-anchors.md): durable trail from scenario bytes to
  original Realmz source callsites.
- [Runtime Consumer Matrix](runtime-consumer-matrix.md): source file to runtime
  consumer, cache/writeback, semantic output, and gap mapping.
- [Byte Layout Reference](byte-layout-reference.md): record sizes, offset
  highlights, endian behavior, and compatibility rules.
- [Opcode Runtime Reference](opcode-runtime-reference.md): normalized action
  opcode rules, EDCD coverage policy, and high-linkage opcode shapes.
- [Resource Fork Taxonomy](resource-fork-taxonomy.md): observed `PICT`, `cicn`,
  `STR#`, sound/text/style, and unknown resource families.
- [Container Specs](containers/README.md): deeper source-backed notes for action
  records, maps/random metadata, encounters, support records, assets, and
  runtime caches.
- [Evidence Map](evidence-map.md): source anchors, generated reference reports,
  and confidence vocabulary.
- [Fixtures](fixtures.md): regression scenarios and assertions to keep parser
  behavior source-backed.
- [Generated Corpus Inventory](generated/corpus-inventory.md): scenario-wide
  inventory produced by the local generator.

## Commands

```powershell
npm run scenario:inventory
npm run scenario:check
```

`scenario:inventory` scans configured scenario roots, summarizes file/resource
presence, record alignment, opcode use, semantic link kinds, and parser
diagnostics.

`scenario:check` verifies this documentation set exists and smoke-checks the
semantic schema against representative local scenarios when they are present.

By default the generator checks these read-only roots if they exist:

```text
F:\Realmz\base\Realmz\Scenarios
F:\Realmz\out_win_clang\Scenarios
F:\Realmz\out_win_clang\bin\Scenarios
```

Pass explicit roots or set `REALMZ_SCENARIO_ROOT` to scan a different corpus.

## Working Rules

- Keep raw decoded fields separate from semantic claims.
- Every semantic entity and link should point back to a file/resource source,
  byte range, source anchor, generated report, runtime observation, or fixture.
- Unknown bytes, unknown opcodes, malformed resource forks, and invalid
  references are diagnostics, not silent parser failures.
- Source-backed truth beats wiki/manual/external names unless the external name
  is explicitly labeled as naming evidence.
