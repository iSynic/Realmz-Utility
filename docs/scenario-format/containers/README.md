# Container Specs

These notes are the container-by-container companion to the
[Format Index](../format-index.md). The index is the quick ledger; these pages
are the source-backed field notes.

## Reading Order

1. [Action Records](action-records.md): `Data DD`, `Data DDD`, `Data ED3`,
   and `Data EDCD`.
2. [Maps, Random Metadata, And Fields](maps-random-and-fields.md): `Data LD`,
   `Data DL`, `Data RD`, `Data RDD`, field bits, landlook, LOS, and random
   regions.
3. [Encounters](encounters.md): `Data ED`, `Data ED2`, generated encounter
   caches, and action slots embedded in conversations.
4. [Supporting Records](supporting-records.md): battles, monsters, shops,
   strings, treasure, thief, timed encounters, map notes, contact info, menu
   caches, solids, and save-linked state.
5. [Assets And Runtime Caches](assets-and-runtime-caches.md): scenario resource
   forks, shared Realmz art, custom tile/icon resources, generated caches, and
   render-time asset selection.

## Confidence Discipline

Each page uses the confidence vocabulary from
[Evidence Map](../evidence-map.md). The most important rule is that raw decoded
records and semantic claims stay separate:

- a raw record field can be documented from a struct, conversion function, file
  size, or fixture alignment;
- a semantic claim needs a runtime consumer, a fixture assertion, generated
  inventory evidence, or an explicitly marked inference;
- unknown fields are carried forward as diagnostics instead of being erased by
  a friendly name.

## Cross-Cutting Invariants

- Scenario binary files are classic Mac big-endian data unless a runtime cache
  has already been converted by Realmz.
- Generated runtime caches under `:Data Files:` are not alternate source truth.
  They are copied or mutated versions of source scenario files.
- The utility should prefer stable IDs derived from source path, record index,
  and byte range. User-facing names are useful evidence, but they are not the
  identity of a record.
- Action scripts are graph-shaped. Any parser path that flattens them into text
  should also preserve explicit `links`.
