# Assets And Runtime Caches

Scenario browsing needs both authored data and render assets. Realmz combines
scenario-specific resource forks, shared base resources, generated cache files,
and custom tile/icon resources.

## Scenario Resource Forks

Scenario folders can include a classic Mac resource fork or extracted resource
metadata. The current utility inventories resource types, IDs, names, and sizes,
with known value in:

- `PICT`: map art, tile atlases, dungeon/shared picture dependencies;
- `cicn`: custom icons and sprites;
- `STR#`: map/scenario names and string lists;
- other legacy types that should remain inventoried even when not decoded.

Resource names are useful display evidence. They should not silently override
source-backed IDs. The schema should store both:

- stable resource identity: type, id, source file, hash, byte range;
- naming evidence: resource name, wiki name, generated inference, confidence.

## Shared Realmz Art

Base art can come from Realmz shared resource files rather than from a scenario.
Important confirmed examples:

- land tile atlases selected by `randlevel.landlook`;
- top-down dungeon mini-sprites from `realmz.rsrc`, `PICT 302`;
- standard icons used when a scenario does not override or supply custom art.

The utility should report fallback provenance clearly:

```text
render source = scenario resource
render source = shared Realmz resource
render source = generated fallback colors
render source = missing/unsupported
```

This matters for users because fallback colors are diagnostic, not the real
game view.

## Custom Tile And Icon Resources

`loadpixmap` treats landlooks `6`, `7`, and `8` as scenario custom tile paths
and looks for corresponding `PICT 306`, `PICT 307`, and `PICT 308` behavior.
Recent fixture work showed that many third-party scenarios also rely on custom
`cicn` icon resources for boats, NPCs, furniture, and scenario-specific props.

Schema implications:

- terrain cells should link to the tile atlas that rendered them;
- overlaid icon cells should link to `cicn` or equivalent icon resources;
- missing custom resources should be diagnostics with scenario name, landlook,
  resource id, and attempted fallback.

## Dungeon Tiny Sprite Sheet

Dungeon overhead art is not scenario-specific landlook art. It uses shared
`PICT 302`:

```text
x = 576
y = 320
tile = 16 x 16
grid = 4 columns x 6 rows
```

The dungeon renderer draws bit-selected sprites from that sheet. Any parser
that treats dungeon values as ordinary land tile IDs will produce false terrain,
false stairs/doors, and false secret labels.

## Generated Runtime Caches

`setupnewgame.c` creates generated runtime files under `:Data Files:`. They are
important evidence for how the game consumes scenario files, but they are not
the authored scenario source.

| Cache | Source | Meaning |
| --- | --- | --- |
| `CL` | `Data DD` + `Data LD` + `Data RD` + `site` | Land runtime map state. |
| `CD` | `Data DDD` + `Data DL` + `Data RDD` | Dungeon runtime map state. |
| `CE` | `Data ED` | Simple encounter runtime state. |
| `CE2` | `Data ED2` | Complex encounter runtime state. |
| `CS` | `Data SD` | Shop runtime state. |
| `CT` | `Data TD2` | Thief runtime state. |
| `CTD3` | `Data TD3` | Timed encounter runtime state. |

The utility should normally parse source files for browsing and use cache
behavior to explain mutations. If it ever reads generated caches directly, the
schema should mark them as runtime state sources.

## Utility Schema Mapping

Recommended entities:

- `asset:pict:<id>`;
- `asset:cicn:<id>`;
- `asset:str-list:<id>`;
- `render_profile:<map-id>`;
- `runtime_cache:<name>`;
- `asset_fallback`.

Recommended links:

- `renders_with` from map levels or cells to assets;
- `uses_resource` from monsters, icons, shops, maps, or UI prompts to resources;
- `has_name_evidence` from maps/scenarios to resource names;
- `copied_to_cache` from source containers to generated runtime caches;
- `mutates_cache` from actions/runtime systems to cache entities.

## Open Questions

- Full resource type taxonomy is still incomplete.
- Some resource IDs have scenario-specific conventions that need corpus-wide
  inventory and fixtures.
- Current resource-fork decoding should keep unsupported resources as first
  class inventory records rather than dropping them.
