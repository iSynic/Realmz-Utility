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
    summary: "Standalone text resources used by scenario or UI presentation paths.",
    confidence: "fixture-backed",
    evidenceRef: "anchor:file-resource-formats",
  },
  "snd ": {
    title: "Sound resources",
    summary: "Classic sound resources referenced by action parameters and UI/runtime playback paths.",
    confidence: "fixture-backed",
    evidenceRef: "anchor:file-resource-formats",
  },
  "RLMZ": {
    title: "Realmz scenario marker resources",
    summary: "Scenario identification/compatibility resources seen in third-party and Divinity scenario packages.",
    confidence: "fixture-backed",
    evidenceRef: "anchor:file-resource-formats",
  },
  "styl": {
    title: "Styled-text resources",
    summary: "Classic styled text companion resources, usually paired with TEXT entries.",
    confidence: "fixture-backed",
    evidenceRef: "anchor:file-resource-formats",
  },
  "vers": {
    title: "Version resources",
    summary: "Classic version resources used for metadata and compatibility display.",
    confidence: "fixture-backed",
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
  for (const resource of resources?.resources || []) {
    const printableType = printableToken(resource.type);
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
      confidence: "fixture-backed",
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
      confidence: "fixture-backed",
      source: "Scenario resource fork",
      recordRef,
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
      confidence: "fixture-backed",
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
        confidence: "fixture-backed",
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
        confidence: "fixture-backed",
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
    pushDiagnostic(output, {
      id: `diagnostic:inactive-macro:${door.recordIndex}`,
      type: "format-gap",
      confidence: "inferred",
      source: door.source,
      message: `Data ED3 record ${door.recordIndex} contains action-like bytes but is not reachable from decoded script entry points.`,
      readerTitle: "Unreferenced macro/action bytes",
      readerSummary: "This Data ED3 row is preserved as raw evidence, but it is not treated as live script because no reachable action path calls it.",
      clusterKey: "format-gap:Data ED3:unreferenced-macro",
      recommendedNextStep: "Promote this row only if source or corpus evidence shows another runtime path can execute it.",
      data: {
        source: door.source,
        recordIndex: door.recordIndex,
        actionCount: door.actions.length,
        rawCodes: door.codes,
        actionIds: door.ids,
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
    const key = diagnostic.clusterKey || `${diagnostic.type}:${diagnostic.source}`;
    add(key, {
      title: diagnostic.readerTitle || labelize(diagnostic.type),
      summary: diagnostic.readerSummary || diagnostic.message,
      type: diagnostic.type,
      severity: diagnostic.severity,
      confidence: diagnostic.confidence,
      activeUseCount: diagnostic.type === "unknown-opcode" || diagnostic.type === "missing-edcd" ? 1 : 0,
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
  const edcdActions = actions.filter((action) => action.extracodeUsage || action.missingExtracode);
  const resourceTypes = resources?.catalog?.types || [];
  const decodedResourceTypes = resourceTypes.filter((type) => RESOURCE_DECODER_REGISTRY[type.type]);
  const recordSets = Object.entries(records || {}).filter(([, collection]) => collection && collection.status !== "missing");
  const sourceBackedRecords = recordSets.filter(([, collection]) => collection.status === "decoded" || collection.status === "indexed");

  return [
    {
      id: "decoding:coverage:actions",
      title: "Actions",
      summary: `${knownActions.length} of ${actions.length} active action slots have non-unknown categories.`,
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
      confidence: "fixture-backed",
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

function buildDecoding(output, { graph, resources, records }) {
  const coverage = buildFormatCoverage(output, graph, resources, records);
  const unknownClusters = buildUnknownClusters(output.diagnostics, graph);
  const hypotheses = buildHypotheses(unknownClusters, resources);
  const formatNotes = buildFormatNotes(resources);
  const actions = graph?.actions || [];
  const unknownActions = actions.filter((action) => action.category === "unknown");
  const formatGapActions = actions.filter((action) => action.category === "format_gap");
  const unreferencedMacroCount = output.diagnostics.filter((diagnostic) => diagnostic.clusterKey === "format-gap:Data ED3:unreferenced-macro").length;
  return {
    schemaVersion: 1,
    summary: {
      coverageCount: coverage.length,
      unknownClusterCount: unknownClusters.length,
      hypothesisCount: hypotheses.length,
      formatNoteCount: formatNotes.length,
      actionCount: actions.length,
      unknownActionCount: unknownActions.length,
      formatGapActionCount: formatGapActions.length,
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
    hypotheses,
    formatNotes,
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

  addDiagnostics(output, alignment, graph, doors);
  output.decoding = buildDecoding(output, { graph, resources, records });
  output.summary = {
    sourceCount: output.sources.length,
    recordCount: output.records.length,
    entityCount: output.entities.length,
    linkCount: output.links.length,
    diagnosticCount: output.diagnostics.length,
  };

  return output;
}
