const MAP_SIZE = 90;
const FIELD_BYTES = MAP_SIZE * MAP_SIZE * 2;
const DOOR_BYTES = 40;
const DOORS_PER_LEVEL = 100;
const RANDLEVEL_BYTES = 644;
const EXTRACODE_BYTES = 10;
const SIMPLE_ENCOUNTER_BYTES = 426;
const COMPLEX_ENCOUNTER_BYTES = 520;

const RECORD_LAYOUTS = {
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
    id: "anchor:opcode-inventory",
    confidence: "fixture-backed",
    source: "F:\\Realmz\\docs\\modernization\\scenario-opcode-inventory-generated.md",
    note: "Cross-scenario decoded door/action and EDCD usage inventory.",
  },
];

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
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
    if (battle.battleMacro) {
      output.links.push({
        id: `link:${output.links.length}`,
        from: battleId,
        to: `macro:${battle.battleMacro}`,
        kind: "calls_battle_macro",
        confidence: "source-backed",
        evidence: [`record:Data BD:${battle.id}`],
      });
    }
  }
}

function addMonsterLinks(output, records) {
  for (const monster of records?.monsters?.records || []) {
    const monsterId = `monster:${monster.id}`;
    if (monster.iconId) {
      output.links.push({
        id: `link:${output.links.length}`,
        from: monsterId,
        to: "resource-type:cicn",
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
        evidence: [`record:Data MD:${monster.id}`],
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
      confidence: record.nameSource ? "source-backed" : "inferred",
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
    const typeEntity = {
      id: `resource-type:${printableType}`,
      type: "resource type",
      label: `${printableType} resources`,
      confidence: "fixture-backed",
      source: "Scenario resource fork",
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

function addDiagnostics(output, alignment, graph) {
  for (const [key, value] of Object.entries(alignment || {})) {
    if (!value?.exists) continue;
    if (value.trailing || value.trailingBytes) {
      output.diagnostics.push({
        id: `diagnostic:alignment:${key}`,
        type: "trailing-bytes",
        confidence: "fixture-backed",
        source: key,
        message: `${key} has ${value.trailing || value.trailingBytes} trailing bytes after full records.`,
        data: value,
      });
    }
    if (value.partialRecords) {
      output.diagnostics.push({
        id: `diagnostic:partial:${key}`,
        type: "partial-records",
        confidence: "fixture-backed",
        source: key,
        message: `${key} contains ${value.partialRecords} legacy partial records accepted by the parser.`,
        data: value,
      });
    }
  }
  for (const ref of graph?.unresolvedRefs || []) {
    output.diagnostics.push({
      id: `diagnostic:unresolved:${output.diagnostics.length}`,
      type: "unresolved-reference",
      confidence: "source-backed",
      source: ref.source,
      message: `${ref.source} references missing ${ref.refType} ${ref.refId}: ${ref.reason}`,
      data: ref,
    });
  }
  for (const action of graph?.actions || []) {
    if (action.category === "unknown" || String(action.label || "").startsWith("opcode ")) {
      output.diagnostics.push({
        id: `diagnostic:unknown-opcode:${output.diagnostics.length}`,
        type: "unknown-opcode",
        confidence: "fixture-backed",
        source: action.source,
        message: `${action.source} action ${action.rawCode} at record ${action.recordIndex}, slot ${action.slot} is not yet semantically classified.`,
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
      output.diagnostics.push({
        id: `diagnostic:missing-edcd:${output.diagnostics.length}`,
        type: "missing-edcd",
        confidence: "source-backed",
        source: action.source,
        message: `${action.source} opcode ${action.code} expects EDCD row ${action.id}, but that row is missing.`,
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
      label: level.displayName || level.name || `${level.type} level ${level.index}`,
      confidence: level.nameSource ? "source-backed" : "fixture-backed",
      source,
      recordRef: `record:${source}:${level.index}`,
      summary: {
        levelType: level.type,
        levelIndex: level.index,
        width: MAP_SIZE,
        height: MAP_SIZE,
        nameHints: level.nameHints || [],
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
        text: encounter.text?.filter(Boolean).map(cleanText).slice(0, 4),
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
        text: encounter.text?.filter(Boolean).map(cleanText).slice(0, 5),
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
  addBattleLinks(output, records);
  addMonsterLinks(output, records);
  addMapRecordLinks(output, records, levels);

  if (assets?.tileAtlases?.length) {
    for (const atlas of assets.tileAtlases) {
      output.entities.push({
        id: `asset:tile-atlas:${atlas.landlook}`,
        type: "tile atlas",
        label: `Landlook ${atlas.landlook}`,
        confidence: atlas.available ? "fixture-backed" : "unknown",
        source: atlas.source || "asset manifest",
        summary: atlas,
      });
    }
  }

  addDiagnostics(output, alignment, graph);
  output.summary = {
    sourceCount: output.sources.length,
    recordCount: output.records.length,
    entityCount: output.entities.length,
    linkCount: output.links.length,
    diagnosticCount: output.diagnostics.length,
  };

  return output;
}
