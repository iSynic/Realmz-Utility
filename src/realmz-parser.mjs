import fs from "node:fs/promises";
import path from "node:path";
import { extractResourceFork } from "./resource-fork.mjs";
import crypto from "node:crypto";

const MAP_SIZE = 90;
const FIELD_BYTES = MAP_SIZE * MAP_SIZE * 2;
const DOOR_BYTES = 40;
const DOORS_PER_LEVEL = 100;
const RANDLEVEL_BYTES = 644;
const EXTRACODE_BYTES = 10;
const SIMPLE_ENCOUNTER_BYTES = 426;
const SIMPLE_STRUCT_BYTES = 106;
const COMPLEX_ENCOUNTER_BYTES = 520;
const COMPLEX_STRUCT_BYTES = 160;
const MACRO_SOURCE = "Data ED3";
const BATTLE_BYTES = 346;
const MONSTER_BYTES = 210;
const SHOP_BYTES = 3002;
const STRING_BYTES = 256;
const MAP_RECORD_BYTES = 340;
const TREASURE_BYTES = 48;
const TIME_ENCOUNTER_BYTES = 40;
const THIEF_BYTES = 118;
const CONTACT_BYTES = 4608;
const SOLIDS_BYTES = 1024;
const MENU_BYTES = 502;
const MAP_NAME_RESOURCE_IDS = [-102, -101];

const knownLevelNames = new Map([
  ["city of bywater", {
    land: new Map([
      [0, "Bywater"],
      [1, "Underdark"],
      [2, "Caves"],
      [3, "Waterford"],
      [4, "Tavern"],
      [5, "Interiors"],
      [6, "Brothel / Archives / Temple"],
      [7, "Waterford interiors"],
      [8, "Dogre castle"],
    ]),
    dungeon: new Map([
      [0, "Dungeons"],
      [1, "Dogre castle basement"],
    ]),
  }],
  ["prelude to pestilence", {
    land: new Map([
      [0, "Mountain View"],
      [1, "Caves"],
      [2, "Fingertip mountains"],
      [3, "Berhune castle"],
      [4, "Sewer"],
    ]),
    dungeon: new Map([
      [0, "Dungeons"],
    ]),
  }],
  ["assault on giant mountain", {
    land: new Map([
      [0, "Northgate"],
      [1, "Caves"],
      [2, "Grim Mountains"],
      [3, "Hill giants"],
      [4, "Gnaths"],
      [5, "Citadels"],
      [6, "Citadels"],
    ]),
    dungeon: new Map([
      [0, "Dungeon"],
      [1, "Dungeon"],
    ]),
  }],
]);

const overlayCategories = new Set(["quest", "encounter", "random", "entrance", "map mutation", "battle", "text", "unknown"]);

const opcodeInfo = new Map([
  [1, ["text", "ui_text"]],
  [2, ["battle", "combat"]],
  [3, ["choice", "branch"]],
  [4, ["simple encounter", "encounter"]],
  [5, ["complex encounter", "encounter"]],
  [6, ["load shop", "item_shop"]],
  [7, ["action data", "branch"]],
  [8, ["same as other door", "branch"]],
  [10, ["give treasure", "item_shop"]],
  [12, ["new land icon", "map"]],
  [13, ["enable / disable door", "map"]],
  [20, ["teleport", "map"]],
  [21, ["branch on item possession", "branch"]],
  [23, ["alter land random rect", "map"]],
  [-23, ["alter dungeon random rect", "map"]],
  [24, ["keep codes", "branch"]],
  [25, ["remove door x-y", "map"]],
  [29, ["give / display map", "ui_text"]],
  [37, ["dungeon move", "map"]],
  [39, ["extend door codes", "branch"]],
  [40, ["branch on party condition", "branch"]],
  [41, ["eliminate simple encounter option", "encounter"]],
  [42, ["branch on percent chance", "branch"]],
  [45, ["teleport only", "map"]],
  [46, ["branch on quest flag", "quest_read"]],
  [47, ["set quest flag", "quest_write"]],
  [48, ["selective combat", "combat"]],
  [54, ["alter time encounter", "time"]],
  [56, ["branch on battle outcome", "branch"]],
  [57, ["change land look", "map"]],
  [59, ["branch on tile id", "branch"]],
  [61, ["shift party level/x/y", "map"]],
  [63, ["alter game time", "time"]],
  [64, ["branch on game time", "branch"]],
  [66, ["disable / enable camping", "time"]],
  [70, ["save / restore party position", "map"]],
  [72, ["branch on range of quest flags", "quest_read"]],
  [73, ["load shop and restrict items", "item_shop"]],
  [75, ["branch on spell points", "branch"]],
  [76, ["increment / decrement quest value", "quest_write"]],
  [77, ["branch on quest value", "quest_read"]],
  [78, ["branch on tile parameters", "branch"]],
  [81, ["branch on PC condition", "branch"]],
  [85, ["branch to random door", "branch"]],
  [86, ["branch on misc", "branch"]],
  [87, ["branch on allies in party", "branch"]],
  [88, ["drop allies from party", "state"]],
  [89, ["add allies to party", "state"]],
  [92, ["alter random rect size", "map"]],
  [97, ["allow full map", "map"]],
  [103, ["test/set boat/camp status", "state"]],
  [106, ["set darkland status", "map"]],
  [107, ["improved selective battle", "combat"]],
  [111, ["return from gosub", "flow"]],
  [112, ["pop stack", "flow"]],
  [124, ["spawn", "combat"]],
  [126, ["battle combat-round macro", "combat"]],
]);

let macDecoder = null;
try {
  macDecoder = new TextDecoder("macintosh");
} catch {
  macDecoder = new TextDecoder("latin1");
}

function i16(buffer, offset) {
  return buffer.readInt16BE(offset);
}

function i32(buffer, offset) {
  return buffer.readInt32BE(offset);
}

function u8(buffer, offset) {
  return buffer.readUInt8(offset);
}

function signedByte(buffer, offset) {
  return buffer.readInt8(offset);
}

function normalizeOpcode(code) {
  if (code < 0 && code !== -14 && code !== -23) {
    return Math.abs(code);
  }
  return code;
}

function describeOpcode(rawCode) {
  const normalized = normalizeOpcode(rawCode);
  const [label, category] = opcodeInfo.get(normalized) || [`opcode ${normalized}`, "unknown"];
  return { rawCode, code: normalized, label, category, gosub: rawCode < 0 && rawCode !== -14 && rawCode !== -23 };
}

function decodeClassicText(bytes) {
  const nul = bytes.indexOf(0);
  const slice = nul >= 0 ? bytes.subarray(0, nul) : bytes;
  return macDecoder
    .decode(slice)
    .replace(/[\u0000-\u0008\u000B-\u001F]+/g, " ")
    .trim();
}

function decodePascalText(bytes) {
  if (!bytes.length) {
    return "";
  }
  const length = Math.min(bytes[0], bytes.length - 1);
  return decodeClassicText(bytes.subarray(1, 1 + length));
}

function readI16Safe(buffer, offset, fallback = 0) {
  return offset + 2 <= buffer.length ? i16(buffer, offset) : fallback;
}

function readI32Safe(buffer, offset, fallback = 0) {
  return offset + 4 <= buffer.length ? i32(buffer, offset) : fallback;
}

