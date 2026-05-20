# Fixtures And Regression Scenarios

Fixtures should prove format behavior without relying on the UI to reinterpret
raw records. Source plus fixture checks are authoritative; screenshots and
runtime logs are supporting evidence.

## Current Smoke Fixtures

`npm run scenario:check` looks for these scenarios in local read-only Realmz
roots and checks that `analyzeScenario().semanticSchema` has valid sources,
records, map entities, links, link evidence, unknown-opcode diagnostics, and
missing-EDCD diagnostics:

| Scenario | Why It Matters |
| --- | --- |
| City of Bywater | Dense trigger/map/message/battle links and well-known map naming. |
| Prelude to Pestilence | Dungeon rendering, custom resources, partial/odd map usage. |
| War in the Sword Lands | Custom scenario icons and tile rendering edge cases. |
| Mithril Vault | Custom icon sprites and interior/custom-look map behavior. |
| Wrath of the Mind Lords | Large scenario, generated menu/cache behavior. |

If none are present, the checker will use the first discoverable scenario as a
minimal parser smoke test.

Current fixture-specific assertions also check message links, battle-to-monster
links, City of Bywater battle/map links, Prelude dungeon `PICT 302` render
evidence, custom `cicn` coverage for War/Mithril, and `Data MENU` decoding when
that file is present in the selected fixture root.

## Fixture Assertions To Add

| Area | Assertion |
| --- | --- |
| Record offsets | Field, door, random, EDCD, encounter, battle, monster, and shop records have stable byte ranges. |
| Opcode semantics | Known `newland.c` cases classify to expected semantic actions and links. |
| Encounter links | Simple/complex encounter choices link to encounters, EDCD rows, messages, battles, shops, or diagnostics. |
| Map names | Resource-backed map names link to `Data MD2` and level entities with labeled evidence. |
| Dungeon rendering | `Data DL` uses top-down dungeon field bits and shared `PICT 302` art, not landlook tile atlases. |
| Custom assets | Scenario `cicn`/`PICT` resources override or supplement Family Jewels resources where the game would. |
| Partial records | Partial legacy encounter/string records are reported as compatibility diagnostics, not crashes. |
| Mutations | Opcode/state changes emit links for quest flags, map mutation, generated caches, and one-shot behavior. |

## Recommended Fixture Set

- Base/Fantasoft scenarios with standard resources.
- Third-party scenarios with clean resource forks.
- Divinity/problem scenarios with malformed or legacy resource forks.
- Dungeon-heavy scenarios.
- Custom tile/icon scenarios.
- Scenarios with partial trailing encounter or string records.
- Large scenarios with user-data generated caches.

## Generated Inventory

Run:

```powershell
npm run scenario:inventory
```

Then inspect:

```text
docs/scenario-format/generated/corpus-inventory.md
docs/scenario-format/generated/corpus-summary.json
```

The generated JSON is intended as the base for future fixture lockfiles: hashes,
record counts, alignment issues, resource type counts, opcode usage, link counts,
and parser diagnostics.
