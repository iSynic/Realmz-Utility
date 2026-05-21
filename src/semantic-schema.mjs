const MAP_SIZE = 90;
const FIELD_BYTES = MAP_SIZE * MAP_SIZE * 2;
const DOOR_BYTES = 40;
const DOORS_PER_LEVEL = 100;
const RANDLEVEL_BYTES = 644;
const EXTRACODE_BYTES = 10;
const SIMPLE_ENCOUNTER_BYTES = 426;
const COMPLEX_ENCOUNTER_BYTES = 520;

const RECORD_LAYOUTS = {
  "Global": { kind: "global macro slots", recordBytes: 60, confidence: "source-backed" },
  "Data LD": { kind: "land field grid", recordBytes: FIELD_BYTES, confidence: "confirmed" },
  "Data DL": { kind: "dungeon field grid", recordBytes: FIELD_BYTES, confidence: "confirmed" },
  "Data DD": { kind: "land trigger/action table", recordBytes: DOOR_BYTES, recordsPerLevel: DOORS_PER_LEVEL, confidence: "source-backed" },
  "Data DDD": { kind: "dungeon trigger/action table", recordBytes: DOOR_BYTES, recordsPerLevel: DOORS_PER_LEVEL, confidence: "source-backed" },
  "Data RD": { kind: "land random level metadata", recordBytes: RANDLEVEL_BYTES, confidence: "source-backed" },
  "Data RDD": { kind: "dungeon random level metadata", recordBytes: RANDLEVEL_BYTES, confidence: "source-backed" },
  "Data ED3": { kind: "macro/action records", recordBytes: DOOR_BYTES, confidence: "source-backed" },
  "Data EDCD": { kind: "extra-code rows", recordBytes: EXTRACODE_BYTES, confidence: "source-backed" },
  "Data ED": { kind: "simple encounters", recordBytes: SIMPLE_ENCOUNTER_BYTES, confidence: "source-backed" },
  "Data ED2": { kind: "complex encounters", recordBytes: COMPLEX_ENCOUNTER_BYTES, confidence: "source-backed" },
};

const RECORD_COLLECTION_SOURCES = {
  global: { source: "Global", entityType: "global macro table", linkPrefix: "global", confidence: "source-backed" },
  battles: { source: "Data BD", entityType: "battle", linkPrefix: "battle", confidence: "source-backed" },
  monsters: { source: "Data MD", entityType: "monster", linkPrefix: "monster", confidence: "source-backed" },
  shops: { source: "Data SD", entityType: "shop", linkPrefix: "shop", confidence: "source-backed" },
  strings: { source: "Data SD2", entityType: "message", linkPrefix: "message", confidence: "source-backed" },
  maps: { source: "Data MD2", entityType: "map note", linkPrefix: "map-record", confidence: "source-backed" },
  treasure: { source: "Data TD", entityType: "treasure", linkPrefix: "treasure", confidence: "source-backed" },
  thief: { source: "Data TD2", entityType: "thief encounter", linkPrefix: "thief", confidence: "source-backed" },
  time: { source: "Data TD3", entityType: "time encounter", linkPrefix: "time", confidence: "source-backed" },
  contact: { source: "Data CI", entityType: "scenario contact", linkPrefix: "contact", confidence: "source-backed" },
  solids: { source: "Data Solids", entityType: "solid tile table", linkPrefix: "solids", confidence: "source-backed" },
  menu: { source: "Data MENU", entityType: "monster menu cache", linkPrefix: "menu", confidence: "confirmed" },
};

const SOURCE_ANCHORS = [
  {
    id: "anchor:setupnewgame-cache",
    confidence: "confirmed",
    source: "F:\\Realmz\\docs\\modernization\\setupnewgame-cache-layout-generated.md",
    note: "Generated cache layout for land, dungeon, random, encounter, shop, thief, and time data.",
  },
  {
    id: "anchor:file-resource-formats",
    confidence: "source-backed",
    source: "F:\\Realmz\\docs\\modernization\\file-resource-formats.md",
    note: "Source-backed record sizes, owner paths, endian behavior, and cache relationship notes.",
  },
  {
    id: "anchor:newland-opcodes",
    confidence: "source-backed",
    source: "F:\\Realmz\\docs\\modernization\\newland-opcode-map-generated.md",
    note: "Generated index of the newland.c scenario action dispatcher.",
  },
  {
    id: "anchor:newland-mode1-macro-entry",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\newland.c:30",
    note: "newland mode 1 seeds the active position, loads a Data ED3 macro through loaddoor2(modecode), and starts action execution.",
  },
  {
    id: "anchor:loaddoor2-ed3-loader",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\flashrange-loaddoor.c:43",
    note: "loaddoor2 reads a 40-byte Data ED3 door/action record and preserves the current trigger location fields.",
  },
  {
    id: "anchor:global-macro-slots",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\handlemenuchoice.c:1199",
    note: "The Global file stores scenario-wide macro slots used by start, death, quit, shop, and temple paths.",
  },
  {
    id: "anchor:global-start-macro",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\misc.c:512",
    note: "globalmacro[0] can run as a scenario start macro.",
  },
  {
    id: "anchor:global-death-macro",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\partyloss.c:21",
    note: "globalmacro[1] can run during party loss before final death handling.",
  },
  {
    id: "anchor:global-quit-macro",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\handlemenuchoice.c:1233",
    note: "globalmacro[2] can run when ending the current game.",
  },
  {
    id: "anchor:global-shop-macro",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\buttonchoice.c:419",
    note: "globalmacro[4] can run before shop entry.",
  },
  {
    id: "anchor:global-temple-macro",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\buttonchoice.c:435",
    note: "globalmacro[5] can run before temple entry.",
  },
  {
    id: "anchor:timed-encounter-macro",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\textbox-time.c:369",
    note: "Timed encounters can call newland mode 1 with dotime.door.",
  },
  {
    id: "anchor:random-region-macro",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\textbox-time.c:375",
    note: "Random map regions can call newland mode 1 with randlevel.randdoor slots.",
  },
  {
    id: "anchor:battle-round-macro",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\getup.c:75",
    note: "Negative battle.battlemacro values run through loaddoor2(abs(battlemacro)) during combat rounds.",
  },
  {
    id: "anchor:monster-death-macro",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\killbody.c:87",
    note: "Monster todoondeath values can load Data ED3 action records through loaddoor2.",
  },
  {
    id: "anchor:newland-edcd-macro-branches",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\newland.c:1303",
    note: "EDCD-backed branch actions can call loaddoor2 directly, through random ranges, and through force-branch paths.",
  },
  {
    id: "anchor:runtime-copy-candidate",
    confidence: "source-backed",
    source: "F:\\Realmz\\src\\realmz_orig\\newland.c:2693",
    note: "Some action-data paths copy or replace action bytes at runtime; these are evidence of possible use but not direct ED3 execution.",
  },
  {
    id: "anchor:opcode-inventory",
    confidence: "fixture-backed",
    source: "F:\\Realmz\\docs\\modernization\\scenario-opcode-inventory-generated.md",
    note: "Cross-scenario decoded door/action and EDCD usage inventory.",
  },
  {
    id: "anchor:land-tile-atlas-selection",
    confidence: "source-backed",
    source: "docs/scenario-format/source-anchors.md#land-tile-atlas-selection",
    note: "Outdoor map real-tile atlas selection is tied to randlevel.landlook; preview cache availability is runtime state.",
  },
];

const ACTION_DECODER_REGISTRY = {
  "known-opcodes": {
    title: "Source-backed newland actions",
    summary: "Opcode labels and broad categories come from the newland.c dispatcher map; EDCD field shapes provide target links where source behavior is understood.",
    confidence: "source-backed",
    evidenceRef: "anchor:newland-opcodes",
  },
  "edcd-shapes": {
    title: "EDCD action-data rows",
    summary: "Five signed-short parameter rows are interpreted per opcode, with unresolved rows preserved as records and diagnostics.",
    confidence: "source-backed",
    evidenceRef: "anchor:opcode-inventory",
  },
};

const RESOURCE_DECODER_REGISTRY = {
  ["\0\0\0\0"]: {
    title: "Zero-filled resource map entries",
    summary: "All-zero resource type bytes are preserved as resource-fork format evidence; they look like padding or a malformed map entry rather than a Realmz resource role.",
    confidence: "inferred",
    evidenceRef: "resource-type:\\x00\\x00\\x00\\x00",
  },
  "PICT": {
    title: "Picture resources",
    summary: "QuickDraw PICT image resources used for maps, tile atlases, and scenario art; previews depend on decoded picture cache availability.",
    confidence: "source-backed",
    evidenceRef: "anchor:file-resource-formats",
  },
  "cicn": {
    title: "Color icon resources",
    summary: "Classic color icon resources used by monsters, items, UI markers, and scenario art.",
    confidence: "source-backed",
    evidenceRef: "anchor:file-resource-formats",
  },
  "STR#": {
    title: "String-list resources",
    summary: "Mac string-list resources used for map names, UI labels, spell/item text, and scenario metadata.",
    confidence: "source-backed",
    evidenceRef: "anchor:file-resource-formats",
  },
  "TEXT": {
    title: "Text resources",
    summary: "Standalone text resources used by scenario or UI presentation paths; movie text loads TEXT resources with matching styled-text companions when present.",
    confidence: "source-backed",
    evidenceRef: "anchor:file-resource-formats",
  },
  "snd ": {
    title: "Sound resources",
    summary: "Classic sound resources referenced by action parameters and UI/runtime playback paths.",
    confidence: "source-backed",
    evidenceRef: "anchor:file-resource-formats",
  },
  "RLMZ": {
    title: "Realmz scenario marker resources",
    summary: "Realmz-specific scenario marker resources counted by setup, save, and load compatibility paths; payload field taxonomy remains unresolved.",
    confidence: "source-backed",
    evidenceRef: "anchor:file-resource-formats",
  },
  "styl": {
    title: "Styled-text resources",
    summary: "Classic styled text companion resources loaded alongside TEXT movie/presentation entries when present.",
    confidence: "source-backed",
    evidenceRef: "anchor:file-resource-formats",
  },
  "vers": {
    title: "Version resources",
    summary: "Classic version resources used for metadata and compatibility display.",
    confidence: "source-backed",
    evidenceRef: "anchor:file-resource-formats",
  },
};