function readU16Safe(buffer, offset, fallback = 0) {
  return offset + 2 <= buffer.length ? buffer.readUInt16BE(offset) : fallback;
}

function readU32Safe(buffer, offset, fallback = 0) {
  return offset + 4 <= buffer.length ? buffer.readUInt32BE(offset) : fallback;
}

function nonzeroCount(values) {
  return values.reduce((sum, value) => sum + (value ? 1 : 0), 0);
}

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function statIfExists(filePath) {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function shaPrefix(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

function decodeDoorCoordinate(doorid) {
  if (!Number.isInteger(doorid) || doorid <= 0) return null;
  const x = doorid % 100;
  const y = Math.floor(doorid / 100);
  if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return null;
  return { x, y };
}

function parseDoor(buffer, source, levelType, levelIndex, recordIndex) {
  const codes = [];
  const ids = [];
  const actions = [];
  for (let slot = 0; slot < 8; slot += 1) {
    const rawCode = i16(buffer, 8 + slot * 2);
    const id = i16(buffer, 24 + slot * 2);
    codes.push(rawCode);
    ids.push(id);
    const opcode = describeOpcode(rawCode);
    if (rawCode !== 0 || id !== 0) {
      actions.push({ slot, id, ...opcode });
    }
  }
  const doorid = i32(buffer, 0);
  const storedX = u8(buffer, 5);
  const storedY = u8(buffer, 6);
  const packedCoordinate = source === MACRO_SOURCE ? null : decodeDoorCoordinate(doorid);
  const door = {
    id: `${source}:${levelIndex ?? "macro"}:${recordIndex}`,
    source,
    levelType,
    levelIndex,
    recordIndex,
    doorid,
    landid: u8(buffer, 4),
    x: packedCoordinate?.x ?? storedX,
    y: packedCoordinate?.y ?? storedY,
    targetLandId: u8(buffer, 4),
    targetX: storedX,
    targetY: storedY,
    storedX,
    storedY,
    percent: u8(buffer, 7),
    codes,
    ids,
    actions,
  };
  door.active = door.doorid !== 0 || door.percent !== 0 || actions.length > 0;
  return door;
}

function parseDoorFile(buffer, source, levelType) {
  const records = [];
  if (!buffer) {
    return records;
  }

  if (source === "Data DD" || source === "Data DDD") {
    const levelBytes = DOOR_BYTES * DOORS_PER_LEVEL;
    const levels = Math.floor(buffer.length / levelBytes);
    for (let levelIndex = 0; levelIndex < levels; levelIndex += 1) {
      const levelStart = levelIndex * levelBytes;
      for (let recordIndex = 0; recordIndex < DOORS_PER_LEVEL; recordIndex += 1) {
        const start = levelStart + recordIndex * DOOR_BYTES;
        records.push(parseDoor(buffer.subarray(start, start + DOOR_BYTES), source, levelType, levelIndex, recordIndex));
      }
    }
    return records;
  }

  const count = Math.floor(buffer.length / DOOR_BYTES);
  for (let recordIndex = 0; recordIndex < count; recordIndex += 1) {
    const start = recordIndex * DOOR_BYTES;
    records.push(parseDoor(buffer.subarray(start, start + DOOR_BYTES), source, "macro", null, recordIndex));
  }
  return records;
}

function parseExtracodes(buffer) {
  const rows = [];
  if (!buffer) {
    return rows;
  }
  const count = Math.floor(buffer.length / EXTRACODE_BYTES);
  for (let index = 0; index < count; index += 1) {
    const start = index * EXTRACODE_BYTES;
    rows.push({
      id: index,
      values: Array.from({ length: 5 }, (_, slot) => i16(buffer, start + slot * 2)),
    });
  }
  return rows;
}

function parseFields(buffer, source, levelType) {
  const levels = [];
  if (!buffer) {
    return levels;
  }
  const count = Math.floor(buffer.length / FIELD_BYTES);
  for (let levelIndex = 0; levelIndex < count; levelIndex += 1) {
    const start = levelIndex * FIELD_BYTES;
    const values = new Array(MAP_SIZE * MAP_SIZE);
    const frequencies = new Map();
    let min = Infinity;
    let max = -Infinity;
    for (let index = 0; index < values.length; index += 1) {
      const value = i16(buffer, start + index * 2);
      values[index] = value;
      min = Math.min(min, value);
      max = Math.max(max, value);
      const base = normalizeTileValue(value);
      frequencies.set(base, (frequencies.get(base) || 0) + 1);
    }
    const topTiles = [...frequencies.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tile, count]) => ({ tile, count }));
    levels.push({
      id: `${levelType}:${levelIndex}`,
      type: levelType,
      source,
      index: levelIndex,
      width: MAP_SIZE,
      height: MAP_SIZE,
      min,
      max,
      topTiles,
      values,
    });
  }
  return levels;
}

function attachKnownLevelNames(levels, scenarioName) {
  const names = knownLevelNames.get(scenarioName.toLowerCase());
  if (!names) {
    return;
  }
  for (const level of levels) {
    const name = names[level.type]?.get(level.index);
    if (!name) continue;
    level.name = name;
    level.nameSource = "Realmz Wiki area page";
  }
}

function parseRandLevels(buffer, source, levelType) {
  const levels = [];
  if (!buffer) {
    return levels;
  }
  const count = Math.floor(buffer.length / RANDLEVEL_BYTES);
  for (let levelIndex = 0; levelIndex < count; levelIndex += 1) {
    const start = levelIndex * RANDLEVEL_BYTES;
    const rects = [];
    for (let rectIndex = 0; rectIndex < 20; rectIndex += 1) {
      const rectStart = start + rectIndex * 8;
      const top = i16(buffer, rectStart);
      const left = i16(buffer, rectStart + 2);
      const bottom = i16(buffer, rectStart + 4);
      const right = i16(buffer, rectStart + 6);
      const percent = i16(buffer, start + 160 + rectIndex * 2);
      const battleLow = i16(buffer, start + 200 + rectIndex * 4);
      const battleHigh = i16(buffer, start + 202 + rectIndex * 4);
      const randDoor = [0, 1, 2].map((slot) => i16(buffer, start + 280 + rectIndex * 6 + slot * 2));
      const randDoorPercent = [0, 1, 2].map((slot) => i16(buffer, start + 400 + rectIndex * 6 + slot * 2));
      const only = Boolean(u8(buffer, start + 523 + rectIndex));
      const option = signedByte(buffer, start + 543 + rectIndex);
      const sound = i16(buffer, start + 563 + rectIndex * 2);
      const text = i16(buffer, start + 603 + rectIndex * 2);
      const active = percent !== 0 || top !== 0 || left !== 0 || bottom !== 0 || right !== 0 || randDoor.some(Boolean);
      if (active) {
        rects.push({
          id: `${levelType}:${levelIndex}:random:${rectIndex}`,
          source,
          levelType,
          levelIndex,
          rectIndex,
          top,
          left,
          bottom,
          right,
          percent,
          battleRange: [battleLow, battleHigh],
          randDoor,
          randDoorPercent,
          only,
          option,
          sound,
          text,
        });
      }
    }
    levels.push({
      id: `${levelType}:${levelIndex}:randlevel`,
      source,
      levelType,
      levelIndex,
      landlook: signedByte(buffer, start + 520),
      isdark: Boolean(u8(buffer, start + 521)),
      uselos: Boolean(u8(buffer, start + 522)),
      rects,
    });
  }
  return levels;
}

