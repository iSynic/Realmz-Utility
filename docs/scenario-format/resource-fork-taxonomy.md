# Resource Fork Taxonomy

Scenario resource forks are classic Mac resource maps. They are not just render
assets; they carry names, pictures, icon art, sounds, text/style resources, and
scenario-specific metadata. The parser now keeps both aggregate type summaries
and individual resource records.

## Parser Evidence

The utility normalizes AppleSingle/AppleDouble wrappers, then reads:

- resource data offset and map offset from the resource fork header;
- type-list entries: four-byte type, resource count, reference-list offset;
- reference-list entries: signed resource id, optional Pascal-name offset,
  attributes, and 24-bit data offset;
- data blocks: four-byte length followed by resource bytes.

Individual schema records are emitted as:

```text
record:resource:<type>:<id>
```

Individual semantic resources are emitted as:

```text
resource:<type>:<id>
```

Their byte ranges are relative to the normalized resource fork after extraction,
not necessarily the original AppleDouble file on disk.

## Observed Resource Types

The current corpus inventory sees these resource families:

| Type | Confirmed Meaning | Current Use |
| --- | --- | --- |
| `PICT` | Classic picture resources | tile atlases, show-picture actions, map/picture art, shared dungeon `PICT 302` in base resources |
| `cicn` | Color icon resources | monsters, NPCs, boats, props, custom scenario sprites |
| `STR#` | String-list resources | map-name lists, scenario/name metadata candidates |
| `snd ` | Sound resources | action/combat/UI sound ids; individual semantic links still pending |
| `TEXT` | Text resources | external/movie text blobs loaded by classic presentation paths |
| `styl` | Text style resources | paired styled text metadata loaded alongside matching `TEXT` entries |
| `vers` | Version resources | scenario/application version metadata |
| `RLMZ` | Realmz-specific metadata | counted by setup/load/save compatibility paths; field taxonomy still unknown |
| `\x00\x00\x00\x00` | malformed/legacy type entry | should remain inventoried and diagnostically visible |

## Current Semantic Links

- `Data MD.iconid` creates `uses_icon_resource` links to
  `resource:cicn:<id>`.
- Opcode `27` creates `shows picture` links to `resource:PICT:<id>`.
- `STR# -102` and `STR# -101` named `Map Names` provide map-name evidence for
  `Data MD2`/level labels. `Data MD2` still source-backs the map-note-to-level
  relation when a resource-backed display name is absent.
- Landlook rendering uses `PICT 300 + landlook` through scenario or shared
  resource lookup, but per-cell `renders_with` links are still future work.

Resource references can legitimately point to bytes outside the scenario fork
when the game falls back to shared Realmz resources. The schema therefore emits
`resource reference` placeholders for referenced assets even when the scenario
fork does not contain the bytes.

## Evidence And Confidence

| Claim | Confidence | Evidence |
| --- | --- | --- |
| Resource map structure and byte ranges | source-backed | ResourceManager source/report anchors plus parser resource-map walk |
| `STR#` map names | source-backed | map-name resource ids and runtime-observed labels |
| `cicn` monster icon references | source-backed | `Data MD.iconid`, icon importer, custom icon fixtures |
| Opcode `27` picture references | source-backed | `newland.c` show-picture path and action links |
| `RLMZ` scenario marker role | source-backed | `CountResources('RLMZ')` setup/load/save paths |
| `RLMZ` field taxonomy | inferred | observed payloads remain undecoded after the role is classified |
| `TEXT`/`styl` runtime linking | source-backed | movie/presentation resource load callsites |

## Open Work

- Link `snd ` action/combat sound ids to individual sound resources.
- Decode or at least classify `RLMZ` payloads.
- Identify `TEXT`/`styl` consumers and expose styled text as a semantic entity.
- Add diagnostics for malformed resource-map entries without dropping their
  inventory evidence.
- Distinguish scenario-supplied bytes from Family Jewels/shared-resource
  fallback bytes in every asset link.