const CONTAINER_DECODER_REGISTRY = {
  ...Object.fromEntries(Object.entries(RECORD_LAYOUTS).map(([source, layout]) => [
    source,
    {
      title: source,
      summary: layout.kind,
      confidence: layout.confidence,
      recordBytes: layout.recordBytes,
      evidenceRef: "anchor:file-resource-formats",
    },
  ])),
  ...Object.fromEntries(Object.values(RECORD_COLLECTION_SOURCES).map((layout) => [
    layout.source,
    {
      title: layout.source,
      summary: layout.entityType,
      confidence: layout.confidence,
      evidenceRef: "anchor:file-resource-formats",
    },
  ])),
};

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function labelize(value) {
  return String(value || "")
    .replace(/[_:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function printableToken(value) {
  return String(value ?? "").replace(/[^\x20-\x7e]/g, (char) => `\\x${char.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

function sourceId(name) {
  return `source:file:${name}`;
}

function byteRange(start, length) {
  return { start, length, endExclusive: start + length };
}

function titleCaseLevelType(type) {
  return type === "land" ? "Land" : "Dungeon";
}

function randLevelFor(randLevels, level) {
  return (randLevels || []).find((entry) => entry.levelType === level?.type && entry.levelIndex === level?.index) || null;
}

function fallbackMapLabel(level, randLevels) {
  const base = `${titleCaseLevelType(level.type)} ${level.index}`;
  if (level.renderKind === "dungeon-topdown" || (level.type === "dungeon" && Number.isInteger(level.renderPictureId))) {
    return `${base}, PICT ${level.renderPictureId || 302}`;
  }
  const randLevel = randLevelFor(randLevels, level);
  const landlook = Number.isInteger(level.renderLandlook) ? level.renderLandlook : randLevel?.landlook;
  return Number.isInteger(landlook) ? `${base}, Look ${landlook}` : base;
}

function mapEntityId(levelType, levelIndex) {
  return `map:${levelType}:${levelIndex}`;
}

function triggerEntityId(door) {
  if (door.source === "Data ED3") return `macro:${door.recordIndex}`;
  return `trigger:${door.levelType}:${door.levelIndex}:${door.recordIndex}`;
}

function encounterEntityId(kind, id) {
  return `encounter:${kind}:${id}`;
}

function resourceEntityId(type, id) {
  return `resource:${printableToken(type || "unknown")}:${id}`;
}

function compactAction(action) {
  return {
    slot: action.slot,
    code: action.code,
    rawCode: action.rawCode,
    id: action.id,
    label: action.label,
    category: action.category,
  };
}

function recordRangeForDoor(door) {
  if (door.source === "Data ED3") {
    return byteRange(door.recordIndex * DOOR_BYTES, DOOR_BYTES);
  }
  const levelIndex = Number.isInteger(door.levelIndex) ? door.levelIndex : 0;
  return byteRange(levelIndex * DOORS_PER_LEVEL * DOOR_BYTES + door.recordIndex * DOOR_BYTES, DOOR_BYTES);
}

function addUnique(array, entry, key = "id") {
  if (!array.some((item) => item[key] === entry[key])) {
    array.push(entry);
  }
}

function toGraphTarget(link) {
  if (!link) return null;
  if (link.type === "macro") return `macro:${link.id}`;
  if (link.type === "extracode") return `record:Data EDCD:${link.id}`;
  if (link.type === "encounter") return encounterEntityId(link.kind || "simple", link.id);
  if (link.type === "battle") return `battle:${link.id}`;
  if (link.type === "monster") return `monster:${link.id}`;
  if (link.type === "text") return `message:${link.id}`;
  if (link.type === "map") return `map-record:${link.id}`;
  if (link.type === "level") return `map:${link.levelType || "land"}:${link.id}`;
  if (link.type === "shop") return `shop:${link.id}`;
  if (link.type === "quest") return `quest-flag:${link.id}`;
  if (link.type === "treasure") return `treasure:${link.id}`;
  if (link.type === "time") return `time:${link.id}`;
  if (link.type === "resource" && Number.isFinite(link.id)) return resourceEntityId(link.resourceType || "unknown", link.id);
  if (link.type === "resource") return `resource-type:${printableToken(link.resourceType || "unknown")}`;
  return null;
}

function normalizeGraphNodeId(id) {
  if (typeof id !== "string") return id;
  if (id.startsWith("extracode:")) {
    return `record:Data EDCD:${id.slice("extracode:".length)}`;
  }
  return id;
}

function addActionLinks(output, actions) {
  for (const action of actions || []) {
    const from = action.source === "Data ED3"
      ? `macro:${action.recordIndex}`
      : `trigger:${action.levelType}:${action.levelIndex}:${action.recordIndex}`;
    for (const link of action.links || []) {
      const to = toGraphTarget(link);
      if (!to) continue;
      if (link.type === "resource" && Number.isFinite(link.id)) {
        addResourceReferenceEntity(output, link.resourceType || "unknown", link.id, `action:${action.source}:${action.recordIndex}:${action.slot}`);
      }
      output.links.push({
        id: `link:${output.links.length}`,
        from,
        to,
        kind: link.role || link.type || "references",
        confidence: "source-backed",
        evidence: [`action:${action.source}:${action.recordIndex}:${action.slot}`],
        metadata: compactAction(action),
      });
    }
  }
}

function addMacroRootLinks(output, doors) {
  for (const door of doors || []) {
    if (door.source !== "Data ED3" || !door.actions?.length) continue;
    for (const ref of door.macroIncomingRefs || []) {
      output.links.push({
        id: `macro-root:${output.links.length}`,
        from: ref.from,
        to: `macro:${ref.id}`,
        kind: ref.role || ref.rootType || "calls_macro",
        rootType: ref.rootType,
        confidence: ref.confidence || "source-backed",
        sourceAnchor: ref.sourceAnchor,
        evidence: ref.evidence || [],
        metadata: {
          rootType: ref.rootType,
          sourceAnchor: ref.sourceAnchor,
          slot: ref.slot,
          rawValue: ref.rawValue,
          action: ref.action,
        },
      });
    }
  }
}

function addGraphEdges(output, graph) {
  for (const edge of graph?.edges || []) {
    output.links.push({
      id: `script-edge:${edge.id}`,
      from: normalizeGraphNodeId(edge.from),
      to: normalizeGraphNodeId(edge.to),
      kind: edge.kind,
      confidence: "source-backed",
      evidence: [edge.actionId != null ? `action:${edge.actionId}` : "newland-opcode-map"],
      metadata: {
        slot: edge.slot,
        code: edge.code,
        category: edge.category,
      },
    });
  }
}

function addBattleLinks(output, records) {
  for (const battle of records?.battles?.records || []) {
    const battleId = `battle:${battle.id}`;
    for (const monsterId of battle.monsters || []) {
      output.links.push({
        id: `link:${output.links.length}`,
        from: battleId,
        to: `monster:${monsterId}`,
        kind: "uses_monster",
        confidence: "source-backed",
        evidence: [`record:Data BD:${battle.id}`],
      });
    }
    if (battle.messageBefore) {
      output.links.push({
        id: `link:${output.links.length}`,
        from: battleId,
        to: `message:${battle.messageBefore}`,
        kind: "shows_message_before",
        confidence: "source-backed",
        evidence: [`record:Data BD:${battle.id}`],
      });
    }
    if (battle.messageAfter) {
      output.links.push({
        id: `link:${output.links.length}`,
        from: battleId,
        to: `message:${battle.messageAfter}`,
        kind: "shows_message_after",
        confidence: "source-backed",
        evidence: [`record:Data BD:${battle.id}`],
      });
    }
    if (Number.isFinite(battle.battleMacro) && battle.battleMacro < 0) {
      output.links.push({
        id: `link:${output.links.length}`,
        from: battleId,
        to: `macro:${Math.abs(battle.battleMacro)}`,
        kind: "calls_battle_macro",
        confidence: "source-backed",
        sourceAnchor: "anchor:battle-round-macro",
        evidence: [`record:Data BD:${battle.id}`, "anchor:battle-round-macro"],
        metadata: { rawValue: battle.battleMacro },
      });
    }
  }
}

function addMonsterLinks(output, records) {
  for (const monster of records?.monsters?.records || []) {
    const monsterId = `monster:${monster.id}`;
    if (monster.iconId) {
      addResourceReferenceEntity(output, "cicn", monster.iconId, `record:Data MD:${monster.id}`);
      output.links.push({
        id: `link:${output.links.length}`,
        from: monsterId,
        to: resourceEntityId("cicn", monster.iconId),
        kind: "uses_icon_resource",
        confidence: "source-backed",
        evidence: [`record:Data MD:${monster.id}`],
        metadata: { iconId: monster.iconId },
      });
    }
    if (monster.todoOnDeath) {
      output.links.push({
        id: `link:${output.links.length}`,
        from: monsterId,
        to: `macro:${monster.todoOnDeath}`,
        kind: "calls_death_macro",
        confidence: "source-backed",
        sourceAnchor: "anchor:monster-death-macro",
        evidence: [`record:Data MD:${monster.id}`, "anchor:monster-death-macro"],
      });
    }
  }
}

function addMapRecordLinks(output, records, levels) {
  const knownMaps = new Set((levels || []).map((level) => `${level.type}:${level.index}`));
  for (const record of records?.maps?.records || []) {
    const targetKey = `${record.isDungeon ? "dungeon" : "land"}:${record.level}`;
    if (!knownMaps.has(targetKey)) continue;
    output.links.push({
      id: `link:${output.links.length}`,
      from: `map-record:${record.id}`,
      to: mapEntityId(record.isDungeon ? "dungeon" : "land", record.level),
      kind: "describes_map",
      confidence: "source-backed",
      evidence: [`record:Data MD2:${record.id}`],
      metadata: {
        startX: record.startX,
        startY: record.startY,
        nameSource: record.nameSource || null,
      },
    });
  }
}

function addResourceEntities(output, resources) {
  for (const type of resources?.catalog?.types || []) {
    const printableType = printableToken(type.type);
    const registry = RESOURCE_DECODER_REGISTRY[type.type];
    const typeEntity = {
      id: `resource-type:${printableType}`,
      type: "resource type",
      label: registry?.title || `${printableType} resources`,
      confidence: registry?.confidence || "fixture-backed",
      source: "Scenario resource fork",
      evidence: registry?.evidenceRef ? [registry.evidenceRef] : undefined,
      summary: {
        count: type.count,
        totalBytes: type.totalBytes,
        minId: type.minId,
        maxId: type.maxId,
        named: type.named,
        sampleIds: type.ids,
        sampleNames: type.names,
      },
    };
    addUnique(output.entities, typeEntity);
  }
  for (const resource of resources?.resources || []) {
    const printableType = printableToken(resource.type);
    const registry = RESOURCE_DECODER_REGISTRY[resource.type];
    const confidence = registry?.confidence || "fixture-backed";
    const evidence = registry?.evidenceRef ? [registry.evidenceRef] : undefined;
    const recordRef = `record:resource:${printableType}:${resource.id}`;
    const entityId = resourceEntityId(resource.type, resource.id);
    const dataByteRange = Number.isFinite(resource.offset) && Number.isFinite(resource.bytes)
      ? byteRange(resource.offset, resource.bytes)
      : null;
    output.records.push({
      id: recordRef,
      source: "source:resource-fork:Scenario",
      type: "resource fork entry",
      byteRange: dataByteRange,
      confidence,
      evidence,
      summary: {
        type: resource.type,
        id: resource.id,
        name: resource.name || "",
        bytes: resource.bytes,
        attributes: resource.attributes,
        refOffset: resource.refOffset,
        nameOffset: resource.nameOffset,
        sha256: resource.sha256,
      },
    });
    addUnique(output.entities, {
      id: entityId,
      type: "resource",
      label: resource.name ? `${printableType} ${resource.id}: ${resource.name}` : `${printableType} ${resource.id}`,
      confidence,
      source: "Scenario resource fork",
      recordRef,
      evidence,
      summary: {
        resourceType: resource.type,
        id: resource.id,
        name: resource.name || "",
        bytes: resource.bytes,
        attributes: resource.attributes,
        sha256: resource.sha256,
      },
    });
    output.links.push({
      id: `link:${output.links.length}`,
      from: entityId,
      to: `resource-type:${printableType}`,
      kind: "member_of_resource_type",
      confidence,
      evidence: [recordRef],
    });
  }
}

function addResourceReferenceEntity(output, type, id, evidence) {
  const printableType = printableToken(type);
  addUnique(output.entities, {
    id: resourceEntityId(type, id),
    type: "resource reference",
    label: `${printableType} ${id}`,
    confidence: "source-backed",
    source: "Resource resolution reference",
    summary: {
      resourceType: type,
      id,
      evidence,
      note: "Referenced by scenario data; the bytes may live in the scenario resource fork or in shared Realmz resources.",
    },
  });
}

function makeDiagnostic(output, diagnostic) {
  const severityByType = {
    "unknown-opcode": "warning",
    "missing-edcd": "warning",
    "unresolved-reference": "warning",
    "trailing-bytes": "info",
    "partial-records": "info",
    "format-gap": "info",
  };
  const title = diagnostic.readerTitle || labelize(diagnostic.type || "diagnostic");
  const summary = diagnostic.readerSummary || diagnostic.message || "";
  const source = diagnostic.source || diagnostic.data?.source || "scenario";
  const clusterKey = diagnostic.clusterKey || `${diagnostic.type || "diagnostic"}:${source}`;
  return {
    severity: severityByType[diagnostic.type] || "info",
    readerTitle: title,
    readerSummary: summary,
    clusterKey,
    recommendedNextStep: diagnostic.recommendedNextStep || "Compare the decoded record with source anchors and corpus examples before promoting a semantic label.",
    ...diagnostic,
  };
}

function pushDiagnostic(output, diagnostic) {
  output.diagnostics.push(makeDiagnostic(output, diagnostic));
}

function addRecordsAndEntities(output, records) {
  for (const [collectionName, collection] of Object.entries(records || {})) {
    const layout = RECORD_COLLECTION_SOURCES[collectionName];
    if (!layout || !collection) continue;
    output.records.push({
      id: `record-set:${layout.source}`,
      source: sourceId(layout.source),
      type: collection.kind,
      confidence: layout.confidence,
      count: collection.count,
      recordBytes: collection.recordBytes,
      trailingBytes: collection.trailingBytes || 0,
      status: collection.status,
    });
    for (const record of collection.records || []) {
      const recordRef = `record:${layout.source}:${record.id}`;
      output.records.push({
        id: recordRef,
        source: sourceId(layout.source),
        type: collection.kind,
        byteRange: byteRange(record.id * collection.recordBytes, collection.recordBytes),
        confidence: layout.confidence,
        summary: { ...record },
      });
      const entity = {
        id: `${layout.linkPrefix}:${record.id}`,
        type: layout.entityType,
        label: record.name || record.preview || `${layout.entityType} ${record.id}`,
        confidence: layout.confidence,
        source: layout.source,
        recordRef,
        summary: {},
      };
      if (collectionName === "strings") {
        entity.summary = { length: record.length, preview: record.preview };
      } else if (collectionName === "monsters") {
        entity.summary = { name: cleanText(record.name), iconId: record.iconId, staminaMax: record.staminaMax, exp: record.exp };
      } else if (collectionName === "battles") {
        entity.summary = { monsterSlots: record.monsterSlots, monsters: record.monsters, messageBefore: record.messageBefore, messageAfter: record.messageAfter };
      } else if (collectionName === "shops") {
        entity.summary = { itemCount: record.itemCount, quantitySlots: record.quantitySlots, inflation: record.inflation };
      } else if (collectionName === "maps") {
        entity.summary = {
          name: cleanText(record.name),
          level: record.level,
          isDungeon: record.isDungeon,
          startX: record.startX,
          startY: record.startY,
          note: cleanText(record.note).slice(0, 160),
        };
      } else {
        entity.summary = { ...record };
      }
      addUnique(output.entities, entity);
    }
  }
}

function addDiagnostics(output, alignment, graph, doors = []) {
  for (const [key, value] of Object.entries(alignment || {})) {
    if (!value?.exists) continue;
    if (value.trailing || value.trailingBytes) {
      pushDiagnostic(output, {
        id: `diagnostic:alignment:${key}`,
        type: "trailing-bytes",
        confidence: "inferred",
        source: key,
        message: `${key} has ${value.trailing || value.trailingBytes} trailing bytes after full records.`,
        readerTitle: `${labelize(key)} has trailing bytes`,
        readerSummary: "The parser preserved the full records and reports the extra bytes as format evidence instead of silently discarding them.",
        clusterKey: `alignment:${key}:trailing`,
        recommendedNextStep: "Check whether the trailing bytes match a known partial legacy record before treating them as corruption.",
        data: value,
      });
    }
    if (value.partialRecords) {
      pushDiagnostic(output, {
        id: `diagnostic:partial:${key}`,
        type: "partial-records",
        confidence: "inferred",
        source: key,
        message: `${key} contains ${value.partialRecords} legacy partial records accepted by the parser.`,
        readerTitle: `${labelize(key)} has partial records`,
        readerSummary: "The runtime-compatible parser accepts this partial record shape and marks it for semantic follow-up.",
        clusterKey: `alignment:${key}:partial`,
        recommendedNextStep: "Keep compatibility behavior unless a fixture proves the partial row is unsafe.",
        data: value,
      });
    }
  }
  for (const ref of graph?.unresolvedRefs || []) {
    pushDiagnostic(output, {
      id: `diagnostic:unresolved:${output.diagnostics.length}`,
      type: "unresolved-reference",
      confidence: "source-backed",
      source: ref.source,
      message: `${ref.source} references missing ${ref.refType} ${ref.refId}: ${ref.reason}`,
      readerTitle: `Missing ${ref.refType} ${ref.refId}`,
      readerSummary: `${ref.source} points at a ${ref.refType} record that is not available or inactive in this scenario.`,
      clusterKey: `unresolved:${ref.refType}:${ref.reason}`,
      recommendedNextStep: "Inspect nearby script actions to decide whether this is an optional branch, a missing scenario record, or an unsupported runtime cache target.",
      data: ref,
    });
  }
  for (const door of doors || []) {
    if (door.source !== "Data ED3" || door.active || !door.actions?.length || !door.inactiveReason) {
      continue;
    }
    const ed3Classification = classifyEd3Case(door, door.macroIncomingRefs || [], door.macroPossibleRefs || []);
    pushDiagnostic(output, {
      id: `diagnostic:inactive-macro:${door.recordIndex}`,
      type: "format-gap",
      confidence: ed3Classification.confidence,
      source: door.source,
      message: `Data ED3 record ${door.recordIndex} contains action-like bytes but is not reachable from decoded script entry points.`,
      readerTitle: labelize(ed3Classification.classification),
      readerSummary: ed3Classification.summary,
      clusterKey: `ed3-reachability:${ed3Classification.classification}`,
      evidenceRef: `decoding:ed3:${door.recordIndex}`,
      recommendedNextStep: ed3Classification.recommendedNextStep,
      data: {
        source: door.source,
        recordIndex: door.recordIndex,
        actionCount: door.actions.length,
        rawCodes: door.codes,
        actionIds: door.ids,
        classification: ed3Classification.classification,
        ed3ReachabilityId: `decoding:ed3:${door.recordIndex}`,
        inactiveReason: door.inactiveReason,
      },
    });
  }
  for (const action of graph?.actions || []) {
    if (action.category === "format_gap") {
      pushDiagnostic(output, {
        id: `diagnostic:format-gap:${output.diagnostics.length}`,
        type: "format-gap",
        confidence: "inferred",
        source: action.source,
        message: `${action.source} record ${action.recordIndex}, slot ${action.slot} preserves ${action.rawCode}/${action.id} as format evidence rather than executable script.`,
        readerTitle: "Preserved non-executable action bytes",
        readerSummary: action.formatGapReason || "This action slot looks like authored/padded bytes rather than a known executable action.",
        clusterKey: `format-gap:${action.source}:${action.rawCode}`,
        recommendedNextStep: "Compare repeated examples before deciding whether this is padding, an editor artifact, or a new action form.",
        data: {
          source: action.source,
          levelType: action.levelType,
          levelIndex: action.levelIndex,
          recordIndex: action.recordIndex,
          slot: action.slot,
          rawCode: action.rawCode,
          id: action.id,
        },
      });
      continue;
    }
    if (action.category === "dispatcher_noop") {
      pushDiagnostic(output, {
        id: `diagnostic:dispatcher-noop:${output.diagnostics.length}`,
        type: "dispatcher-noop",
        confidence: "source-backed",
        source: action.source,
        message: `${action.source} action ${action.rawCode} at record ${action.recordIndex}, slot ${action.slot} is ignored by the newland.c dispatcher.`,
        readerTitle: `Ignored action word ${action.rawCode}`,
        readerSummary: action.formatSuspicion || "newland.c has no switch case for this action word, so the runtime dispatcher ignores it.",
        clusterKey: `dispatcher-noop:${action.source}:${action.rawCode}`,
        recommendedNextStep: "Investigate neighboring actions and source/corpus evidence only if you need to explain why this no-op word was authored.",
        data: {
          source: action.source,
          levelType: action.levelType,
          levelIndex: action.levelIndex,
          recordIndex: action.recordIndex,
          slot: action.slot,
          rawCode: action.rawCode,
          normalizedCode: action.code,
          id: action.id,
        },
      });
      continue;
    }
    if (action.category === "unknown" || String(action.label || "").startsWith("opcode ")) {
      pushDiagnostic(output, {
        id: `diagnostic:unknown-opcode:${output.diagnostics.length}`,
        type: "unknown-opcode",
        confidence: "fixture-backed",
        source: action.source,
        message: `${action.source} action ${action.rawCode} at record ${action.recordIndex}, slot ${action.slot} is not yet semantically classified.`,
        readerTitle: `Unknown action ${action.rawCode}`,
        readerSummary: action.formatSuspicion || "This active action slot is not yet mapped to a source-backed Realmz behavior.",
        clusterKey: `unknown-opcode:${action.source}:${action.rawCode}`,
        recommendedNextStep: "Cluster examples by source, EDCD row, neighboring actions, and scenario spread before assigning a friendly semantic label.",
        data: {
          source: action.source,
          levelType: action.levelType,
          levelIndex: action.levelIndex,
          recordIndex: action.recordIndex,
          slot: action.slot,
          rawCode: action.rawCode,
          normalizedCode: action.code,
          id: action.id,
        },
      });
    }
    if (action.missingExtracode) {
      pushDiagnostic(output, {
        id: `diagnostic:missing-edcd:${output.diagnostics.length}`,
        type: "missing-edcd",
        confidence: "source-backed",
        source: action.source,
        message: `${action.source} opcode ${action.code} expects EDCD row ${action.id}, but that row is missing.`,
        readerTitle: `Missing EDCD ${action.id}`,
        readerSummary: `${action.label || `Opcode ${action.code}`} expects an action-data row that was not decoded from Data EDCD.`,
        clusterKey: `missing-edcd:${action.source}:${action.code}`,
        recommendedNextStep: "Check whether the target row is out of range, inactive in this scenario, or supplied by a generated runtime cache.",
        data: {
          source: action.source,
          levelType: action.levelType,
          levelIndex: action.levelIndex,
          recordIndex: action.recordIndex,
          slot: action.slot,
          code: action.code,
          rawCode: action.rawCode,
          edcdId: action.id,
        },
      });
    }
  }
}

function confidenceCounts(items) {
  const counts = {};
  for (const item of items || []) {
    const key = item?.confidence || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function firstExamples(items, limit = 6) {
  return items.slice(0, limit).map((item) => ({
    id: item.id,
    source: item.source,
    message: item.message,
    readerTitle: item.readerTitle,
    readerSummary: item.readerSummary,
    data: item.data,
  }));
}

const DEBT_CONFIDENCES = new Set(["unknown", "inferred", "fixture-backed"]);

function confidenceRank(confidence) {
  return {
    unknown: 5,
    inferred: 4,
    "fixture-backed": 3,
    "runtime-observed": 2,
    "source-backed": 1,
    confirmed: 0,
  }[confidence] ?? 0;
}

function impactRank(impact) {
  return { high: 3, medium: 2, low: 1 }[impact] || 1;
}

function evidenceRefsFor(item) {
  const refs = new Set();
  for (const ref of item?.evidence || []) refs.add(ref);
  if (item?.evidenceRef) refs.add(item.evidenceRef);
  if (item?.clusterKey) refs.add(item.clusterKey);
  if (item?.recordRef) refs.add(item.recordRef);
  if (item?.source) refs.add(String(item.source));
  if (item?.registry?.evidenceRef) refs.add(item.registry.evidenceRef);
  return [...refs].filter(Boolean);
}

function evidenceKindsFor(refs) {
  const kinds = new Set();
  for (const ref of refs || []) {
    if (String(ref).startsWith("anchor:")) kinds.add("source-anchor");
    else if (String(ref).startsWith("record:")) kinds.add("decoded-record");
    else if (String(ref).startsWith("resource-type:")) kinds.add("resource-catalog");
    else if (String(ref).includes("unknown-opcode") || String(ref).includes("format-gap") || String(ref).includes("missing-edcd")) kinds.add("diagnostic-cluster");
    else if (String(ref).includes("resource fork") || String(ref).includes("resource")) kinds.add("resource-evidence");
    else if (String(ref).includes("fixture") || String(ref).includes("inventory")) kinds.add("fixture-inventory");
    else kinds.add("schema-reference");
  }
  return [...kinds];
}

function ledgerSubjectType(item, fallback = "semantic object") {
  return item?.subjectType || item?.type || item?.kind || fallback;
}

function confidenceClaim(item) {
  return item?.claim || item?.summary || item?.readerSummary || item?.message || item?.label || item?.title || "Semantic claim is preserved without enough evidence to promote yet.";
}

function confidenceExampleFor(item) {
  const rawData = item?.data ?? item?.summary ?? {};
  const data = rawData && typeof rawData === "object" && !Array.isArray(rawData)
    ? rawData
    : { value: rawData };
  return {
    id: item?.id,
    source: item?.source,
    message: item?.message || item?.readerSummary || item?.summary || item?.label || item?.title,
    readerTitle: item?.readerTitle || item?.title || item?.label || item?.id,
    readerSummary: item?.readerSummary || item?.summary,
    data: {
      ...data,
      subjectId: item?.subjectId || item?.id,
      recordRef: item?.recordRef,
      confidence: item?.confidence,
    },
  };
}

function promotionTargetFor(confidence, item) {
  if (confidence === "unknown") return "inferred after repeated structure or source context explains the value";
  if (confidence === "inferred") return item?.evidenceRef?.startsWith?.("anchor:")
    ? "fixture-backed with representative assertions"
    : "fixture-backed with corpus/fixture assertions, then source-backed with source anchor";
  if (confidence === "fixture-backed") return "source-backed after a concrete source/report anchor explains the role";
  if (confidence === "runtime-observed") return "fixture-backed after repeatable fixture coverage";
  return "";
}

function blockingQuestionFor(item, confidence) {
  const type = ledgerSubjectType(item);
  if (type === "unknown-opcode") return "Which source path or runtime behavior explains this active action word?";
  if (type === "format-gap") return "Are these bytes reachable authored behavior, editor leftovers, or generated/runtime residue?";
  if (String(type).includes("resource")) return "Which runtime callsite or source report explains this resource type's role?";
  if (confidence === "fixture-backed") return "Which concrete source anchor explains the fixture-observed behavior?";
  if (confidence === "inferred") return "Which fixture assertion or source anchor can prove this interpretation?";
  return "What evidence is needed before this can carry a friendly semantic label?";
}

function recommendedNextStepFor(item, confidence) {
  if (item?.recommendedNextStep) return item.recommendedNextStep;
  const type = ledgerSubjectType(item);
  if (type === "unknown-opcode") return "Inspect newland.c, generated opcode maps, EDCD neighbors, and corpus examples before assigning intent.";
  if (type === "format-gap") return "Compare reachability and record ownership across source, fixtures, and generated corpus inventory.";
  if (String(type).includes("resource")) return "Attach resource provenance, preview availability, and a source/report callsite before promotion.";
  if (confidence === "fixture-backed") return "Find or add the concrete source anchor that explains the fixture-backed claim.";
  if (confidence === "inferred") return "Add representative fixture coverage or keep the label explicitly inferred.";
  return "Collect examples and source context before promoting confidence.";
}

function confidenceDebtGroup(item, ledgerEntry) {
  const type = ledgerSubjectType(item);
  const confidence = ledgerEntry.currentConfidence;
  const refs = ledgerEntry.evidenceRefs || [];
  const subjectId = String(ledgerEntry.subjectId || "");
  if (type === "unknown-opcode" || String(ledgerEntry.subjectId).includes("unknown-opcode")) return "active unknown";
  const ed3Ref = [subjectId, ledgerEntry.claim, ...refs].map(String).find((value) => value.includes("ed3-reachability:"));
  if (ed3Ref) {
    const classification = ed3Ref.split("ed3-reachability:")[1]?.split(/[|,\s]/)[0] || "format-evidence";
    return `ed3 ${classification}`;
  }
  if (
    type === "format-gap" ||
    type === "trailing-bytes" ||
    type === "partial-records" ||
    subjectId.includes("format-gap") ||
    subjectId.includes("trailing") ||
    subjectId.includes("partial") ||
    String(ledgerEntry.claim).includes("unreferenced") ||
    refs.some((ref) => String(ref).includes("format-gap") || String(ref).includes("trailing") || String(ref).includes("partial"))
  ) return "inferred format evidence";
  if (String(type).includes("resource type") || subjectId.startsWith("resource-type:") || subjectId.startsWith("decoding:note:resource:")) {
    if (confidence === "inferred") return "inferred format evidence";
    return confidence === "fixture-backed" ? "fixture-backed taxonomy" : "missing source anchor";
  }
  if (String(type).includes("resource") || subjectId.startsWith("resource:")) {
    if (confidence === "inferred") return "inferred format evidence";
    return "fixture-backed resources";
  }
  if (confidence === "fixture-backed" && !refs.some((ref) => String(ref).startsWith("anchor:"))) return "missing source anchor";
  if (confidence === "fixture-backed") return "fixture-backed taxonomy";
  if (confidence === "inferred") return "inferred semantic label";
  return "missing source anchor";
}

function tileAtlasConfidence(atlas) {
  if (atlas?.tilesetClue?.sourceResource || atlas?.sourceResource) return "source-backed";
  if (atlas?.available) return "fixture-backed";
  return "runtime-observed";
}

function makeConfidenceLedgerEntry(item, options = {}) {
  const confidence = item?.confidence || "unknown";
  if (!DEBT_CONFIDENCES.has(confidence)) return null;
  const subjectId = options.subjectId || item?.id || item?.clusterKey || item?.evidenceRef;
  if (!subjectId) return null;
  const evidenceRefs = evidenceRefsFor(item);
  const examples = item?.examples?.length ? firstExamples(item.examples, 6) : [confidenceExampleFor(item)];
  const subjectType = options.subjectType || ledgerSubjectType(item, options.fallbackType);
  const claim = confidenceClaim(item);
  return {
    id: `decoding:confidence:${printableToken(subjectId)}`,
    subjectId,
    subjectType,
    currentConfidence: confidence,
    confidence,
    claim,
    title: item?.title || item?.label || labelize(subjectType),
    summary: claim,
    evidenceRefs,
    evidenceKinds: evidenceKindsFor(evidenceRefs),
    exampleCount: item?.count || examples.length,
    examples,
    promotionTarget: promotionTargetFor(confidence, item),
    blockingQuestion: blockingQuestionFor(item, confidence),
    recommendedNextStep: recommendedNextStepFor(item, confidence),
    userFacingImpact: item?.userFacingImpact || (subjectType === "unknown-opcode" ? "high" : "medium"),
  };
}

function buildConfidenceLedger(output, { unknownClusters, hypotheses, formatNotes, coverage }) {
  const entries = [];
  const seen = new Set();
  const add = (item, options = {}) => {
    const entry = makeConfidenceLedgerEntry(item, options);
    if (!entry || seen.has(entry.id)) return;
    seen.add(entry.id);
    entries.push(entry);
  };

  for (const item of unknownClusters || []) add(item, { fallbackType: "unknown cluster" });
  for (const item of hypotheses || []) add(item, { fallbackType: "hypothesis" });
  for (const item of formatNotes || []) add(item, { fallbackType: "format note" });
  for (const item of coverage || []) add(item, { fallbackType: "coverage" });
  for (const item of output.entities || []) add(item, { fallbackType: "entity" });
  for (const item of output.records || []) add(item, { fallbackType: "record" });
  for (const item of output.links || []) add(item, { fallbackType: "link" });

  return entries.sort((a, b) =>
    confidenceRank(b.currentConfidence) - confidenceRank(a.currentConfidence) ||
    impactRank(b.userFacingImpact) - impactRank(a.userFacingImpact) ||
    b.exampleCount - a.exampleCount ||
    String(a.title).localeCompare(String(b.title))
  );
}

function buildConfidenceDebt(confidenceLedger) {
  const groups = new Map();
  for (const entry of confidenceLedger || []) {
    const groupKey = confidenceDebtGroup({ type: entry.subjectType }, entry);
    const group = groups.get(groupKey) || {
      id: `decoding:debt:${groupKey.replace(/\s+/g, "-")}`,
      type: "confidence-debt",
      group: groupKey,
      title: labelize(groupKey),
      summary: "",
      confidence: entry.currentConfidence,
      currentConfidence: entry.currentConfidence,
      count: 0,
      activeUseCount: 0,
      userFacingImpact: "medium",
      examples: [],
      ledgerIds: [],
      evidenceRefs: [],
      evidenceKinds: [],
      promotionTarget: "",
      blockingQuestion: "",
      recommendedNextStep: "",
    };
    group.count += entry.exampleCount || 1;
    if (entry.subjectType === "unknown-opcode") group.activeUseCount += entry.exampleCount || 1;
    group.confidence = confidenceRank(entry.currentConfidence) > confidenceRank(group.confidence) ? entry.currentConfidence : group.confidence;
    group.currentConfidence = group.confidence;
    group.userFacingImpact = impactRank(entry.userFacingImpact) > impactRank(group.userFacingImpact) ? entry.userFacingImpact : group.userFacingImpact;
    if (group.examples.length < 8) group.examples.push(...(entry.examples || []).slice(0, 8 - group.examples.length));
    if (group.ledgerIds.length < 24) group.ledgerIds.push(entry.id);
    for (const ref of entry.evidenceRefs || []) if (!group.evidenceRefs.includes(ref)) group.evidenceRefs.push(ref);
    for (const kind of entry.evidenceKinds || []) if (!group.evidenceKinds.includes(kind)) group.evidenceKinds.push(kind);
    if (!group.promotionTarget) group.promotionTarget = entry.promotionTarget;
    if (!group.blockingQuestion) group.blockingQuestion = entry.blockingQuestion;
    if (!group.recommendedNextStep) group.recommendedNextStep = entry.recommendedNextStep;
    groups.set(groupKey, group);
  }

  for (const group of groups.values()) {
    if (!group.summary) {
      group.summary = `${group.count} ${group.title.toLowerCase()} claim${group.count === 1 ? "" : "s"} need stronger evidence before promotion.`;
    }
  }

  return [...groups.values()].sort((a, b) =>
    impactRank(b.userFacingImpact) - impactRank(a.userFacingImpact) ||
    confidenceRank(b.currentConfidence) - confidenceRank(a.currentConfidence) ||
    b.activeUseCount - a.activeUseCount ||
    b.count - a.count ||
    a.title.localeCompare(b.title)
  );
}

function buildUnknownClusters(diagnostics, graph) {
  const groups = new Map();
  const add = (key, entry) => {
    const group = groups.get(key) || {
      id: `decoding:cluster:${groups.size}`,
      clusterKey: key,
      title: entry.title,
      summary: entry.summary,
      type: entry.type,
      severity: entry.severity || "info",
      confidence: entry.confidence || "unknown",
      count: 0,
      scenarioSpread: 1,
      activeUseCount: 0,
      userFacingImpact: entry.userFacingImpact || "medium",
      examples: [],
      recommendedNextStep: entry.recommendedNextStep,
    };
    group.count += entry.count || 1;
    group.activeUseCount += entry.activeUseCount || 0;
    if (group.examples.length < 8 && entry.example) group.examples.push(entry.example);
    groups.set(key, group);
  };

  for (const diagnostic of diagnostics || []) {
    if (diagnostic.type === "dispatcher-noop") continue;
    const key = diagnostic.clusterKey || `${diagnostic.type}:${diagnostic.source}`;
    add(key, {
      title: diagnostic.readerTitle || labelize(diagnostic.type),
      summary: diagnostic.readerSummary || diagnostic.message,
      type: diagnostic.type,
      severity: diagnostic.severity,
      confidence: diagnostic.confidence,
      activeUseCount: diagnostic.type === "unknown-opcode" || diagnostic.type === "missing-edcd" || diagnostic.type === "dispatcher-noop" ? 1 : 0,
      userFacingImpact: diagnostic.type === "unknown-opcode" || diagnostic.type === "missing-edcd" ? "high" : "medium",
      recommendedNextStep: diagnostic.recommendedNextStep,
      example: {
        id: diagnostic.id,
        source: diagnostic.source,
        message: diagnostic.message,
        data: diagnostic.data,
      },
    });
  }

  for (const action of graph?.actions || []) {
    if (action.category !== "unknown") continue;
    const key = `unknown-opcode:${action.source}:${action.rawCode}`;
    if (groups.has(key)) continue;
    add(key, {
      title: `Unknown action ${action.rawCode}`,
      summary: action.formatSuspicion || "Active action slot not mapped to a source-backed behavior yet.",
      type: "unknown-opcode",
      severity: "warning",
      confidence: "fixture-backed",
      activeUseCount: 1,
      userFacingImpact: "high",
      recommendedNextStep: "Inspect source and corpus neighbors before assigning a semantic label.",
      example: {
        source: action.source,
        data: {
          source: action.source,
          levelType: action.levelType,
          levelIndex: action.levelIndex,
          recordIndex: action.recordIndex,
          slot: action.slot,
          rawCode: action.rawCode,
          id: action.id,
        },
      },
    });
  }

  return [...groups.values()].sort((a, b) =>
    b.activeUseCount - a.activeUseCount ||
    b.count - a.count ||
    String(a.title).localeCompare(String(b.title))
  );
}

function buildDispatcherNoops(diagnostics) {
  return (diagnostics || [])
    .filter((diagnostic) => diagnostic.type === "dispatcher-noop")
    .map((diagnostic, index) => ({
      id: `decoding:dispatcher-noop:${index}`,
      title: diagnostic.readerTitle || `Ignored action word ${diagnostic.data?.rawCode ?? ""}`,
      summary: diagnostic.readerSummary || diagnostic.message,
      type: "dispatcher-noop",
      severity: diagnostic.severity || "info",
      confidence: diagnostic.confidence || "source-backed",
      count: 1,
      userFacingImpact: "low",
      evidenceRef: diagnostic.clusterKey,
      recommendedNextStep: diagnostic.recommendedNextStep,
      examples: [{
        id: diagnostic.id,
        source: diagnostic.source,
        message: diagnostic.message,
        data: diagnostic.data,
      }],
    }));
}

const ED3_TRACE_CODES = new Set([1, 3, 5, 9, 10, 11, 23, 25, 27, 42, 46, 47, 56, 57, 59, 61, 72, 75, 76, 77, 78, 85, 86, 87, 92, 107, 126]);

function isRuntimeMutationMacroRole(role) {
  const normalized = String(role || "").toLowerCase();
  return normalized.includes("replacement action source") || normalized.startsWith("copy into door");
}

function compactIncomingRef(link) {
  return {
    id: link.id,
    from: link.from,
    kind: link.kind,
    rootType: link.rootType || link.metadata?.rootType,
    confidence: link.confidence,
    sourceAnchor: link.sourceAnchor || link.metadata?.sourceAnchor,
    evidence: link.evidence || [],
    slot: link.metadata?.slot,
    code: link.metadata?.code ?? link.metadata?.rawCode,
    rawValue: link.metadata?.rawValue,
  };
}

function ed3NeighborSignature(door, macroDoorsById) {
  const previous = macroDoorsById.get(door.recordIndex - 1);
  const next = macroDoorsById.get(door.recordIndex + 1);
  const summarize = (neighbor) => neighbor ? {
    recordIndex: neighbor.recordIndex,
    actionCount: neighbor.actions?.length || 0,
    reachable: Boolean(neighbor.reachable),
    rawCodes: (neighbor.codes || []).filter((code) => code !== 0).slice(0, 4),
  } : null;
  return {
    previous: summarize(previous),
    next: summarize(next),
  };
}

function classifyEd3Case(door, knownIncomingRefs, possibleIncomingRefs) {
  const rawCodes = door.codes || [];
  const actionIds = door.ids || [];
  const nonZeroCodes = rawCodes.filter((code) => code !== 0);
  const nonZeroIds = actionIds.filter((id) => id !== 0);
  const actionCount = door.actions?.length || 0;
  const hasTraceCode = nonZeroCodes.some((code) => ED3_TRACE_CODES.has(Math.abs(code)));
  const hasMeaningfulIds = nonZeroIds.some((id) => Math.abs(id) > 1);

  if (door.reachable && knownIncomingRefs.length) {
    return {
      classification: "reachable-known-path",
      confidence: "source-backed",
      title: `Reachable Macro ${door.recordIndex}`,
      summary: `Data ED3 record ${door.recordIndex} is reached by a decoded source-backed incoming reference.`,
      classificationReason: "A source-backed macro root or recursive macro call reaches this ED3 record.",
      promotionRule: "Already promoted: keep source anchors attached to every incoming root.",
      recommendedNextStep: "Keep this row in normal macro/script rendering; it is not unreferenced format evidence.",
    };
  }
  if (possibleIncomingRefs.some((ref) => ref.rootType === "runtime-copy-candidate")) {
    return {
      classification: "runtime-mutation-candidate",
      confidence: "possible",
      title: `Runtime Copy Candidate Macro ${door.recordIndex}`,
      summary: `Data ED3 record ${door.recordIndex} is referenced by action-data copy or replacement behavior, but no direct macro execution path is decoded.`,
      classificationReason: "Source-backed copy/replace mechanics mention this macro as data, not as a direct loaddoor2 target.",
      promotionRule: "Promote only if source or runtime tracing proves the copied action bytes are later executed from this ED3 row or its runtime destination.",
      recommendedNextStep: "Trace the runtime copy/replace destination before treating this row as executable macro content.",
    };
  }
  if (actionCount <= 2 && nonZeroCodes.length <= 2 && nonZeroIds.length <= 1) {
    return {
      classification: "probable-editor-padding",
      confidence: "inferred",
      title: `Probable Padding Macro ${door.recordIndex}`,
      summary: `Data ED3 record ${door.recordIndex} has sparse action-like bytes and no decoded incoming path.`,
      classificationReason: "The row has very few populated action words and no source-backed incoming path.",
      promotionRule: "Promote only if a source-backed root, fixture assertion, or runtime trace shows the row is loaded.",
      recommendedNextStep: "Compare neighboring rows and source record alignment before treating this as authored content.",
    };
  }
  if (hasTraceCode && (actionCount >= 4 || hasMeaningfulIds || possibleIncomingRefs.length)) {
    return {
      classification: "needs-runtime-trace",
      confidence: "inferred",
      title: `Runtime Trace Candidate Macro ${door.recordIndex}`,
      summary: `Data ED3 record ${door.recordIndex} contains high-signal action bytes but no decoded incoming path.`,
      classificationReason: "The row contains meaningful-looking action bytes, but source/corpus reachability is not yet proven.",
      promotionRule: "Promote only if a source-backed hidden entry path or targeted runtime trace proves loaddoor2 reaches this record.",
      recommendedNextStep: "Trace classic runtime macro loads before promoting this row to reachable semantics.",
    };
  }
  if (actionCount >= 3 || hasMeaningfulIds) {
    return {
      classification: "orphan-authored-content",
      confidence: "inferred",
      title: `Orphan Authored Macro ${door.recordIndex}`,
      summary: `Data ED3 record ${door.recordIndex} looks authored but has no decoded incoming path.`,
      classificationReason: "The row has multiple populated actions or meaningful ids, but no known incoming root.",
      promotionRule: "Promote only if a concrete source-backed incoming path is found.",
      recommendedNextStep: "Search source/corpus references for hidden macro entry paths before exposing this as executable content.",
    };
  }
  return {
    classification: "unreferenced-action-bytes",
    confidence: "inferred",
    title: `Unreferenced Macro ${door.recordIndex}`,
    summary: `Data ED3 record ${door.recordIndex} preserves action-like bytes with no decoded incoming path.`,
    classificationReason: "The row contains action-shaped data, but current evidence does not identify a runtime entry path.",
    promotionRule: "Promote only if a source-backed incoming path is found.",
    recommendedNextStep: "Keep as format evidence unless a source-backed incoming path is found.",
  };
}

function uniqueRefs(refs) {
  const seen = new Set();
  const out = [];
  for (const ref of refs || []) {
    const key = JSON.stringify([ref.from || ref.source, ref.kind || ref.role || ref.reason, ref.rootType, ref.slot, ref.code, ref.rawValue, ref.sourceAnchor]);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

function buildEd3Reachability(output, doors, graph) {
  const macroDoors = (doors || [])
    .filter((door) => door.source === "Data ED3" && door.actions?.length)
    .sort((a, b) => a.recordIndex - b.recordIndex);
  const macroDoorsById = new Map(macroDoors.map((door) => [door.recordIndex, door]));
  const incomingByMacro = new Map();
  const possibleByMacro = new Map();
  for (const link of output.links || []) {
    const match = /^macro:(-?\d+)$/.exec(String(link.to || ""));
    if (!match) continue;
    const id = Number(match[1]);
    if (isRuntimeMutationMacroRole(link.kind)) {
      if (!possibleByMacro.has(id)) possibleByMacro.set(id, []);
      possibleByMacro.get(id).push({
        source: link.from,
        reason: link.kind,
        rootType: "runtime-copy-candidate",
        confidence: "possible",
        sourceAnchor: "anchor:runtime-copy-candidate",
        evidence: link.evidence || [],
        action: link.metadata || null,
      });
      continue;
    }
    if (!incomingByMacro.has(id)) incomingByMacro.set(id, []);
    incomingByMacro.get(id).push(compactIncomingRef(link));
  }

  for (const ref of graph?.unresolvedRefs || []) {
    if (ref.refType !== "macro" || !Number.isInteger(ref.refId)) continue;
    if (ref.reason === "Macro record is missing or inactive" && ref.action?.code === 7) {
      continue;
    }
    if ((ref.action?.links || []).some((link) => link.type === "macro" && link.id === ref.refId && isRuntimeMutationMacroRole(link.role))) {
      continue;
    }
    if (!possibleByMacro.has(ref.refId)) possibleByMacro.set(ref.refId, []);
    possibleByMacro.get(ref.refId).push({
      source: ref.source,
      reason: ref.reason,
      action: ref.action ? {
        source: ref.action.source,
        levelType: ref.action.levelType,
        levelIndex: ref.action.levelIndex,
        recordIndex: ref.action.recordIndex,
        slot: ref.action.slot,
        rawCode: ref.action.rawCode,
        id: ref.action.id,
      } : null,
    });
  }
  for (const door of macroDoors) {
    for (const ref of door.macroIncomingRefs || []) {
      if (!incomingByMacro.has(door.recordIndex)) incomingByMacro.set(door.recordIndex, []);
      incomingByMacro.get(door.recordIndex).push(compactIncomingRef({
        id: `parser-root:${door.recordIndex}:${incomingByMacro.get(door.recordIndex).length}`,
        from: ref.from,
        kind: ref.role,
        rootType: ref.rootType,
        confidence: ref.confidence,
        sourceAnchor: ref.sourceAnchor,
        evidence: ref.evidence,
        metadata: ref,
      }));
    }
    for (const ref of door.macroPossibleRefs || []) {
      if (!possibleByMacro.has(door.recordIndex)) possibleByMacro.set(door.recordIndex, []);
      possibleByMacro.get(door.recordIndex).push({
        source: ref.from,
        reason: ref.role,
        rootType: ref.rootType,
        confidence: ref.confidence,
        sourceAnchor: ref.sourceAnchor,
        evidence: ref.evidence || [],
        action: ref.action || null,
      });
    }
  }

  const cases = macroDoors.map((door) => {
    const knownIncomingRefs = uniqueRefs(incomingByMacro.get(door.recordIndex) || []);
    const possibleIncomingRefs = uniqueRefs(possibleByMacro.get(door.recordIndex) || []);
    const classification = classifyEd3Case(door, knownIncomingRefs, possibleIncomingRefs);
    const sourceAnchors = uniqueRefs([
      ...knownIncomingRefs.map((ref) => ({ sourceAnchor: ref.sourceAnchor, confidence: ref.confidence })),
      ...possibleIncomingRefs.map((ref) => ({ sourceAnchor: ref.sourceAnchor, confidence: ref.confidence })),
    ])
      .map((ref) => ref.sourceAnchor)
      .filter(Boolean);
    const entryPathEvidence = [
      ...knownIncomingRefs.map((ref) => ({ ...ref, pathStatus: "known" })),
      ...possibleIncomingRefs.map((ref) => ({ ...ref, pathStatus: "possible" })),
    ];
    return {
      id: `decoding:ed3:${door.recordIndex}`,
      type: "ed3-reachability",
      recordIndex: door.recordIndex,
      confidence: classification.confidence,
      currentConfidence: classification.confidence,
      title: classification.title,
      summary: classification.summary,
      classification: classification.classification,
      classificationReason: classification.classificationReason,
      promotionRule: classification.promotionRule,
      group: `ed3 ${classification.classification}`,
      sourceAnchors,
      entryPathEvidence,
      actionCount: door.actions.length,
      rawCodes: door.codes || [],
      actionIds: door.ids || [],
      knownIncomingRefs,
      possibleIncomingRefs,
      neighborSignature: ed3NeighborSignature(door, macroDoorsById),
      recommendedNextStep: classification.recommendedNextStep,
      examples: [{
        id: `record:Data ED3:macro:${door.recordIndex}`,
        source: "Data ED3",
        message: classification.summary,
        readerTitle: classification.title,
        data: {
          source: "Data ED3",
          recordIndex: door.recordIndex,
          actionCount: door.actions.length,
          rawCodes: door.codes || [],
          actionIds: door.ids || [],
          classification: classification.classification,
          classificationReason: classification.classificationReason,
          sourceAnchors,
        },
      }],
    };
  });
  const summary = {};
  for (const entry of cases) {
    summary[entry.classification] = (summary[entry.classification] || 0) + 1;
  }
  return {
    summary,
    cases,
  };
}

function buildHypotheses(unknownClusters, resources) {
  const hypotheses = [];
  for (const cluster of unknownClusters || []) {
    if (cluster.type === "format-gap") {
      hypotheses.push({
        id: `decoding:hypothesis:${hypotheses.length}`,
        title: "Preserved editor or padding bytes",
        summary: "These bytes are friendlier to show as format evidence than as executable script until a source path proves otherwise.",
        confidence: "inferred",
        evidenceRef: cluster.clusterKey,
        clusterId: cluster.id,
        rawEvidenceHiddenByDefault: true,
      });
    } else if (cluster.type === "unknown-opcode") {
      hypotheses.push({
        id: `decoding:hypothesis:${hypotheses.length}`,
        title: "Packed or undocumented action word",
        summary: "The value is outside the currently mapped newland dispatcher table; it may be packed data, a misaligned legacy record, or an extension.",
        confidence: "inferred",
        evidenceRef: cluster.clusterKey,
        clusterId: cluster.id,
        rawEvidenceHiddenByDefault: true,
      });
    } else if (cluster.type === "missing-edcd") {
      hypotheses.push({
        id: `decoding:hypothesis:${hypotheses.length}`,
        title: "Runtime-supplied or optional action data",
        summary: "The action expects EDCD parameters, but the row is not present in the authored Data EDCD file.",
        confidence: "inferred",
        evidenceRef: cluster.clusterKey,
        clusterId: cluster.id,
        rawEvidenceHiddenByDefault: true,
      });
    }
  }

  for (const type of resources?.catalog?.types || []) {
    if (RESOURCE_DECODER_REGISTRY[type.type]) continue;
    hypotheses.push({
      id: `decoding:hypothesis:${hypotheses.length}`,
      title: `${printableToken(type.type)} resource role unknown`,
      summary: `${type.count} resource entries of this type are catalogued, but no friendly taxonomy exists yet.`,
      confidence: "unknown",
      evidenceRef: `resource-type:${printableToken(type.type)}`,
      rawEvidenceHiddenByDefault: true,
    });
  }

  return hypotheses;
}

function buildFormatCoverage(output, graph, resources, records) {
  const actions = graph?.actions || [];
  const knownActions = actions.filter((action) => action.category && action.category !== "unknown" && action.category !== "format_gap");
  const dispatcherNoops = actions.filter((action) => action.category === "dispatcher_noop");
  const edcdActions = actions.filter((action) => action.extracodeUsage || action.missingExtracode);
  const resourceTypes = resources?.catalog?.types || [];
  const decodedResourceTypes = resourceTypes.filter((type) => RESOURCE_DECODER_REGISTRY[type.type]);
  const resourceCoverageConfidence = decodedResourceTypes.length === resourceTypes.length &&
    decodedResourceTypes.every((type) => RESOURCE_DECODER_REGISTRY[type.type]?.confidence !== "fixture-backed")
    ? "source-backed"
    : "fixture-backed";
  const recordSets = Object.entries(records || {}).filter(([, collection]) => collection && collection.status !== "missing");
  const sourceBackedRecords = recordSets.filter(([, collection]) => collection.status === "decoded" || collection.status === "indexed");

  return [
    {
      id: "decoding:coverage:actions",
      title: "Actions",
      summary: `${knownActions.length} of ${actions.length} active action slots have source-backed behavior categories; ${dispatcherNoops.length} are dispatcher no-ops.`,
      known: knownActions.length,
      total: actions.length,
      confidence: "source-backed",
      registry: ACTION_DECODER_REGISTRY["known-opcodes"],
    },
    {
      id: "decoding:coverage:edcd",
      title: "EDCD",
      summary: `${edcdActions.filter((action) => action.extracodeUsage).length} action-data uses have decoded field shapes; ${edcdActions.filter((action) => action.missingExtracode).length} are missing rows.`,
      known: edcdActions.filter((action) => action.extracodeUsage).length,
      total: edcdActions.length,
      confidence: "source-backed",
      registry: ACTION_DECODER_REGISTRY["edcd-shapes"],
    },
    {
      id: "decoding:coverage:records",
      title: "Records",
      summary: `${sourceBackedRecords.length} of ${recordSets.length} fixed record collections are decoded or indexed.`,
      known: sourceBackedRecords.length,
      total: recordSets.length,
      confidence: "source-backed",
    },
    {
      id: "decoding:coverage:resources",
      title: "Resources",
      summary: `${decodedResourceTypes.length} of ${resourceTypes.length} resource types have friendly taxonomy notes.`,
      known: decodedResourceTypes.length,
      total: resourceTypes.length,
      confidence: resourceCoverageConfidence,
    },
    {
      id: "decoding:coverage:maps",
      title: "Maps",
      summary: "Land/dungeon grids, tileset clues, random metadata, darkness, LOS, and visible regions are decoded with remaining bitfield gaps preserved.",
      known: output.entities.filter((entity) => entity.type === "map" || entity.type === "random encounter area").length,
      total: output.entities.filter((entity) => entity.type === "map" || entity.type === "random encounter area").length,
      confidence: "source-backed",
    },
    {
      id: "decoding:coverage:encounters",
      title: "Encounters",
      summary: "Simple and complex encounter records expose prompts, text, gate fields, result slots, and script links where present.",
      known: output.entities.filter((entity) => entity.type === "simple encounter" || entity.type === "complex encounter").length,
      total: output.entities.filter((entity) => entity.type === "simple encounter" || entity.type === "complex encounter").length,
      confidence: "source-backed",
    },
    {
      id: "decoding:coverage:runtime-caches",
      title: "Runtime Caches",
      summary: "Generated cache behavior is represented as format notes and diagnostics; authored scenario files remain separate from runtime mutations.",
      known: 1,
      total: 1,
      confidence: "source-backed",
    },
  ];
}

function buildFormatNotes(resources) {
  const notes = [
    ...Object.values(ACTION_DECODER_REGISTRY).map((entry, index) => ({ id: `decoding:note:action:${index}`, ...entry })),
    ...Object.values(CONTAINER_DECODER_REGISTRY).map((entry) => ({ id: `decoding:note:container:${entry.title}`, ...entry })),
  ];
  for (const type of resources?.catalog?.types || []) {
    const registry = RESOURCE_DECODER_REGISTRY[type.type] || {
      title: `${printableToken(type.type)} resources`,
      summary: "Resource type is catalogued, but its role is not yet decoded.",
      confidence: "unknown",
      evidenceRef: `resource-type:${printableToken(type.type)}`,
    };
    notes.push({
      id: `decoding:note:resource:${printableToken(type.type)}`,
      ...registry,
      count: type.count,
      named: type.named,
    });
  }
  return notes;
}

function buildDecoding(output, { graph, resources, records, doors }) {
  const coverage = buildFormatCoverage(output, graph, resources, records);
  const unknownClusters = buildUnknownClusters(output.diagnostics, graph);
  const dispatcherNoops = buildDispatcherNoops(output.diagnostics);
  const ed3Reachability = buildEd3Reachability(output, doors, graph);
  const hypotheses = buildHypotheses(unknownClusters, resources);
  const formatNotes = buildFormatNotes(resources);
  const confidenceLedger = buildConfidenceLedger(output, { unknownClusters, hypotheses, formatNotes, coverage });
  const confidenceDebt = buildConfidenceDebt(confidenceLedger);
  const actions = graph?.actions || [];
  const unknownActions = actions.filter((action) => action.category === "unknown");
  const formatGapActions = actions.filter((action) => action.category === "format_gap");
  const dispatcherNoopActions = actions.filter((action) => action.category === "dispatcher_noop");
  const unreferencedMacroCount = ed3Reachability.cases.filter((entry) => entry.classification !== "reachable-known-path").length;
  return {
    schemaVersion: 1,
    summary: {
      coverageCount: coverage.length,
      unknownClusterCount: unknownClusters.length,
      dispatcherNoopCount: dispatcherNoops.length,
      hypothesisCount: hypotheses.length,
      formatNoteCount: formatNotes.length,
      confidenceLedgerCount: confidenceLedger.length,
      confidenceDebtCount: confidenceDebt.length,
      ed3ReachabilityCount: ed3Reachability.cases.length,
      ed3Reachability: ed3Reachability.summary,
      actionCount: actions.length,
      unknownActionCount: unknownActions.length,
      formatGapActionCount: formatGapActions.length,
      dispatcherNoopActionCount: dispatcherNoopActions.length,
      unreferencedMacroCount,
      confidence: confidenceCounts([
        ...(output.entities || []),
        ...(output.records || []),
        ...(output.links || []),
        ...(output.diagnostics || []),
        ...coverage,
        ...hypotheses,
        ...formatNotes,
      ]),
    },
    coverage,
    unknownClusters,
    dispatcherNoops,
    ed3Reachability,
    hypotheses,
    formatNotes,
    confidenceLedger,
    confidenceDebt,
    diagnostics: firstExamples(output.diagnostics, 24),
  };
}

export function buildSemanticSchema({
  scenario,
  files,
  alignment,
  assets,
  resources,
  levels,
  randLevels,
  doors,
  activeDoors,
  extracodes,
  simpleEncounters,
  complexEncounters,
  graph,
  records,
}) {
  const output = {
    schemaVersion: 1,
    scenario: {
      id: `scenario:${scenario.name}`,
      name: scenario.name,
      path: scenario.path,
      analyzedAt: scenario.analyzedAt,
    },
    sources: [],
    records: [],
    entities: [],
    links: [],
    evidence: [...SOURCE_ANCHORS],
    diagnostics: [],
  };

  for (const file of files || []) {
    const layout = RECORD_LAYOUTS[file.name];
    output.sources.push({
      id: sourceId(file.name),
      type: "file",
      name: file.name,
      exists: file.exists,
      bytes: file.bytes || 0,
      sha256: file.sha256 || null,
      layout: layout || null,
      confidence: layout?.confidence || (file.exists ? "runtime-observed" : "unknown"),
    });
  }
  if (resources?.resourcePath) {
    output.sources.push({
      id: "source:resource-fork:Scenario",
      type: "resource fork",
      name: "Scenario resource fork",
      path: resources.resourcePath,
      resourceCount: resources.catalog?.resourceCount || 0,
      typeCount: resources.catalog?.typeCount || 0,
      confidence: "fixture-backed",
    });
  }

  for (const level of levels || []) {
    const source = level.type === "land" ? "Data LD" : "Data DL";
    const mapLabel = level.displayName || level.name || fallbackMapLabel(level, randLevels);
    output.records.push({
      id: `record:${source}:${level.index}`,
      source: sourceId(source),
      type: `${level.type} field grid`,
      byteRange: byteRange(level.index * FIELD_BYTES, FIELD_BYTES),
      confidence: "confirmed",
      summary: {
        levelType: level.type,
        levelIndex: level.index,
        tiles: `${MAP_SIZE} x ${MAP_SIZE}`,
        tileRange: level.minTile === undefined ? null : [level.minTile, level.maxTile],
        dominantTiles: level.dominantTiles,
      },
    });
    output.entities.push({
      id: mapEntityId(level.type, level.index),
      type: "map",
      label: mapLabel,
      confidence: level.nameSource ? "source-backed" : "confirmed",
      source,
      recordRef: `record:${source}:${level.index}`,
      summary: {
        levelType: level.type,
        levelIndex: level.index,
        width: MAP_SIZE,
        height: MAP_SIZE,
        labelSource: level.nameSource || "Data field index and Data RD/RDD landlook",
        tilesetClue: level.tilesetClue || null,
        render: level.render || null,
      },
    });
  }

  for (const randLevel of randLevels || []) {
    const source = randLevel.levelType === "land" ? "Data RD" : "Data RDD";
    output.records.push({
      id: `record:${source}:${randLevel.levelIndex}`,
      source: sourceId(source),
      type: `${randLevel.levelType} random metadata`,
      byteRange: byteRange(randLevel.levelIndex * RANDLEVEL_BYTES, RANDLEVEL_BYTES),
      confidence: "source-backed",
      summary: {
        landlook: randLevel.landlook,
        isdark: randLevel.isdark,
        uselos: randLevel.uselos,
        rectCount: randLevel.rects?.length || 0,
      },
    });
    output.links.push({
      id: `link:${output.links.length}`,
      from: `record:${source}:${randLevel.levelIndex}`,
      to: mapEntityId(randLevel.levelType, randLevel.levelIndex),
      kind: "configures_map",
      confidence: "source-backed",
      evidence: [`record:${source}:${randLevel.levelIndex}`],
    });
    for (const rect of randLevel.rects || []) {
      const entity = {
        id: `random:${randLevel.levelType}:${randLevel.levelIndex}:${rect.id}`,
        type: "random encounter area",
        label: `R${rect.id} @ ${rect.left},${rect.top} - ${rect.right},${rect.bottom}`,
        confidence: "source-backed",
        source,
        recordRef: `record:${source}:${randLevel.levelIndex}`,
        summary: {
          levelType: randLevel.levelType,
          levelIndex: randLevel.levelIndex,
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
          battleLow: rect.randBattleLow,
          battleHigh: rect.randBattleHigh,
          encounterLow: rect.randDoorLow,
          encounterHigh: rect.randDoorHigh,
          percent: rect.randDoorPercent,
        },
      };
      output.entities.push(entity);
      output.links.push({
        id: `link:${output.links.length}`,
        from: entity.id,
        to: mapEntityId(randLevel.levelType, randLevel.levelIndex),
        kind: "occupies_region",
        confidence: "source-backed",
        evidence: [`record:${source}:${randLevel.levelIndex}`],
      });
    }
  }

  for (const door of doors || []) {
    const entityId = triggerEntityId(door);
    output.records.push({
      id: `record:${door.source}:${door.levelIndex ?? "macro"}:${door.recordIndex}`,
      source: sourceId(door.source),
      type: door.source === "Data ED3" ? "macro action record" : "map trigger/action record",
      byteRange: recordRangeForDoor(door),
      confidence: "source-backed",
      summary: {
        active: door.active,
        doorid: door.doorid,
        percent: door.percent,
        location: door.hasMapCoordinate ? { levelType: door.levelType, levelIndex: door.levelIndex, x: door.x, y: door.y } : null,
        actions: door.actions.map(compactAction),
      },
    });
    if (!door.active) continue;
    output.entities.push({
      id: entityId,
      type: door.source === "Data ED3" ? "macro" : "trigger",
      label: door.source === "Data ED3" ? `Macro ${door.recordIndex}` : `${door.levelType} ${door.levelIndex} trigger ${door.recordIndex}`,
      confidence: "source-backed",
      source: door.source,
      recordRef: `record:${door.source}:${door.levelIndex ?? "macro"}:${door.recordIndex}`,
      summary: {
        levelType: door.levelType,
        levelIndex: door.levelIndex,
        x: door.x,
        y: door.y,
        percent: door.percent,
        actionCount: door.actions.length,
        actions: door.actions.map(compactAction),
      },
    });
    if (door.source !== "Data ED3" && door.hasMapCoordinate) {
      output.links.push({
        id: `link:${output.links.length}`,
        from: entityId,
        to: mapEntityId(door.levelType, door.levelIndex),
        kind: "located_on",
        confidence: "source-backed",
        evidence: [`record:${door.source}:${door.levelIndex}:${door.recordIndex}`],
      });
    }
  }

  for (const extra of extracodes || []) {
    output.records.push({
      id: `record:Data EDCD:${extra.id}`,
      source: sourceId("Data EDCD"),
      type: "extra-code row",
      byteRange: byteRange(extra.id * EXTRACODE_BYTES, EXTRACODE_BYTES),
      confidence: "source-backed",
      summary: { values: extra.values },
    });
  }

  for (const encounter of simpleEncounters || []) {
    output.entities.push({
      id: encounterEntityId("simple", encounter.id),
      type: "simple encounter",
      label: `Simple encounter ${encounter.id}`,
      confidence: "source-backed",
      source: "Data ED",
      recordRef: `record:Data ED:${encounter.id}`,
      summary: {
        prompt: encounter.prompt,
        maxTimes: encounter.maxTimes,
        text: encounter.text?.filter(Boolean).map(cleanText),
      },
    });
  }
  for (const encounter of complexEncounters || []) {
    output.entities.push({
      id: encounterEntityId("complex", encounter.id),
      type: "complex encounter",
      label: `Complex encounter ${encounter.id}`,
      confidence: "source-backed",
      source: "Data ED2",
      recordRef: `record:Data ED2:${encounter.id}`,
      summary: {
        prompt: encounter.prompt,
        maxTimes: encounter.maxTimes,
        thief: encounter.thief,
        text: encounter.text?.filter(Boolean).map(cleanText),
      },
    });
  }

  for (const flag of graph?.questFlags || []) {
    output.entities.push({
      id: `quest-flag:${flag.id}`,
      type: "quest flag",
      label: `Quest flag ${flag.id}`,
      confidence: "source-backed",
      source: "newland opcode semantics",
      summary: {
        readCount: flag.readCount,
        writeCount: flag.writeCount,
        locationCount: flag.locationCount,
      },
    });
  }

  addRecordsAndEntities(output, records);
  addResourceEntities(output, resources);
  addGraphEdges(output, graph);
  addActionLinks(output, graph?.actions);
  addMacroRootLinks(output, doors);
  addBattleLinks(output, records);
  addMonsterLinks(output, records);
  addMapRecordLinks(output, records, levels);

  if (assets?.tileAtlases?.length) {
    for (const atlas of assets.tileAtlases) {
      const confidence = tileAtlasConfidence(atlas);
      output.entities.push({
        id: `asset:tile-atlas:${atlas.landlook}`,
        type: "tile atlas",
        label: `Landlook ${atlas.landlook}`,
        confidence,
        source: atlas.source || "Data RD landlook tile atlas manifest",
        evidence: confidence === "source-backed" ? ["anchor:land-tile-atlas-selection"] : undefined,
        summary: atlas,
      });
    }
  }

  addDiagnostics(output, alignment, graph, doors);
  output.decoding = buildDecoding(output, { graph, resources, records, doors });
  output.summary = {
    sourceCount: output.sources.length,
    recordCount: output.records.length,
    entityCount: output.entities.length,
    linkCount: output.links.length,
    diagnosticCount: output.diagnostics.length,
  };

  return output;
}