function normalizeTileValue(value) {
  let out = value;
  while (out > 999) out -= 1000;
  while (out < -999) out += 1000;
  return out;
}

function encounterRecordCount(size, blockBytes, triggerBytes) {
  const full = Math.floor(size / blockBytes);
  const trailing = size % blockBytes;
  return full + (trailing >= triggerBytes ? 1 : 0);
}

function parseSimpleEncounter(buffer, index, start) {
  const codes = [];
  for (let group = 0; group < 4; group += 1) {
    codes.push(Array.from({ length: 8 }, (_, slot) => signedByte(buffer, start + group * 8 + slot)));
  }
  const ids = [];
  for (let group = 0; group < 4; group += 1) {
    ids.push(Array.from({ length: 8 }, (_, slot) => i16(buffer, start + 32 + group * 16 + slot * 2)));
  }
  const textStart = start + SIMPLE_STRUCT_BYTES;
  return {
    id: index,
    kind: "simple",
    codes,
    ids,
    choiceResult: Array.from({ length: 4 }, (_, slot) => signedByte(buffer, start + 96 + slot)),
    canBackOut: Boolean(u8(buffer, start + 100)),
    maxTimes: signedByte(buffer, start + 101),
    casteSuccess: signedByte(buffer, start + 102),
    prompt: i16(buffer, start + 104),
    text: Array.from({ length: 4 }, (_, slot) => decodeClassicText(buffer.subarray(textStart + slot * 80, textStart + slot * 80 + 80))),
  };
}

function parseComplexEncounter(buffer, index, start) {
  const codes = [];
  for (let group = 0; group < 4; group += 1) {
    codes.push(Array.from({ length: 8 }, (_, slot) => signedByte(buffer, start + group * 8 + slot)));
  }
  const ids = [];
  for (let group = 0; group < 4; group += 1) {
    ids.push(Array.from({ length: 8 }, (_, slot) => i16(buffer, start + 32 + group * 16 + slot * 2)));
  }
  const textStart = start + COMPLEX_STRUCT_BYTES;
  return {
    id: index,
    kind: "complex",
    codes,
    ids,
    choiceResult: signedByte(buffer, start + 96),
    wordResult: signedByte(buffer, start + 97),
    group: Array.from({ length: 8 }, (_, slot) => signedByte(buffer, start + 98 + slot)),
    spellId: Array.from({ length: 10 }, (_, slot) => i16(buffer, start + 106 + slot * 2)),
    spellResult: Array.from({ length: 10 }, (_, slot) => signedByte(buffer, start + 126 + slot)),
    itemId: Array.from({ length: 5 }, (_, slot) => i16(buffer, start + 136 + slot * 2)),
    itemResult: Array.from({ length: 5 }, (_, slot) => signedByte(buffer, start + 146 + slot)),
    canBackOut: Boolean(u8(buffer, start + 151)),
    thief: Boolean(u8(buffer, start + 152)),
    maxTimes: signedByte(buffer, start + 153),
    casteSuccess: signedByte(buffer, start + 154),
    thiefSuccess: signedByte(buffer, start + 155),
    thiefFail: signedByte(buffer, start + 156),
    prompt: i16(buffer, start + 158),
    text: Array.from({ length: 9 }, (_, slot) => decodeClassicText(buffer.subarray(textStart + slot * 40, textStart + slot * 40 + 40))),
  };
}

function parseEncounters(buffer, kind) {
  if (!buffer) {
    return [];
  }
  const blockBytes = kind === "simple" ? SIMPLE_ENCOUNTER_BYTES : COMPLEX_ENCOUNTER_BYTES;
  const structBytes = kind === "simple" ? SIMPLE_STRUCT_BYTES : COMPLEX_STRUCT_BYTES;
  const count = encounterRecordCount(buffer.length, blockBytes, structBytes);
  const records = [];
  for (let index = 0; index < count; index += 1) {
    const start = index * blockBytes;
    if (start + structBytes > buffer.length) {
      continue;
    }
    const padded = Buffer.alloc(blockBytes);
    buffer.copy(padded, 0, start, Math.min(start + blockBytes, buffer.length));
    records.push(kind === "simple" ? parseSimpleEncounter(padded, index, 0) : parseComplexEncounter(padded, index, 0));
  }
  return records;
}

function parseFixedRecords(buffer, recordBytes, kind, status = "indexed", mapper = null) {
  const records = [];
  if (!buffer) {
    return { kind, status: "missing", recordBytes, count: 0, records };
  }
  const count = Math.floor(buffer.length / recordBytes);
  for (let index = 0; index < count; index += 1) {
    const start = index * recordBytes;
    const slice = buffer.subarray(start, start + recordBytes);
    records.push(mapper ? mapper(slice, index) : { id: index });
  }
  return {
    kind,
    status,
    recordBytes,
    count,
    trailingBytes: buffer.length % recordBytes,
    records,
  };
}

function parseBattleRecord(buffer, index) {
  const occupied = [];
  for (let slot = 0; slot < 13 * 13; slot += 1) {
    const value = readI16Safe(buffer, slot * 2);
    if (value) {
      occupied.push(value);
    }
  }
  return {
    id: index,
    dist: buffer.readInt8(338),
    messageBefore: readI16Safe(buffer, 340),
    messageAfter: readI16Safe(buffer, 342),
    battleMacro: readI16Safe(buffer, 344),
    monsterSlots: occupied.length,
    monsters: [...new Set(occupied)].slice(0, 16),
  };
}

function parseMonsterRecord(buffer, index) {
  return {
    id: index,
    hd: u8(buffer, 0),
    bonus: u8(buffer, 1),
    dx: u8(buffer, 2),
    nameStringId: u8(buffer, 3),
    movementMax: u8(buffer, 4),
    ac: signedByte(buffer, 5),
    iconId: readI16Safe(buffer, 98),
    exp: readI16Safe(buffer, 102),
    staminaMax: readI16Safe(buffer, 106),
    todoOnDeath: readI16Safe(buffer, 166),
    maxSpellPoints: readI16Safe(buffer, 168),
    name: decodeClassicText(buffer.subarray(170, 210)),
  };
}

function parseShopRecord(buffer, index) {
  const itemIds = [];
  for (let slot = 0; slot < 1000; slot += 1) {
    const id = readI16Safe(buffer, slot * 2);
    if (id) {
      itemIds.push(id);
    }
  }
  const quantities = Array.from(buffer.subarray(2000, 3000)).filter(Boolean).length;
  return {
    id: index,
    itemCount: itemIds.length,
    quantitySlots: quantities,
    inflation: readI16Safe(buffer, 3000),
    sampleItems: itemIds.slice(0, 18),
  };
}

function parseStringSlot(buffer, index) {
  const text = decodePascalText(buffer);
  return {
    id: index,
    length: Math.min(buffer[0] || 0, 255),
    text,
    preview: text.length > 96 ? `${text.slice(0, 96)}...` : text,
  };
}

function parseResourceFork(buffer) {
  buffer = extractResourceFork(buffer);
  if (!buffer || buffer.length < 32) {
    return [];
  }
  const dataOffset = readU32Safe(buffer, 0);
  const mapOffset = readU32Safe(buffer, 4);
  if (!dataOffset || !mapOffset || mapOffset + 28 > buffer.length) {
    return [];
  }
  const typeListOffset = mapOffset + readU16Safe(buffer, mapOffset + 24);
  const nameListOffset = mapOffset + readU16Safe(buffer, mapOffset + 26);
  if (typeListOffset + 2 > buffer.length) {
    return [];
  }
  const typeCount = readU16Safe(buffer, typeListOffset) + 1;
  const resources = [];

  for (let typeIndex = 0; typeIndex < typeCount; typeIndex += 1) {
    const typeOffset = typeListOffset + 2 + typeIndex * 8;
    if (typeOffset + 8 > buffer.length) continue;
    const type = buffer.toString("ascii", typeOffset, typeOffset + 4);
    const resourceCount = readU16Safe(buffer, typeOffset + 4) + 1;
    const refListOffset = typeListOffset + readU16Safe(buffer, typeOffset + 6);

    for (let refIndex = 0; refIndex < resourceCount; refIndex += 1) {
      const refOffset = refListOffset + refIndex * 12;
      if (refOffset + 12 > buffer.length) continue;
      const id = i16(buffer, refOffset);
      const nameRelativeOffset = i16(buffer, refOffset + 2);
      let name = "";
      if (nameRelativeOffset >= 0) {
        const nameOffset = nameListOffset + nameRelativeOffset;
        if (nameOffset < buffer.length) {
          name = decodeClassicText(buffer.subarray(nameOffset + 1, nameOffset + 1 + buffer[nameOffset]));
        }
      }
      const dataRelativeOffset = (buffer[refOffset + 5] << 16) | (buffer[refOffset + 6] << 8) | buffer[refOffset + 7];
      const lengthOffset = dataOffset + dataRelativeOffset;
      const length = readU32Safe(buffer, lengthOffset);
      if (lengthOffset + 4 + length > buffer.length) continue;
      resources.push({
        type,
        id,
        name,
        data: buffer.subarray(lengthOffset + 4, lengthOffset + 4 + length),
      });
    }
  }

  return resources;
}

function parseStringListResource(buffer) {
  if (!buffer || buffer.length < 2) {
    return [];
  }
  const count = readU16Safe(buffer, 0);
  const strings = [];
  let offset = 2;
  for (let index = 0; index < count && offset < buffer.length; index += 1) {
    const length = buffer[offset];
    offset += 1;
    strings.push(decodeClassicText(buffer.subarray(offset, offset + length)));
    offset += length;
  }
  return strings;
}

function cleanResourceName(name) {
  const trimmed = (name || "").trim();
  return /^-+$/.test(trimmed) ? "" : trimmed;
}

async function scenarioResourcePath(scenarioPath) {
  const name = path.basename(scenarioPath);
  const candidates = [
    path.join(scenarioPath, "Scenario.rsrc"),
    path.join(scenarioPath, "Scenario.rsf"),
    path.join(scenarioPath, `${name}.rsrc`),
    path.join(scenarioPath, `${name}.rsf`),
  ];
  for (const candidate of candidates) {
    if (await statIfExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function parseScenarioResources(scenarioPath) {
  const resourcePath = await scenarioResourcePath(scenarioPath);
  const buffer = resourcePath ? await readFileIfExists(resourcePath) : null;
  if (!buffer) {
    return { resourcePath: null, mapNames: [] };
  }
  const resources = parseResourceFork(buffer);
  const lists = new Map();
  for (const resource of resources) {
    if (resource.type === "STR#" && resource.name === "Map Names" && MAP_NAME_RESOURCE_IDS.includes(resource.id)) {
      lists.set(resource.id, parseStringListResource(resource.data));
    }
  }
  const primary = lists.get(-102) || [];
  const secondary = lists.get(-101) || [];
  const count = Math.max(primary.length, secondary.length);
  const mapNames = Array.from({ length: count }, (_, id) => ({
    id,
    name: cleanResourceName(primary[id]) || cleanResourceName(secondary[id]),
    primaryName: cleanResourceName(primary[id]),
    secondaryName: cleanResourceName(secondary[id]),
  })).filter((entry) => entry.name || entry.primaryName || entry.secondaryName);
  return { resourcePath, mapNames };
}

function parseMapRecord(buffer, index) {
  const rect = [0, 1, 2, 3].map((slot) => readI16Safe(buffer, 76 + slot * 2));
  return {
    id: index,
    startX: readI16Safe(buffer, 60),
    startY: readI16Safe(buffer, 62),
    level: readI16Safe(buffer, 64),
    pictId: readI16Safe(buffer, 66),
    iconSize: readI16Safe(buffer, 68),
    show: readI16Safe(buffer, 70),
    isDungeon: Boolean(readI16Safe(buffer, 72)),
    rect: { top: rect[0], left: rect[1], bottom: rect[2], right: rect[3] },
    note: decodePascalText(buffer.subarray(84, 340)),
  };
}

function attachMapNames(records, resources) {
  const maps = records?.maps?.records || [];
  const mapNames = new Map((resources?.mapNames || []).map((entry) => [entry.id, entry]));
  for (const record of maps) {
    const entry = mapNames.get(record.id);
    if (!entry?.name) continue;
    record.name = entry.name;
    record.primaryName = entry.primaryName;
    record.secondaryName = entry.secondaryName;
    record.nameSource = "Scenario.rsrc STR# Map Names";
  }
}

function mapRecordLevelKey(record) {
  if (!record || !Number.isInteger(record.level) || record.level < 0 || record.level >= 100) {
    return null;
  }
  return `${record.isDungeon ? "dungeon" : "land"}:${record.level}`;
}

function attachLevelNameHints(levels, records) {
  const levelsByKey = new Map(levels.map((level) => [level.id, level]));
  for (const record of records?.maps?.records || []) {
    const name = cleanResourceName(record.name);
    const key = name ? mapRecordLevelKey(record) : null;
    const level = key ? levelsByKey.get(key) : null;
    if (!level) continue;
    if (!level.nameHints) {
      level.nameHints = [];
    }
    if (!level.nameHints.some((hint) => hint.name === name)) {
      level.nameHints.push({
        name,
        source: "Scenario.rsrc STR# Map Names",
        mapRecord: record.id,
        startX: record.startX,
        startY: record.startY,
      });
    }
  }
}

function parseTreasureRecord(buffer, index) {
  const itemIds = Array.from({ length: 20 }, (_, slot) => readI16Safe(buffer, slot * 2)).filter(Boolean);
  return {
    id: index,
    itemCount: itemIds.length,
    sampleItems: itemIds.slice(0, 12),
    exp: readI16Safe(buffer, 40),
    gold: readI16Safe(buffer, 42),
    gems: readI16Safe(buffer, 44),
    jewelry: readI16Safe(buffer, 46),
  };
}

function parseTimeEncounterRecord(buffer, index) {
  return {
    id: index,
    day: readI16Safe(buffer, 0),
    increment: readI16Safe(buffer, 2),
    percent: readI16Safe(buffer, 4),
    door: readI16Safe(buffer, 6),
    level: readI16Safe(buffer, 8),
    rect: readI16Safe(buffer, 10),
    x: readI16Safe(buffer, 12),
    y: readI16Safe(buffer, 14),
    item: readI16Safe(buffer, 16),
    quest: readI16Safe(buffer, 18),
  };
}

function parseThiefRecord(buffer, index) {
  const codesSuccess = Array.from({ length: 8 }, (_, slot) => signedByte(buffer, 18 + slot));
  const codesFail = Array.from({ length: 8 }, (_, slot) => signedByte(buffer, 26 + slot));
  return {
    id: index,
    enabledTypes: Array.from(buffer.subarray(0, 10)).map(Boolean).filter(Boolean).length,
    successCodes: codesSuccess.filter(Boolean),
    failCodes: codesFail.filter(Boolean),
    spell: readI16Safe(buffer, 82),
    lowDamage: readI16Safe(buffer, 84),
    highDamage: readI16Safe(buffer, 86),
    tumblers: readI16Safe(buffer, 88),
  };
}

function parseContactRecord(buffer) {
  if (!buffer) {
    return { kind: "Scenario contact", status: "missing", recordBytes: CONTACT_BYTES, count: 0, records: [] };
  }
  const labels = [
    "scenarioName",
    "version",
    "date",
    "author",
    "email",
    "web",
    "fee",
    "payInfo1",
    "payInfo2",
    "payInfo3",
    "payInfo4",
    "payInfo5",
    "title1",
    "title2",
    "title3",
    "title4",
    "title5",
    "description",
  ];
  const record = {};
  for (const [index, label] of labels.entries()) {
    record[label] = decodePascalText(buffer.subarray(index * STRING_BYTES, index * STRING_BYTES + STRING_BYTES));
  }
  return {
    kind: "Scenario contact",
    status: "decoded",
    recordBytes: CONTACT_BYTES,
    count: 1,
    trailingBytes: Math.max(0, buffer.length - CONTACT_BYTES),
    records: [{ id: 0, ...record }],
  };
}

function buildRecords(buffers) {
  return {
    battles: parseFixedRecords(buffers.dataBD, BATTLE_BYTES, "Battles Data BD", "decoded", parseBattleRecord),
    monsters: parseFixedRecords(buffers.dataMD, MONSTER_BYTES, "Monsters Data MD", "decoded", parseMonsterRecord),
    shops: parseFixedRecords(buffers.dataSD, SHOP_BYTES, "Shops Data SD", "indexed", parseShopRecord),
    strings: parseFixedRecords(buffers.dataSD2, STRING_BYTES, "Strings Data SD2", "decoded", parseStringSlot),
    maps: parseFixedRecords(buffers.dataMD2, MAP_RECORD_BYTES, "Maps Data MD2", "indexed", parseMapRecord),
    treasure: parseFixedRecords(buffers.dataTD, TREASURE_BYTES, "Treasure Data TD", "indexed", parseTreasureRecord),
    thief: parseFixedRecords(buffers.dataTD2, THIEF_BYTES, "Thief encounters Data TD2", "indexed", parseThiefRecord),
    time: parseFixedRecords(buffers.dataTD3, TIME_ENCOUNTER_BYTES, "Time encounters Data TD3", "indexed", parseTimeEncounterRecord),
    contact: parseContactRecord(buffers.dataCI),
    solids: parseFixedRecords(buffers.dataSolids, SOLIDS_BYTES, "Solids Data Solids", "indexed"),
    menu: parseFixedRecords(buffers.dataMENU, MENU_BYTES, "Scenario metadata Data MENU", "indexed"),
  };
}

function classifyAction(door, action, extracodeById) {
  const output = {
    ...action,
    doorId: door.id,
    source: door.source,
    levelType: door.levelType,
    levelIndex: door.levelIndex,
    recordIndex: door.recordIndex,
    x: door.x,
    y: door.y,
    landid: door.landid,
    percent: door.percent,
    links: [],
  };

  if (action.code === 4) {
    output.links.push({ type: "encounter", kind: "simple", id: action.id });
  } else if (action.code === 5) {
    output.links.push({ type: "encounter", kind: "complex", id: action.id });
  } else if (action.code === 7) {
    const extra = extracodeById.get(action.id);
    if (extra) {
      output.extracode = extra.values;
      output.links.push({ type: "extracode", id: action.id });
      if (extra.values[0] === -1) {
        output.links.push({ type: "encounter", kind: "simple", id: extra.values[1], role: "replace result" });
      } else if (extra.values[0] === -2) {
        output.links.push({ type: "encounter", kind: "complex", id: extra.values[1], role: "replace result" });
      } else {
        output.links.push({ type: "macro", id: extra.values[2], role: `action mode ${extra.values[0]}` });
      }
    } else {
      output.missingExtracode = true;
    }
  } else if ([46, 76, 77].includes(action.code)) {
    const extra = extracodeById.get(action.id);
    if (extra) {
      output.extracode = extra.values;
    }
  } else if (action.code === 72) {
    const extra = extracodeById.get(action.id);
    if (extra) {
      output.extracode = extra.values;
    }
  }

  return output;
}

function scriptNodeIdForDoor(door) {
  return door.source === MACRO_SOURCE ? `macro:${door.recordIndex}` : `trigger:${door.levelType}:${door.levelIndex}:${door.recordIndex}`;
}

function encounterNodeId(kind, id) {
  return `encounter:${kind}:${id}`;
}

function targetNodeId(link) {
  if (!link) return null;
  if (link.type === "macro") return `macro:${link.id}`;
  if (link.type === "extracode") return `extracode:${link.id}`;
  if (link.type === "encounter") return encounterNodeId(link.kind, link.id);
  return null;
}

function isDoorEntrance(door) {
  return Boolean(door && door.source !== MACRO_SOURCE && door.targetLandId > 0);
}

function classifyOverlayCategory(actions, door = null) {
  if (isDoorEntrance(door)) return "entrance";
  if (!actions.length) return "unknown";
  if (actions.some((action) => ["quest_read", "quest_write"].includes(action.category))) return "quest";
  if (actions.some((action) => action.links?.some((link) => link.type === "encounter") || [4, 5, 41].includes(action.code))) return "encounter";
  if (actions.some((action) => [2, 48, 56, 107, 124, 126].includes(action.code))) return "battle";
  if (actions.some((action) => [12, 13, 20, 23, -23, 25, 37, 45, 57, 61, 70, 78, 92, 97, 106].includes(action.code))) return "map mutation";
  if (actions.some((action) => [1, 19, 27, 29, 62].includes(action.code) || action.category === "ui_text")) return "text";
  return "unknown";
}

function addBranchTargets(action, output, extra) {
  if (action.code === 39) {
    if (Number.isFinite(action.id) && action.id > 0) {
      output.links.push({ type: "macro", id: action.id, role: "extend door codes" });
    }
    return;
  }
  if (!extra) return;
  const targets = [];
  if ([42, 46, 77, 78].includes(action.code)) {
    targets.push({ type: "macro", id: extra.values[3], role: "false/low branch" });
    targets.push({ type: "macro", id: extra.values[4], role: "true/high branch" });
  } else if ([72, 75].includes(action.code)) {
    const mode = extra.values[3];
    const id = extra.values[4];
    if (mode === 0) targets.push({ type: "macro", id, role: "branch macro" });
    if (mode === 1) targets.push({ type: "encounter", kind: "simple", id, role: "branch encounter" });
    if (mode === 2) targets.push({ type: "encounter", kind: "complex", id, role: "branch encounter" });
  } else if (action.code === 76) {
    const mode = extra.values[2];
    const id = extra.values[4];
    if (mode === 1) targets.push({ type: "macro", id, role: "quest value branch" });
    if (mode === 2) targets.push({ type: "encounter", kind: "simple", id, role: "quest value branch" });
    if (mode === 3) targets.push({ type: "encounter", kind: "complex", id, role: "quest value branch" });
  } else if ([21, 40, 59, 64, 81, 85, 86, 87].includes(action.code)) {
    targets.push({ type: "macro", id: extra.values[3], role: "conditional branch" });
    targets.push({ type: "macro", id: extra.values[4], role: "conditional branch" });
  }
  for (const target of targets) {
    if (Number.isFinite(target.id) && target.id > 0) {
      output.links.push(target);
    }
  }
}

function buildGraph(activeDoors, extracodes, simpleEncounters = [], complexEncounters = []) {
  const extracodeById = new Map(extracodes.map((row) => [row.id, row]));
  const doorByMacroId = new Map(activeDoors.filter((door) => door.source === MACRO_SOURCE).map((door) => [door.recordIndex, door]));
  const simpleById = new Map(simpleEncounters.map((encounter) => [encounter.id, encounter]));
  const complexById = new Map(complexEncounters.map((encounter) => [encounter.id, encounter]));
  const actions = [];
  const questFlags = new Map();
  const nodes = [];
  const edges = [];
  const unresolvedRefs = [];
  const highRiskOpcodes = new Map();
  const nodeIds = new Set();

  function addNode(node) {
    if (nodeIds.has(node.id)) {
      return;
    }
    nodeIds.add(node.id);
    nodes.push(node);
  }

  function addEdge(from, to, kind, meta = {}) {
    const edge = {
      id: `${from}->${to}:${kind}:${edges.length}`,
      from,
      to,
      kind,
      ...meta,
    };
    edges.push(edge);
    return edge;
  }

  function markUnresolved(source, refType, refId, reason, action = null) {
    unresolvedRefs.push({
      source,
      refType,
      refId,
      reason,
      action: action ? { code: action.code, rawCode: action.rawCode, slot: action.slot, id: action.id, label: action.label } : null,
    });
  }

  function markRisk(action) {
    const risky = [4, 5, 7, 23, -23, 39, 41, 46, 48, 54, 56, 72, 76, 77, 78, 85, 86, 87, 107, 124, 126];
    if (!risky.includes(action.code) && !action.gosub) {
      return;
    }
    const key = action.code;
    const entry = highRiskOpcodes.get(key) || { code: key, label: action.label, count: 0, samples: [] };
    entry.count += 1;
    if (entry.samples.length < 8) {
      entry.samples.push({
        source: action.source,
        levelType: action.levelType,
        levelIndex: action.levelIndex,
        recordIndex: action.recordIndex,
        slot: action.slot,
        id: action.id,
      });
    }
    highRiskOpcodes.set(key, entry);
  }

  function touchQuest(index, role, action) {
    if (!Number.isFinite(index) || index < 0 || index > 127) {
      return;
    }
    if (!questFlags.has(index)) {
      questFlags.set(index, { id: index, reads: [], writes: [], locations: [] });
    }
    const flag = questFlags.get(index);
    flag[role].push(action);
    flag.locations.push({
      doorId: action.doorId,
      source: action.source,
      levelType: action.levelType,
      levelIndex: action.levelIndex,
      x: action.x,
      y: action.y,
      code: action.code,
      label: action.label,
    });
  }

  for (const door of activeDoors) {
    const nodeId = scriptNodeIdForDoor(door);
    addNode({
      id: nodeId,
      type: door.source === MACRO_SOURCE ? "macro" : "map trigger",
      label: door.source === MACRO_SOURCE ? `Macro ${door.recordIndex}` : `${door.levelType} ${door.levelIndex} trigger ${door.recordIndex}`,
      source: door.source,
      recordRef: door.id,
      levelType: door.levelType,
      levelIndex: door.levelIndex,
      x: door.x,
      y: door.y,
      actionCount: door.actions.length,
    });

    for (const action of door.actions) {
      const item = classifyAction(door, action, extracodeById);
      const sourceNode = nodeId;
      item.nodeId = sourceNode;
      item.edgeIds = [];
      markRisk(item);
      if (item.gosub) {
        item.links.push({ type: "flow", role: "gosub-style negative opcode" });
        addEdge(sourceNode, sourceNode, "gosub", { slot: item.slot, code: item.rawCode, actionId: item.id });
      }
      if ([24, 75, 81, 86, 87].includes(item.code)) {
        addEdge(sourceNode, sourceNode, "keepcodes", { slot: item.slot, code: item.rawCode, actionId: item.id });
      }
      if ([42, 46, 56, 59, 72, 75, 76, 77, 78, 85].includes(item.code)) {
        addEdge(sourceNode, sourceNode, "forcebranch", { slot: item.slot, code: item.rawCode, actionId: item.id });
      }
      if ([21, 40, 42, 46, 59, 64, 72, 75, 76, 77, 78, 81, 85, 86, 87].includes(item.code)) {
        const extra = extracodeById.get(item.id);
        addBranchTargets(item, item, extra);
      }
      actions.push(item);

      if (item.extracode) {
        addNode({
          id: `extracode:${item.id}`,
          type: "EDCD row",
          label: `EDCD ${item.id}`,
          source: "Data EDCD",
          recordRef: `Data EDCD:${item.id}`,
          values: item.extracode,
        });
      }
      for (const link of item.links) {
        const target = targetNodeId(link);
        if (!target) {
          continue;
        }
        const edge = addEdge(sourceNode, target, link.role || link.type, {
          slot: item.slot,
          code: item.rawCode,
          actionId: item.id,
          category: item.category,
        });
        item.edgeIds.push(edge.id);
        if (link.type === "macro" && !doorByMacroId.has(link.id)) {
          markUnresolved(sourceNode, "macro", link.id, "Macro record is missing or inactive", item);
        } else if (link.type === "extracode" && !extracodeById.has(link.id)) {
          markUnresolved(sourceNode, "extracode", link.id, "EDCD row is missing", item);
        } else if (link.type === "encounter" && link.kind === "simple" && !simpleById.has(link.id)) {
          markUnresolved(sourceNode, "simple encounter", link.id, "Simple encounter record is missing", item);
        } else if (link.type === "encounter" && link.kind === "complex" && !complexById.has(link.id)) {
          markUnresolved(sourceNode, "complex encounter", link.id, "Complex encounter record is missing", item);
        }
      }

      if (item.code === 47) {
        touchQuest(Math.abs(item.id), "writes", item);
      } else if (item.code === 46 && item.extracode) {
        touchQuest(item.extracode[0], "reads", item);
      } else if (item.code === 72 && item.extracode) {
        for (let index = item.extracode[0]; index <= item.extracode[1]; index += 1) {
          touchQuest(index, "reads", item);
        }
      } else if (item.code === 76 && item.extracode) {
        touchQuest(item.extracode[0], "writes", item);
        touchQuest(item.extracode[0], "reads", item);
      } else if (item.code === 77 && item.extracode) {
        touchQuest(item.extracode[0], "reads", item);
      }
    }
  }

  function addEncounterNodes(encounters, kind) {
    for (const encounter of encounters) {
      const nodeId = encounterNodeId(kind, encounter.id);
      addNode({
        id: nodeId,
        type: `${kind} encounter`,
        label: `${kind} encounter ${encounter.id}`,
        source: kind === "simple" ? "Data ED" : "Data ED2",
        recordRef: `${kind}:${encounter.id}`,
        text: encounter.text?.filter(Boolean).slice(0, 4) || [],
      });
      for (let group = 0; group < encounter.codes.length; group += 1) {
        for (let slot = 0; slot < encounter.codes[group].length; slot += 1) {
          const rawCode = encounter.codes[group][slot];
          const id = encounter.ids[group][slot];
          if (rawCode === 0 && id === 0) {
            continue;
          }
          const opcode = describeOpcode(rawCode);
          const action = { ...opcode, id, slot, source: kind === "simple" ? "Data ED" : "Data ED2" };
          if (opcode.code === 4) {
            addEdge(nodeId, encounterNodeId("simple", id), "simple encounter jump", { group, slot, code: rawCode, actionId: id });
            if (!simpleById.has(id)) markUnresolved(nodeId, "simple encounter", id, "Encounter choice target missing", action);
          } else if (opcode.code === 5) {
            addEdge(nodeId, encounterNodeId("complex", id), "complex encounter jump", { group, slot, code: rawCode, actionId: id });
            if (!complexById.has(id)) markUnresolved(nodeId, "complex encounter", id, "Encounter choice target missing", action);
          } else if (opcode.code === 7) {
            addEdge(nodeId, `extracode:${id}`, "opcode 7 action-data link", { group, slot, code: rawCode, actionId: id });
            if (!extracodeById.has(id)) markUnresolved(nodeId, "extracode", id, "Encounter choice EDCD row missing", action);
          } else if (opcode.gosub) {
            addEdge(nodeId, nodeId, "gosub", { group, slot, code: rawCode, actionId: id });
          }
        }
      }
    }
  }

  addEncounterNodes(simpleEncounters, "simple");
  addEncounterNodes(complexEncounters, "complex");

  return {
    actions,
    questFlags: [...questFlags.values()]
      .map((flag) => ({
        ...flag,
        readCount: flag.reads.length,
        writeCount: flag.writes.length,
        locationCount: flag.locations.length,
      }))
      .sort((a, b) => a.id - b.id),
    nodes,
    edges,
    unresolvedRefs,
    highRiskOpcodes: [...highRiskOpcodes.values()].sort((a, b) => Math.abs(a.code) - Math.abs(b.code)),
  };
}

async function fileSummary(scenarioPath, fileName) {
  const filePath = path.join(scenarioPath, fileName);
  const stat = await statIfExists(filePath);
  if (!stat) {
    return { name: fileName, exists: false };
  }
  const buffer = await readFileIfExists(filePath);
  return {
    name: fileName,
    exists: true,
    bytes: stat.size,
    sha256: buffer ? shaPrefix(buffer) : null,
  };
}

function inputCount(buffer, recordBytes, triggerBytes = recordBytes) {
  if (!buffer) {
    return { exists: false };
  }
  const full = Math.floor(buffer.length / recordBytes);
  const trailing = buffer.length % recordBytes;
  return {
    exists: true,
    bytes: buffer.length,
    full,
    trailing,
    loopRecords: full + (trailing >= triggerBytes ? 1 : 0),
  };
}

function clampBounds(bounds) {
  const left = Math.max(0, Math.min(MAP_SIZE, bounds.left));
  const top = Math.max(0, Math.min(MAP_SIZE, bounds.top));
  const right = Math.max(left, Math.min(MAP_SIZE, bounds.right));
  const bottom = Math.max(top, Math.min(MAP_SIZE, bounds.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function buildOverlayBoxes(activeDoors, randLevels, actions) {
  const actionsByDoor = new Map();
  for (const action of actions) {
    if (!actionsByDoor.has(action.doorId)) {
      actionsByDoor.set(action.doorId, []);
    }
    actionsByDoor.get(action.doorId).push(action);
  }
  const boxes = [];
  for (const rand of randLevels) {
    for (const rect of rand.rects) {
      boxes.push({
        id: rect.id,
        levelType: rect.levelType,
        levelIndex: rect.levelIndex,
        bounds: clampBounds({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }),
        category: "random",
        recordRef: rect.id,
        label: `R${rect.rectIndex}`,
        source: rect.source,
      });
    }
  }
  for (const door of activeDoors) {
    if (door.source === MACRO_SOURCE || !Number.isInteger(door.levelIndex)) {
      continue;
    }
    const doorActions = actionsByDoor.get(door.id) || [];
    const classifiedCategory = classifyOverlayCategory(doorActions, door);
    const category = overlayCategories.has(classifiedCategory) ? classifiedCategory : "unknown";
    boxes.push({
      id: `overlay:${door.id}`,
      levelType: door.levelType,
      levelIndex: door.levelIndex,
      bounds: clampBounds({ left: door.x, top: door.y, right: door.x + 1, bottom: door.y + 1 }),
      category,
      recordRef: door.id,
      label: category === "quest" ? "Q" : category === "encounter" ? "E" : category === "battle" ? "B" : category === "entrance" ? "M" : category === "text" ? "T" : "",
      source: door.source,
      actionCount: doorActions.length,
      nodeId: scriptNodeIdForDoor(door),
    });
  }
  return boxes;
}

function buildAssetManifest(scenarioPath, randLevels) {
  const landlooks = [...new Set(randLevels.map((level) => level.landlook).filter((id) => Number.isInteger(id) && id >= 0))]
    .sort((a, b) => a - b);
  return {
    tileAtlases: landlooks.map((landlook) => ({
      landlook,
      sourceResource: `PICT ${300 + landlook}`,
      availability: "fallback",
      available: false,
      url: `/api/asset/tile-atlas?scenarioPath=${encodeURIComponent(scenarioPath)}&landlook=${encodeURIComponent(landlook)}`,
      status: "No exported atlas PNG found yet; map will use decoded colors.",
    })),
  };
}

export async function discoverScenarios(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const scenarios = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const scenarioPath = path.join(root, entry.name);
    const hasScenario = Boolean(await statIfExists(path.join(scenarioPath, "Scenario")));
    const hasLand = Boolean(await statIfExists(path.join(scenarioPath, "Data LD")));
    const hasDungeon = Boolean(await statIfExists(path.join(scenarioPath, "Data DL")));
    if (hasScenario || hasLand || hasDungeon) {
      scenarios.push({ name: entry.name, path: scenarioPath, hasScenario, hasLand, hasDungeon });
    }
  }
  return scenarios.sort((a, b) => a.name.localeCompare(b.name));
}

export async function analyzeScenario(scenarioPath) {
  const resolvedPath = path.resolve(scenarioPath);
  const stat = await fs.stat(resolvedPath);
  if (!stat.isDirectory()) {
    throw new Error(`${resolvedPath} is not a scenario folder`);
  }

  const [
    dataLD,
    dataDL,
    dataDD,
    dataDDD,
    dataRD,
    dataRDD,
    dataED3,
    dataEDCD,
    dataED,
    dataED2,
    dataMD,
    dataBD,
    dataSD,
    dataSD2,
    dataMD2,
    dataTD,
    dataTD2,
    dataTD3,
    dataCI,
    dataMENU,
    dataSolids,
  ] = await Promise.all([
    readFileIfExists(path.join(resolvedPath, "Data LD")),
    readFileIfExists(path.join(resolvedPath, "Data DL")),
    readFileIfExists(path.join(resolvedPath, "Data DD")),
    readFileIfExists(path.join(resolvedPath, "Data DDD")),
    readFileIfExists(path.join(resolvedPath, "Data RD")),
    readFileIfExists(path.join(resolvedPath, "Data RDD")),
    readFileIfExists(path.join(resolvedPath, "Data ED3")),
    readFileIfExists(path.join(resolvedPath, "Data EDCD")),
    readFileIfExists(path.join(resolvedPath, "Data ED")),
    readFileIfExists(path.join(resolvedPath, "Data ED2")),
    readFileIfExists(path.join(resolvedPath, "Data MD")),
    readFileIfExists(path.join(resolvedPath, "Data BD")),
    readFileIfExists(path.join(resolvedPath, "Data SD")),
    readFileIfExists(path.join(resolvedPath, "Data SD2")),
    readFileIfExists(path.join(resolvedPath, "Data MD2")),
    readFileIfExists(path.join(resolvedPath, "Data TD")),
    readFileIfExists(path.join(resolvedPath, "Data TD2")),
    readFileIfExists(path.join(resolvedPath, "Data TD3")),
    readFileIfExists(path.join(resolvedPath, "Data CI")),
    readFileIfExists(path.join(resolvedPath, "Data MENU")),
    readFileIfExists(path.join(resolvedPath, "Data Solids")),
  ]);

  const levels = [
    ...parseFields(dataLD, "Data LD", "land"),
    ...parseFields(dataDL, "Data DL", "dungeon"),
  ];
  attachKnownLevelNames(levels, path.basename(resolvedPath));
  const randLevels = [
    ...parseRandLevels(dataRD, "Data RD", "land"),
    ...parseRandLevels(dataRDD, "Data RDD", "dungeon"),
  ];
  const doors = [
    ...parseDoorFile(dataDD, "Data DD", "land"),
    ...parseDoorFile(dataDDD, "Data DDD", "dungeon"),
    ...parseDoorFile(dataED3, MACRO_SOURCE, "macro"),
  ];
  const activeDoors = doors.filter((door) => door.active);
  const extracodes = parseExtracodes(dataEDCD);
  const simpleEncounters = parseEncounters(dataED, "simple");
  const complexEncounters = parseEncounters(dataED2, "complex");
  const graph = buildGraph(activeDoors, extracodes, simpleEncounters, complexEncounters);
  const overlayBoxes = buildOverlayBoxes(activeDoors, randLevels, graph.actions);
  const records = buildRecords({ dataMD, dataBD, dataSD, dataSD2, dataMD2, dataTD, dataTD2, dataTD3, dataCI, dataMENU, dataSolids });
  const resources = await parseScenarioResources(resolvedPath);
  attachMapNames(records, resources);
  attachLevelNameHints(levels, records);
  const assets = buildAssetManifest(resolvedPath, randLevels);

  const trackedFiles = [
    "Scenario",
    "Global",
    "Data LD",
    "Data DL",
    "Data DD",
    "Data DDD",
    "Data RD",
    "Data RDD",
    "Data ED",
    "Data ED2",
    "Data ED3",
    "Data EDCD",
    "Data MD",
    "Data BD",
    "Data SD",
    "Data SD2",
    "Data MD2",
    "Data TD",
    "Data TD2",
    "Data TD3",
    "Data CI",
    "Data MENU",
    "Data Solids",
  ];

  return {
    scenario: {
      name: path.basename(resolvedPath),
      path: resolvedPath,
      analyzedAt: new Date().toISOString(),
    },
    files: await Promise.all(trackedFiles.map((name) => fileSummary(resolvedPath, name))),
    counts: {
      levels: levels.length,
      landLevels: levels.filter((level) => level.type === "land").length,
      dungeonLevels: levels.filter((level) => level.type === "dungeon").length,
      activeDoors: activeDoors.length,
      doorRecords: doors.length,
      randomRects: randLevels.reduce((sum, level) => sum + level.rects.length, 0),
      extracodes: extracodes.length,
      actions: graph.actions.length,
      questFlags: graph.questFlags.length,
      simpleEncounters: simpleEncounters.length,
      complexEncounters: complexEncounters.length,
      scriptNodes: graph.nodes.length,
      scriptEdges: graph.edges.length,
      overlayBoxes: overlayBoxes.length,
    },
    alignment: {
      landFields: inputCount(dataLD, FIELD_BYTES),
      dungeonFields: inputCount(dataDL, FIELD_BYTES),
      landDoors: inputCount(dataDD, DOOR_BYTES * DOORS_PER_LEVEL),
      dungeonDoors: inputCount(dataDDD, DOOR_BYTES * DOORS_PER_LEVEL),
      landRandom: inputCount(dataRD, RANDLEVEL_BYTES),
      dungeonRandom: inputCount(dataRDD, RANDLEVEL_BYTES),
      simpleEncounters: inputCount(dataED, SIMPLE_ENCOUNTER_BYTES, SIMPLE_STRUCT_BYTES),
      complexEncounters: inputCount(dataED2, COMPLEX_ENCOUNTER_BYTES, COMPLEX_STRUCT_BYTES),
      macros: inputCount(dataED3, DOOR_BYTES),
      extracodes: inputCount(dataEDCD, EXTRACODE_BYTES),
      battles: inputCount(dataBD, BATTLE_BYTES),
      monsters: inputCount(dataMD, MONSTER_BYTES),
      shops: inputCount(dataSD, SHOP_BYTES),
      strings: inputCount(dataSD2, STRING_BYTES),
      maps: inputCount(dataMD2, MAP_RECORD_BYTES),
      treasure: inputCount(dataTD, TREASURE_BYTES),
      thief: inputCount(dataTD2, THIEF_BYTES),
      timeEncounters: inputCount(dataTD3, TIME_ENCOUNTER_BYTES),
      contact: inputCount(dataCI, CONTACT_BYTES),
      menu: inputCount(dataMENU, MENU_BYTES),
      solids: inputCount(dataSolids, SOLIDS_BYTES),
    },
    assets,
    resources,
    levels,
    randLevels,
    doors: activeDoors,
    extracodes,
    graph,
    scriptGraph: {
      nodes: graph.nodes,
      edges: graph.edges,
      unresolvedRefs: graph.unresolvedRefs,
      highRiskOpcodes: graph.highRiskOpcodes,
    },
    records,
    overlayBoxes,
    encounters: {
      simple: simpleEncounters,
      complex: complexEncounters,
    },
  };
}
