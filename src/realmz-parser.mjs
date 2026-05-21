import fs from "node:fs/promises";
import path from "node:path";
import { extractResourceFork } from "./resource-fork.mjs";
import { buildSemanticSchema } from "./semantic-schema.mjs";
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
const DUNGEON_TINY_PICT_ID = 302;

const landlookTilesetClues = new Map([
  [0, { label: "Data P BD", sourceResource: "PICT 300", note: "standard look 0 tile atlas" }],
  [3, { label: "Data SUB BD", sourceResource: "PICT 303", note: "subterranean tile atlas" }],
  [4, { label: "Data Castle BD", sourceResource: "PICT 304", note: "castle/interior tile atlas" }],
  [5, { label: "Data Desert BD", sourceResource: "PICT 305", note: "desert tile atlas" }],
  [6, { label: "Data Custom 1 BD", sourceResource: "PICT 306", note: "scenario custom tile atlas 1" }],
  [7, { label: "Data Custom 2 BD", sourceResource: "PICT 307", note: "scenario custom tile atlas 2" }],
  [8, { label: "Data Custom 3 BD", sourceResource: "PICT 308", note: "scenario custom tile atlas 3" }],
  [9, { label: "Data Swamp BD", sourceResource: "PICT 309", note: "swamp tile atlas" }],
  [10, { label: "Data Snow BD", sourceResource: "PICT 310", note: "snow tile atlas" }],
]);

const overlayCategories = new Set(["quest", "encounter", "random", "entrance", "map mutation", "battle", "text", "unknown"]);

const opcodeInfo = new Map([
  [1, ["text", "ui_text"]],
  [2, ["battle", "combat"]],
  [3, ["choice", "branch"]],
  [4, ["simple encounter", "encounter"]],
  [5, ["complex encounter", "encounter"]],
  [6, ["load shop", "item_shop"]],
  [7, ["action data / X-AP patch", "branch"]],
  [8, ["same as other door", "branch"]],
  [9, ["play sound", "ui_text"]],
  [10, ["give treasure", "item_shop"]],
  [11, ["give experience", "combat"]],
  [12, ["new land icon", "map"]],
  [13, ["enable / disable door", "map"]],
  [14, ["pick characters", "state"]],
  [-14, ["pick inverse characters", "state"]],
  [15, ["damage or heal picked characters", "state"]],
  [16, ["damage or heal party", "state"]],
  [17, ["cast spell on picked characters", "state"]],
  [18, ["cast spell on party", "state"]],
  [19, ["display random string", "ui_text"]],
  [20, ["teleport", "map"]],
  [21, ["branch on item possession", "branch"]],
  [22, ["alter item status", "item_shop"]],
  [23, ["alter land random rect", "map"]],
  [-23, ["alter dungeon random rect", "map"]],
  [24, ["keep codes", "branch"]],
  [25, ["remove door x-y", "map"]],
  [26, ["get click", "ui_text"]],
  [27, ["show picture", "ui_text"]],
  [28, ["center screen", "map"]],
  [29, ["give / display map", "ui_text"]],
  [30, ["pick by ability or attribute check", "branch"]],
  [31, ["branch on ability check", "branch"]],
  [32, ["offer temple", "item_shop"]],
  [33, ["take gold", "item_shop"]],
  [34, ["break encounter loop", "flow"]],
  [35, ["eliminate simple encounter option", "encounter"]],
  [36, ["store / give equipment", "item_shop"]],
  [37, ["dungeon move", "map"]],
  [38, ["branch on possession II", "branch"]],
  [39, ["extend door codes", "branch"]],
  [40, ["branch on party condition", "branch"]],
  [41, ["eliminate simple encounter option", "encounter"]],
  [42, ["branch on percent chance", "branch"]],
  [43, ["give condition", "state"]],
  [44, ["break complex encounter option", "encounter"]],
  [45, ["teleport only", "map"]],
  [46, ["branch on quest flag", "quest_read"]],
  [47, ["set quest flag", "quest_write"]],
  [48, ["selective combat", "combat"]],
  [49, ["bank", "item_shop"]],
  [50, ["pick by race / caste / gender", "branch"]],
  [51, ["alter shop", "item_shop"]],
  [52, ["pick by position / movement / item / percent", "branch"]],
  [53, ["pick on caste", "branch"]],
  [54, ["alter time encounter", "time"]],
  [55, ["branch on picked characters", "branch"]],
  [56, ["branch on battle outcome", "branch"]],
  [57, ["change land look", "map"]],
  [58, ["branch on difficulty level", "branch"]],
  [59, ["branch on tile id", "branch"]],
  [60, ["alter party money", "item_shop"]],
  [61, ["shift party level/x/y", "map"]],
  [62, ["display scrolling text", "ui_text"]],
  [63, ["alter game time", "time"]],
  [64, ["branch on game time", "branch"]],
  [65, ["award random items", "item_shop"]],
  [66, ["disable / enable camping", "time"]],
  [67, ["branch on item charges", "branch"]],
  [68, ["alter party fatigue", "state"]],
  [69, ["set spell casting / charging flags", "state"]],
  [70, ["save / restore party position", "map"]],
  [71, ["disable / enable coordinate display", "ui_text"]],
  [72, ["branch on range of quest flags", "quest_read"]],
  [73, ["load shop and restrict items", "item_shop"]],
  [74, ["take / give spell points", "state"]],
  [75, ["branch on spell points", "branch"]],
  [76, ["increment / decrement quest value", "quest_write"]],
  [77, ["branch on quest value", "quest_read"]],
  [78, ["branch on tile parameters", "branch"]],
  [81, ["branch on PC condition", "branch"]],
  [82, ["turn priest turning off", "state"]],
  [83, ["turn priest turning on", "state"]],
  [84, ["check scenario registration", "registration"]],
  [85, ["branch to random door", "branch"]],
  [86, ["branch on misc", "branch"]],
  [87, ["branch on allies in party", "branch"]],
  [88, ["drop allies from party", "state"]],
  [89, ["add allies to party", "state"]],
  [90, ["take away victory", "state"]],
  [91, ["drop all equipment", "item_shop"]],
  [92, ["alter random rect size", "map"]],
  [93, ["turn compass on", "map"]],
  [94, ["turn compass off", "map"]],
  [95, ["change look direction", "map"]],
  [96, ["require 3D map", "map"]],
  [97, ["allow full map", "map"]],
  [98, ["require registered game", "registration"]],
  [99, ["get scenario registration", "registration"]],
  [100, ["end battle", "combat"]],
  [101, ["back up party", "map"]],
  [102, ["level up picked characters", "combat"]],
  [103, ["test/set boat/camp status", "state"]],
  [104, ["set encounter status", "encounter"]],
  [105, ["activate / disable allies", "state"]],
  [106, ["set darkland status", "map"]],
  [107, ["improved selective battle", "combat"]],
  [108, ["alter selected character", "state"]],
  [111, ["return from gosub", "flow"]],
  [112, ["pop stack", "flow"]],
  [119, ["revive NPC / party after combat", "state"]],
  [120, ["alter NPC or monster during combat", "combat"]],
  [121, ["de-animate lower level undead", "combat"]],
  [122, ["cause fumble", "combat"]],
  [123, ["cause rout", "combat"]],
  [124, ["spawn", "combat"]],
  [125, ["destroy related monsters", "combat"]],
  [126, ["battle combat-round macro", "combat"]],
  [127, ["continue if monster present", "combat"]],
]);

const opcodesLoadingExtracode = new Set([
  2, 3, 7, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, -23, 30, 31, 33, 37, 38, 40,
  41, 42, 43, 45, 46, 48, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 63, 64,
  65, 67, 68, 69, 70, 72, 73, 74, 75, 76, 77, 78, 81, 85, 86, 87, 90, 92, 103,
  106, 107, 108, 120, 121, 122, 123, 124, 125, 126,
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
  const level = Math.floor(doorid / 10000);
  const position = doorid % 10000;
  const x = position % 100;
  const y = Math.floor(position / 100);
  if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return null;
  return { level, x, y };
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
    if (rawCode !== 0 || id !== 0) {
      const opcode = rawCode === 0
        ? {
            rawCode,
            code: 0,
            label: "padding / inactive action id",
            category: "format_gap",
            gosub: false,
            formatGapReason: "A zero opcode with a leftover id is preserved as authored bytes, but is not a known executable newland action.",
          }
        : describeOpcode(rawCode);
      actions.push({ slot, id, ...opcode });
    }
  }
  const doorid = i32(buffer, 0);
  const storedX = u8(buffer, 5);
  const storedY = u8(buffer, 6);
  const packedCoordinate = source === MACRO_SOURCE ? null : decodeDoorCoordinate(doorid);
  const coordinateMatchesLevel = packedCoordinate && (levelIndex == null || packedCoordinate.level === levelIndex);
  const door = {
    id: `${source}:${levelIndex ?? "macro"}:${recordIndex}`,
    source,
    levelType,
    levelIndex,
    recordIndex,
    doorid,
    landid: u8(buffer, 4),
    x: coordinateMatchesLevel ? packedCoordinate.x : null,
    y: coordinateMatchesLevel ? packedCoordinate.y : null,
    packedLevelIndex: packedCoordinate?.level ?? null,
    hasMapCoordinate: Boolean(coordinateMatchesLevel),
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
  door.active = source === MACRO_SOURCE
    ? actions.length > 0
    : Boolean(door.hasMapCoordinate && (door.percent !== 0 || actions.length > 0 || door.doorid !== 0));
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
      let nameOffset = null;
      if (nameRelativeOffset >= 0) {
        nameOffset = nameListOffset + nameRelativeOffset;
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
        attributes: buffer[refOffset + 4],
        offset: lengthOffset + 4,
        length,
        refOffset,
        nameOffset,
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

function buildResourceCatalog(resources) {
  const byType = new Map();
  for (const resource of resources) {
    const entry = byType.get(resource.type) || {
      type: resource.type,
      count: 0,
      totalBytes: 0,
      minId: resource.id,
      maxId: resource.id,
      named: 0,
      ids: [],
      names: [],
    };
    entry.count += 1;
    entry.totalBytes += resource.data?.length || 0;
    entry.minId = Math.min(entry.minId, resource.id);
    entry.maxId = Math.max(entry.maxId, resource.id);
    if (resource.name) {
      entry.named += 1;
      if (entry.names.length < 8) {
        entry.names.push({ id: resource.id, name: resource.name });
      }
    }
    if (entry.ids.length < 24) {
      entry.ids.push(resource.id);
    }
    byType.set(resource.type, entry);
  }

  return {
    typeCount: byType.size,
    resourceCount: resources.length,
    types: [...byType.values()].sort((a, b) => a.type.localeCompare(b.type)),
  };
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
    return { resourcePath: null, mapNames: [], resources: [], catalog: buildResourceCatalog([]) };
  }
  const resources = parseResourceFork(buffer);
  const resourceRecords = resources
    .map((resource) => ({
      type: resource.type,
      id: resource.id,
      name: cleanResourceName(resource.name),
      bytes: resource.length ?? resource.data?.length ?? 0,
      attributes: resource.attributes,
      offset: resource.offset,
      refOffset: resource.refOffset,
      nameOffset: resource.nameOffset,
      sha256: resource.data ? shaPrefix(resource.data) : null,
    }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.id - b.id);
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
  return { resourcePath, mapNames, resources: resourceRecords, catalog: buildResourceCatalog(resources) };
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

function positiveRef(id) {
  return Number.isFinite(id) && id > 0;
}

function linkableRef(link) {
  if (!Number.isFinite(link?.id)) return false;
  if (["extracode", "encounter", "battle", "monster", "shop", "treasure", "time", "map", "level", "resource", "quest"].includes(link.type)) {
    return link.id >= 0;
  }
  return link.id > 0;
}

function addLink(output, link) {
  if (!link) return;
  if (link.type !== "flow" && !linkableRef(link)) return;
  output.links.push(link);
}

function addMessageLink(output, id, role = "shows message") {
  addLink(output, { type: "text", id, role });
}

function addBattleLinks(output, low, high = 0, role = "starts battle") {
  if (positiveRef(Math.abs(low))) addLink(output, { type: "battle", id: Math.abs(low), role });
  if (high && Math.abs(high) !== Math.abs(low)) {
    addLink(output, { type: "battle", id: Math.abs(high), role: `${role} range end` });
  }
}

function addBranchTarget(output, mode, id, role = "branch target", slot = null) {
  if (mode === -1) {
    addLink(output, { type: "flow", role: `${role}: drop out` });
    return;
  }
  if (mode === 3) {
    addLink(output, { type: "flow", role: `${role}: keep codes` });
    return;
  }
  if (!positiveRef(id)) return;
  if (mode === 0) addLink(output, { type: "macro", id, role, slot });
  if (mode === 1) addLink(output, { type: "encounter", kind: "simple", id, role, slot });
  if (mode === 2) addLink(output, { type: "encounter", kind: "complex", id, role, slot });
}

function addChoiceBranchTarget(output, mode, id, role = "choice branch") {
  if (!positiveRef(id)) return;
  if (mode === 1) addLink(output, { type: "macro", id, role });
  if (mode === 2) addLink(output, { type: "encounter", kind: "simple", id, role });
  if (mode === 3) addLink(output, { type: "encounter", kind: "complex", id, role });
}

function addBranchPair(output, mode, falseId, trueId, rolePrefix = "conditional") {
  addBranchTarget(output, mode, falseId, `${rolePrefix} false branch`);
  addBranchTarget(output, mode, trueId, `${rolePrefix} true branch`);
}

function field(slot, label, value) {
  return { slot, label, value };
}

function rangeText(low, high, noun) {
  if (!high || high === low) return `${noun} ${low}`;
  return `${noun}s ${low}-${high}`;
}

function describeExtracodeUsage(action, values, output) {
  const usage = {
    source: "newland.c",
    confidence: "source-backed",
    summary: "Uses EDCD action parameters.",
    fields: values.map((value, slot) => field(slot, `extracode[${slot}]`, value)),
  };

  switch (action.code) {
    case 2:
      usage.summary = `Starts ${rangeText(Math.abs(values[0]), Math.abs(values[1]), "battle")}.`;
      usage.fields = [
        field(0, "battle id or range start", values[0]),
        field(1, "battle range end", values[1]),
        field(2, "sound id / revive branch macro", values[2]),
        field(3, "pre-battle message id", values[3]),
        field(4, "booty mode", values[4]),
      ];
      addBattleLinks(output, values[0], values[1]);
      addMessageLink(output, values[3], "pre-battle message");
      break;
    case 3:
      usage.summary = `Asks a two-message choice and may branch to record ${values[2]}.`;
      usage.fields = [
        field(0, "reply polarity", values[0]),
        field(1, "branch mode: 1 macro, 2 simple, 3 complex", values[1]),
        field(2, "branch target", values[2]),
        field(3, "choice message A", values[3]),
        field(4, "choice message B", values[4]),
      ];
      addChoiceBranchTarget(output, values[1], values[2], "choice result");
      addMessageLink(output, values[3], "choice prompt");
      addMessageLink(output, values[4], "choice prompt");
      break;
    case 7:
      usage.fields = [
        field(0, "mode / target level", values[0]),
        field(1, "target door or encounter record", values[1]),
        field(2, "macro/action source", values[2]),
        field(3, "level kind override", values[3]),
        field(4, "encounter result slot", values[4]),
      ];
      if (values[0] === -1) {
        usage.summary = `Replaces simple encounter ${values[1]} result slot ${values[4]} with macro ${values[2]}.`;
        addLink(output, { type: "encounter", kind: "simple", id: values[1], role: "replace result" });
        addLink(output, { type: "macro", id: values[2], role: "replacement action source" });
      } else if (values[0] === -2) {
        usage.summary = `Replaces complex encounter ${values[1]} result slot ${values[4]} with macro ${values[2]}.`;
        addLink(output, { type: "encounter", kind: "complex", id: values[1], role: "replace result" });
        addLink(output, { type: "macro", id: values[2], role: "replacement action source" });
      } else {
        usage.summary = `Copies macro ${values[2]} into door ${values[1]} on level ${values[0]}.`;
        addLink(output, { type: "macro", id: values[2], role: `copy into door ${values[1]}` });
      }
      break;
    case 12:
      usage.summary = `Writes tile ${values[3]} on ${values[4] ? "dungeon" : "land"} level ${values[0]} at x ${values[1]}, y ${values[2]}.`;
      usage.fields = [
        field(0, "target level", values[0]),
        field(1, "target land x / dungeon y", values[1]),
        field(2, "target land y / dungeon x", values[2]),
        field(3, "new field tile value", values[3]),
        field(4, "dungeon flag", values[4]),
      ];
      addLink(output, { type: "level", levelType: values[4] ? "dungeon" : "land", id: values[0], role: "mutates tile on level" });
      break;
    case 13:
      usage.summary = `Sets trigger percent ${values[2]} on level ${values[0]}.`;
      usage.fields = [
        field(0, "target level", values[0]),
        field(1, "single trigger index", values[1]),
        field(2, "new trigger percent", values[2]),
        field(3, "range start; negative dungeon, positive land", values[3]),
        field(4, "range end", values[4]),
      ];
      addLink(output, { type: "level", levelType: values[3] < 0 ? "dungeon" : "land", id: values[0], role: "mutates trigger percent on level" });
      break;
    case 15:
    case 16:
      usage.summary = `${action.code === 15 ? "Damages or heals picked characters" : "Damages or heals the party"} by multiplier ${values[0]} times ${values[1]}-${values[2]}.`;
      usage.fields = [
        field(0, "heal/damage multiplier", values[0]),
        field(1, "random amount low", values[1]),
        field(2, "random amount high", values[2]),
        field(3, "sound id", values[3]),
        field(4, "message id", values[4]),
      ];
      addMessageLink(output, values[4], "damage/heal message");
      break;
    case 17:
    case 18:
      usage.summary = `${action.code === 17 ? "Casts a spell on picked characters" : "Casts a spell on the party"} using spell ${values[0]}.`;
      usage.fields = [
        field(0, "spell id", values[0]),
        field(1, "power level", values[1]),
        field(2, "save adjustment", values[2]),
        field(3, "force affect flag", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 19:
      usage.summary = `Shows a random message from ${values[0]}-${values[1]}.`;
      usage.fields = [field(0, "message range start", values[0]), field(1, "message range end", values[1])];
      addMessageLink(output, values[0], "random message range start");
      addMessageLink(output, values[1], "random message range end");
      break;
    case 20:
    case 45:
      usage.summary = `Moves the party to level ${values[0]}, x ${values[1]}, y ${values[2]}.`;
      usage.fields = [
        field(0, "target level", values[0]),
        field(1, "target x", values[1]),
        field(2, "target y", values[2]),
        field(3, "sound id", values[3]),
        field(4, "arrival message id", values[4]),
      ];
      addLink(output, { type: "level", levelType: action.levelType, id: values[0], role: "teleport target level" });
      addMessageLink(output, values[4], "arrival message");
      break;
    case 21:
      usage.summary = `Branches on possession of item ${values[0]}.`;
      usage.fields = [
        field(0, "item id", values[0]),
        field(1, "branch mode: 0 macro, 1 simple, 2 complex", values[1]),
        field(2, "missing-item behavior", values[2]),
        field(3, "has-item target", values[3]),
        field(4, "missing-item target or message", values[4]),
      ];
      addBranchPair(output, values[1], values[4], values[3], "item possession");
      if (values[2] === 2) addMessageLink(output, values[4], "missing-item message");
      break;
    case 22:
      usage.summary = `Alters up to ${values[1]} copies of item ${values[0]}.`;
      usage.fields = [
        field(0, "item id to find", values[0]),
        field(1, "maximum matching items", values[1]),
        field(2, "mode: 1 drop, 2 alter charges, 3 replace item", values[2]),
        field(3, "charge delta", values[3]),
        field(4, "replacement item id", values[4]),
      ];
      break;
    case 23:
    case -23:
      usage.summary = `Sets random region ${values[1]} percent and battle range on ${action.code < 0 ? "dungeon" : "land"} level ${values[0]}.`;
      usage.fields = [
        field(0, "target level", values[0]),
        field(1, "random region index", values[1]),
        field(2, "new percent", values[2]),
        field(3, "battle range low; -1 keeps existing", values[3]),
        field(4, "battle range high; -1 keeps existing", values[4]),
      ];
      addLink(output, { type: "level", levelType: action.code < 0 ? "dungeon" : "land", id: values[0], role: "mutates random region" });
      addBattleLinks(output, values[3], values[4], "random region battle range");
      break;
    case 30:
      usage.summary = `Selects picked characters by ${values[3] ? "attribute" : "special ability"} check ${values[0]}.`;
      usage.fields = [
        field(0, "ability/attribute id; negative reverses result", values[0]),
        field(1, "difficulty adjustment", values[1]),
        field(2, "source set: 0 current picked, 1 all, 2 living", values[2]),
        field(3, "attribute-check flag; 0 means special ability", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 31:
      usage.summary = `Branches on a picked character ${values[2] ? "attribute" : "special ability"} check.`;
      usage.fields = [
        field(0, "ability/attribute id", values[0]),
        field(1, "difficulty adjustment", values[1]),
        field(2, "attribute-check flag; 0 means special ability", values[2]),
        field(3, "success macro", values[3]),
        field(4, "failure macro", values[4]),
      ];
      addLink(output, { type: "macro", id: values[3], role: "ability check success branch" });
      addLink(output, { type: "macro", id: values[4], role: "ability check failure branch" });
      break;
    case 33:
      usage.summary = `${values[0] > 0 ? "Takes" : "Checks"} ${Math.abs(values[0])} gold, then branches through the shared branch path.`;
      usage.fields = [
        field(0, "gold amount; negative means check-only", values[0]),
        field(1, "failure branch mode marker", values[1]),
        field(2, "unused / legacy", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 37:
      usage.summary = `Moves inside a dungeon by mode ${values[0]}.`;
      usage.fields = [
        field(0, "dungeon movement mode", values[0]),
        field(1, "x / direction parameter", values[1]),
        field(2, "y / direction parameter", values[2]),
        field(3, "sound id", values[3]),
        field(4, "message id", values[4]),
      ];
      addMessageLink(output, values[4], "dungeon move message");
      break;
    case 38:
    case 46:
    case 58:
    case 59:
      usage.summary = `${action.label} using force-branch mode ${values[2]}.`;
      usage.fields = [
        field(0, "test value", values[0]),
        field(1, "test mode", values[1]),
        field(2, "branch mode: -1 drop, 0 macro, 1 simple, 2 complex, 3 keep", values[2]),
        field(3, "branch target", values[3]),
        field(4, "result slot / extra target", values[4]),
      ];
      addBranchTarget(output, values[2], values[3], action.label, values[4]);
      break;
    case 40:
      usage.summary = `Branches on party condition ${values[3]} to target ${values[2]}.`;
      usage.fields = [
        field(0, "condition threshold", values[0]),
        field(1, "branch mode: 1 macro, 2 simple, 3 complex", values[1]),
        field(2, "branch target", values[2]),
        field(3, "party condition index", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      addChoiceBranchTarget(output, values[1], values[2], "party condition branch");
      break;
    case 42:
      usage.summary = `Branches on ${values[0]}% chance.`;
      usage.fields = [
        field(0, "percent chance", values[0]),
        field(1, "on-success behavior", values[1]),
        field(2, "branch mode", values[2]),
        field(3, "branch target", values[3]),
        field(4, "result slot", values[4]),
      ];
      addBranchTarget(output, values[2], values[3], "percent chance branch", values[4]);
      break;
    case 41:
      usage.summary = `Eliminates choice slot ${values[1]} from simple encounter ${values[0]}.`;
      usage.fields = [
        field(0, "simple encounter id", values[0]),
        field(1, "one-based choice/result slot", values[1]),
        field(2, "unused / legacy", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      addLink(output, { type: "encounter", kind: "simple", id: values[0], role: "mutates encounter option" });
      break;
    case 43:
      usage.summary = `Applies condition ${values[1]} to ${values[0] === 1 ? "picked characters" : values[0] === 2 ? "living characters" : "the party"}.`;
      usage.fields = [
        field(0, "target scope: 0 party, 1 picked, 2 alive", values[0]),
        field(1, "condition index", values[1]),
        field(2, "condition duration/value delta", values[2]),
        field(3, "sound id", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 48:
    case 56:
    case 107:
      usage.summary = `Starts ${rangeText(values[0], values[1], "battle")} and may branch to macro ${values[2] || values[4]}.`;
      usage.fields = [
        field(0, "battle id or range start", values[0]),
        field(1, "battle range end", values[1]),
        field(2, action.code === 56 ? "coward branch macro" : "sound id", values[2]),
        field(3, "message id", values[3]),
        field(4, action.code === 107 ? "battle outcome branch macro" : "treasure / message / branch value", values[4]),
      ];
      addBattleLinks(output, values[0], values[1], action.code === 56 ? "battle outcome check" : "selective battle");
      addMessageLink(output, values[3], "battle message");
      if (action.code === 56) addLink(output, { type: "macro", id: values[2], role: "coward branch" });
      if (action.code === 107) addLink(output, { type: "macro", id: values[4], role: "battle outcome branch" });
      if (action.code === 48 && positiveRef(values[4])) addLink(output, { type: "treasure", id: values[4], role: "selective battle treasure" });
      break;
    case 50:
      usage.summary = `Selects characters by race, gender, caste, or class selector ${values[0]}.`;
      usage.fields = [
        field(0, "selector: 0 race, 1 gender, 2 caste, 3 race class, 4 caste class", values[0]),
        field(1, "gender value", values[1]),
        field(2, "race/caste/class value", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "living-only flag", values[4]),
      ];
      break;
    case 52:
      usage.summary = `Selects characters by ${values[0]} using comparison value ${values[1]}.`;
      usage.fields = [
        field(0, "selector: 0 move, 1 position, 2 item, 3 percent, 4 attribute save, 5 spell save, 6 selected PC, 7 worn item, 8 exact position", values[0]),
        field(1, "selector value", values[1]),
        field(2, "source set: 0 all, 1 living, 2 current picked", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 53:
      usage.summary = `Selects characters by exact caste ${values[0]} or caste group ${values[1]}.`;
      usage.fields = [
        field(0, "exact caste id", values[0]),
        field(1, "caste group: 1 fighter, 2 magical, 3 thief/monk", values[1]),
        field(2, "source set: 0 all, 1 living, 2 current picked", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 51:
      usage.summary = `Changes shop ${values[0]}.`;
      usage.fields = [
        field(0, "shop id", values[0]),
        field(1, "inflation delta", values[1]),
        field(2, "item id", values[2]),
        field(3, "quantity delta", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      addLink(output, { type: "shop", id: values[0], role: "mutates shop" });
      break;
    case 54:
      usage.summary = `Changes timed encounter ${values[0]}.`;
      usage.fields = [
        field(0, "timed encounter id", values[0]),
        field(1, "percent", values[1]),
        field(2, "increment", values[2]),
        field(3, "sound id", values[3]),
        field(4, "day offset", values[4]),
      ];
      addLink(output, { type: "time", id: values[0], role: "mutates timed encounter" });
      break;
    case 55:
      usage.summary = `Branches based on picked-character state.`;
      usage.fields = [
        field(0, "picked-count / picked selector", values[0]),
        field(1, "false behavior", values[1]),
        field(2, "unused / legacy", values[2]),
        field(3, "true macro target", values[3]),
        field(4, "false macro or message", values[4]),
      ];
      addLink(output, { type: "macro", id: values[3], role: "picked true branch" });
      if (values[1] === 1) addLink(output, { type: "macro", id: values[4], role: "picked false branch" });
      if (values[1] === 2) addMessageLink(output, values[4], "picked false message");
      break;
    case 57:
      usage.summary = `Changes land level ${values[2]} to landlook ${values[0]} with dark flag ${values[1]}.`;
      usage.fields = [
        field(0, "new landlook", values[0]),
        field(1, "new darkness flag", values[1]),
        field(2, "target land level", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      addLink(output, { type: "level", levelType: "land", id: values[2], role: "mutates landlook" });
      break;
    case 60:
      usage.summary = `Clears party money type ${values[0]} for ${values[1] ? "picked characters" : "all characters"}.`;
      usage.fields = [
        field(0, "money type: 1 gold, 2 gems, 3 jewelry", values[0]),
        field(1, "picked-only flag", values[1]),
        field(2, "unused / legacy", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 67:
      usage.summary = `Branches on item ${values[0]} having at least ${values[2]} charges.`;
      usage.fields = [
        field(0, "item id", values[0]),
        field(1, "branch mode: 0 macro, 1 simple, 2 complex", values[1]),
        field(2, "minimum charges", values[2]),
        field(3, "enough-charges target", values[3]),
        field(4, "not-enough-charges target", values[4]),
      ];
      addBranchPair(output, values[1], values[4], values[3], "item charges");
      break;
    case 68:
      usage.summary = `Alters party fatigue using mode ${values[0]}.`;
      usage.fields = [
        field(0, "mode: 1 set exhausted, 2 set rested, 3 scale by percent", values[0]),
        field(1, "unused / legacy", values[1]),
        field(2, "percent for scale mode", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 69:
      usage.summary = `Sets combat spell casting and charging flags.`;
      usage.fields = [
        field(0, "spellcasting flag", values[0]),
        field(1, "monstercasting flag", values[1]),
        field(2, "spellcharging flag", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 70:
      usage.summary = `${values[0] === 2 ? "Restores" : "Saves"} the party position.`;
      usage.fields = [
        field(0, "mode: 1 save position, 2 restore position", values[0]),
        field(1, "unused / legacy", values[1]),
        field(2, "unused / legacy", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 61:
      usage.summary = `Shifts party position by x ${values[1]}, y ${values[2]}${values[3] ? " using random +/- offsets" : ""}.`;
      usage.fields = [
        field(0, "legacy target level / unused in source path", values[0]),
        field(1, "x shift or max random x shift", values[1]),
        field(2, "y shift or max random y shift", values[2]),
        field(3, "randomize sign and amount flag", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 63:
      usage.summary = `${values[0] === 1 ? "Sets" : values[0] === 2 ? "Offsets" : "Alters"} game time.`;
      usage.fields = [
        field(0, "mode: 1 set clock, 2 offset clock", values[0]),
        field(1, "day value or day delta", values[1]),
        field(2, "hour value or hour delta", values[2]),
        field(3, "minute value or minute delta", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 64:
      usage.summary = `Branches on game time.`;
      usage.fields = [
        field(0, "latest day / -1 any", values[0]),
        field(1, "latest hour / -1 any", values[1]),
        field(2, "unused / legacy", values[2]),
        field(3, "in-range macro", values[3]),
        field(4, "out-of-range macro", values[4]),
      ];
      addLink(output, { type: "macro", id: values[3], role: "time in range branch" });
      addLink(output, { type: "macro", id: values[4], role: "time out of range branch" });
      break;
    case 65:
      usage.summary = `Awards ${values[0] < 0 ? "a random count of" : values[0]} random items from ${values[1]}-${values[2]}.`;
      usage.fields = [
        field(0, "item count; negative means random 0..abs(count)", values[0]),
        field(1, "random item range low", values[1]),
        field(2, "random item range high", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 72:
    case 75:
      usage.summary = `Branches to ${values[4]} using mode ${values[3]}.`;
      usage.fields = [
        field(0, action.code === 72 ? "quest range start" : "spell point test scope", values[0]),
        field(1, action.code === 72 ? "quest range end" : "spell point threshold", values[1]),
        field(2, "keep-codes false behavior", values[2]),
        field(3, "branch mode: 0 macro, 1 simple, 2 complex", values[3]),
        field(4, "branch target", values[4]),
      ];
      addBranchTarget(output, values[3], values[4], action.label);
      break;
    case 74:
      usage.summary = `${values[0] < 0 ? "Takes" : "Gives"} spell points to picked characters using ${Math.abs(values[0])} roll(s) of ${values[1]}-${values[2]}.`;
      usage.fields = [
        field(0, "roll count; negative subtracts spell points", values[0]),
        field(1, "random spell-point low / source sound id in game path", values[1]),
        field(2, "random spell-point high", values[2]),
        field(3, "play-sound flag", values[3]),
        field(4, "message id", values[4]),
      ];
      addMessageLink(output, values[4], "spell point change message");
      break;
    case 73:
      usage.summary = `Opens shop ${Math.abs(values[0])} with item restrictions.`;
      usage.fields = [
        field(0, "shop id", values[0]),
        field(1, "accepted item range 1 low", values[1]),
        field(2, "accepted item range 1 high", values[2]),
        field(3, "accepted item range 2 low", values[3]),
        field(4, "accepted item range 2 high", values[4]),
      ];
      addLink(output, { type: "shop", id: Math.abs(values[0]), role: "opens restricted shop" });
      break;
    case 76:
      usage.summary = `Changes quest value ${values[0]} by ${values[1]}.`;
      usage.fields = [
        field(0, "quest index", values[0]),
        field(1, "quest value delta", values[1]),
        field(2, "branch mode: 1 macro, 2 simple, 3 complex", values[2]),
        field(3, "branch threshold", values[3]),
        field(4, "branch target", values[4]),
      ];
      addChoiceBranchTarget(output, values[2], values[4], "quest value threshold branch");
      break;
    case 77:
    case 78:
      usage.summary = `${action.label}; false target ${values[3]}, true target ${values[4]}.`;
      usage.fields = [
        field(0, action.code === 77 ? "quest index" : "tile parameter", values[0]),
        field(1, action.code === 77 ? "quest threshold" : "tile comparison value", values[1]),
        field(2, "branch mode: 0 macro, 1 simple, 2 complex", values[2]),
        field(3, "false/low target", values[3]),
        field(4, "true/high target", values[4]),
      ];
      addBranchPair(output, values[2], values[3], values[4], action.label);
      break;
    case 81:
      usage.summary = `Branches on condition ${values[0]}.`;
      usage.fields = [
        field(0, "condition id", values[0]),
        field(1, "character selector", values[1]),
        field(2, "unused / legacy", values[2]),
        field(3, "has-condition macro", values[3]),
        field(4, "missing-condition macro", values[4]),
      ];
      addLink(output, { type: "macro", id: values[3], role: "has condition branch" });
      addLink(output, { type: "macro", id: values[4], role: "missing condition branch" });
      break;
    case 85:
      usage.summary = `Branches to a random ${values[0] === 1 ? "simple encounter" : values[0] === 2 ? "complex encounter" : "macro"} from ${values[1]}-${values[2]}.`;
      usage.fields = [
        field(0, "branch mode: 0 macro, 1 simple, 2 complex", values[0]),
        field(1, "range start", values[1]),
        field(2, "range end", values[2]),
        field(3, "sound id", values[3]),
        field(4, "message id", values[4]),
      ];
      addBranchTarget(output, values[0], values[1], "random branch range start");
      addBranchTarget(output, values[0], values[2], "random branch range end");
      addMessageLink(output, values[4], "random branch message");
      break;
    case 86:
    case 87:
      usage.summary = `${action.label}; true target ${values[3]}, false target ${values[4]}.`;
      usage.fields = [
        field(0, "test selector", values[0]),
        field(1, "branch mode / test value", values[1]),
        field(2, "false behavior", values[2]),
        field(3, "true target", values[3]),
        field(4, "false target or message", values[4]),
      ];
      addBranchPair(output, values[1], values[4], values[3], action.label);
      if (action.code === 87 && values[2] === 2) addMessageLink(output, values[4], "allies missing message");
      break;
    case 90:
      usage.summary = `Removes ${values[0]} victory/experience from ${values[1] === 1 ? "picked characters" : values[1] === 2 ? "the party split evenly" : "each party member"}.`;
      usage.fields = [
        field(0, "experience/victory amount", values[0]),
        field(1, "scope: 1 picked, 2 spread around, other each", values[1]),
        field(2, "unused / legacy", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 92:
      usage.summary = `Changes random rectangle ${values[1]} on level ${values[0]}.`;
      usage.fields = [
        field(0, "target level", values[0]),
        field(1, "random rectangle index", values[1]),
        field(2, "dungeon flag", values[2]),
        field(3, "percent delta", values[3]),
        field(4, "shape update mode using next EDCD row", values[4]),
      ];
      break;
    case 103:
      usage.summary = `Tests or sets boat/camp status with mode ${values[0]}.`;
      usage.fields = [
        field(0, "boat/camp mode", values[0]),
        field(1, "status value", values[1]),
        field(2, "branch mode / behavior", values[2]),
        field(3, "branch target or extra value", values[3]),
        field(4, "branch target or extra value", values[4]),
      ];
      break;
    case 106:
      usage.summary = `Sets level darkness to ${values[0] - 1}.`;
      usage.fields = [
        field(0, "darkland status + 1", values[0]),
        field(1, "only if current status + 1 matches", values[1]),
        field(2, "unused / legacy", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 108:
      usage.summary = `Alters selected-character stat ${values[0]} by ${values[1]}.`;
      usage.fields = [
        field(0, "stat selector: attacks, spells, movement, damage, SP, hand-to-hand, stamina, AR, to-hit, missile, magic resistance, prestige", values[0]),
        field(1, "stat delta", values[1]),
        field(2, "unused / legacy", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      break;
    case 120:
      usage.summary = `Alters up to ${values[2]} combat monster/NPC instance(s) matching monster ${values[1]}.`;
      usage.fields = [
        field(0, "target class: 1 summoned/NPC-like, 2 normal monster-like", values[0]),
        field(1, "monster name/id to match", values[1]),
        field(2, "maximum instances to alter", values[2]),
        field(3, "replacement icon id; -1 means keep", values[3]),
        field(4, "traitor override; -1 means keep", values[4]),
      ];
      addLink(output, { type: "monster", id: values[1], role: "combat alteration target" });
      addLink(output, { type: "resource", resourceType: "cicn", id: values[3], role: "replacement combat icon" });
      break;
    case 121:
      usage.summary = `Destroys lower-level undead during combat; EDCD row is loaded but not read by the source path.`;
      usage.fields = values.map((value, slot) => field(slot, "unused / legacy", value));
      break;
    case 122:
      usage.summary = `Causes a fumble and can show message ${values[0]}.`;
      usage.fields = [
        field(0, "message id", values[0]),
        field(1, "sound id", values[1]),
        field(2, "unused / legacy", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "unused / legacy", values[4]),
      ];
      addMessageLink(output, values[0], "fumble message");
      break;
    case 123:
      usage.summary = `Causes matching monsters to rout using up to five monster ids.`;
      usage.fields = [
        field(0, "monster id 1", values[0]),
        field(1, "monster id 2", values[1]),
        field(2, "monster id 3", values[2]),
        field(3, "monster id 4", values[3]),
        field(4, "monster id 5", values[4]),
      ];
      for (const monsterId of values) {
        addLink(output, { type: "monster", id: monsterId, role: "rout target" });
      }
      break;
    case 124:
      usage.summary = `Spawns ${values[2] < 0 ? "a random count of" : values[2]} monster ${values[1]}.`;
      usage.fields = [
        field(0, "unused / legacy in source path", values[0]),
        field(1, "monster id", values[1]),
        field(2, "monster count; negative means random", values[2]),
        field(3, "sound id", values[3]),
        field(4, "traiter override", values[4]),
      ];
      addLink(output, { type: "monster", id: values[1], role: "spawns monster" });
      break;
    case 125:
      usage.summary = `Destroys up to ${values[1] || 100} related monster ${values[0]} instance(s).`;
      usage.fields = [
        field(0, "monster name/id to destroy", values[0]),
        field(1, "maximum instances; 0 means 100", values[1]),
        field(2, "unused / legacy", values[2]),
        field(3, "unused / legacy", values[3]),
        field(4, "include traitor-side flag", values[4]),
      ];
      addLink(output, { type: "monster", id: values[0], role: "destroy related monsters target" });
      break;
    case 126:
      usage.summary = `Runs a battle macro branch.`;
      usage.fields = [
        field(0, "mode", values[0]),
        field(1, "round / percent", values[1]),
        field(2, "repeat mode", values[2]),
        field(3, "macro or random range start", values[3]),
        field(4, "random range end", values[4]),
      ];
      addLink(output, { type: "macro", id: values[3], role: "battle macro branch" });
      if (values[2] === 2) addLink(output, { type: "macro", id: values[4], role: "battle macro random range end" });
      break;
    default:
      usage.summary = `${action.label} uses EDCD row ${action.id}.`;
      break;
  }
  return usage;
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
  } else if (action.code === 1 || action.code === 62) {
    addMessageLink(output, action.id, "shows message");
  } else if (action.code === 6) {
    addLink(output, { type: "shop", id: action.id, role: "opens shop" });
  } else if (action.code === 10) {
    addLink(output, { type: "treasure", id: action.id, role: "gives treasure" });
  } else if (action.code === 27) {
    addLink(output, { type: "resource", resourceType: "PICT", id: action.id, role: "shows picture" });
  } else if (action.code === 29) {
    addLink(output, { type: "map", id: action.id, role: "gives or displays map" });
  } else if (action.code === 39) {
    addLink(output, { type: "macro", id: action.id, role: "extend door codes" });
  } else if (action.code === 47) {
    addLink(output, { type: "quest", id: Math.abs(action.id), role: action.id > 0 ? "sets flag true" : "sets flag false" });
  }

  if (opcodesLoadingExtracode.has(action.code)) {
    const extra = extracodeById.get(action.id);
    if (extra) {
      output.extracode = extra.values;
      output.extracodeUsage = describeExtracodeUsage(action, extra.values, output);
      addLink(output, { type: "extracode", id: action.id, role: "uses action-data row" });
    } else {
      output.missingExtracode = true;
    }
  }

  if (output.category === "unknown" && Math.abs(output.rawCode) > 127) {
    output.formatSuspicion = "Opcode is outside the source-backed newland.c dispatcher range and may be packed data, misaligned legacy bytes, or an undocumented extension.";
  }

  return output;
}

function macroLinksForDoor(door, extracodeById) {
  const links = [];
  for (const action of door.actions || []) {
    const classified = classifyAction(door, action, extracodeById);
    for (const link of classified.links || []) {
      if (link.type === "macro" && Number.isFinite(link.id) && link.id >= 0) {
        links.push(link.id);
      }
    }
  }
  return links;
}

function selectActiveDoors(doors, extracodes, records = null) {
  const extracodeById = new Map(extracodes.map((row) => [row.id, row]));
  const reachableMacros = new Set();
  const queue = [];
  const macroById = new Map(
    doors
      .filter((door) => door.source === MACRO_SOURCE && door.actions.length)
      .map((door) => [door.recordIndex, door])
  );
  const enqueueMacro = (id) => {
    if (!Number.isInteger(id) || !macroById.has(id) || reachableMacros.has(id)) return;
    reachableMacros.add(id);
    queue.push(id);
  };

  for (const door of doors) {
    if (door.source === MACRO_SOURCE || !door.active) continue;
    for (const macroId of macroLinksForDoor(door, extracodeById)) {
      enqueueMacro(macroId);
    }
  }
  for (const battle of records?.battles?.records || []) {
    if (positiveRef(battle.battleMacro)) {
      enqueueMacro(battle.battleMacro);
    }
  }
  for (const monster of records?.monsters?.records || []) {
    if (positiveRef(monster.todoOnDeath)) {
      enqueueMacro(monster.todoOnDeath);
    }
  }

  while (queue.length) {
    const macro = macroById.get(queue.shift());
    if (!macro) continue;
    for (const macroId of macroLinksForDoor(macro, extracodeById)) {
      enqueueMacro(macroId);
    }
  }

  for (const door of doors) {
    if (door.source !== MACRO_SOURCE) continue;
    door.reachable = reachableMacros.has(door.recordIndex);
    if (door.actions.length && !door.reachable) {
      door.active = false;
      door.inactiveReason = "Data ED3 row has action-like bytes but is not reachable from any decoded trigger, macro call, battle macro, or monster death hook.";
    } else {
      door.active = Boolean(door.actions.length && door.reachable);
      door.inactiveReason = "";
    }
  }

  return doors.filter((door) => door.active);
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
  if (link.type === "monster") return `monster:${link.id}`;
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
    if (door.source === MACRO_SOURCE || !door.hasMapCoordinate || !Number.isInteger(door.levelIndex)) {
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

function attachLevelRenderInfo(levels, randLevels) {
  const randByLevel = new Map(randLevels.map((entry) => [`${entry.levelType}:${entry.levelIndex}`, entry]));
  for (const level of levels) {
    const rand = randByLevel.get(level.id);
    if (level.type === "dungeon") {
      level.renderKind = "dungeon-topdown";
      level.renderLandlook = null;
      level.renderTileset = "top-down dungeon";
      level.renderPictureId = DUNGEON_TINY_PICT_ID;
      level.renderTilesetSource = "Data DL bitfield rendered with tiny sprites from Realmz PICT 302";
    } else if (Number.isInteger(rand?.landlook) && rand.landlook >= 0) {
      const tilesetClue = landlookTilesetClues.get(rand.landlook) || null;
      level.renderKind = "landlook";
      level.renderLandlook = rand.landlook;
      level.renderTileset = `look ${rand.landlook}`;
      level.renderTilesetSource = "Data RD landlook";
      level.tilesetClue = tilesetClue ? { landlook: rand.landlook, ...tilesetClue } : null;
    } else {
      level.renderKind = "decoded";
      level.renderLandlook = null;
      level.renderTileset = "decoded colors";
      level.renderTilesetSource = "no known tile atlas";
      level.tilesetClue = null;
    }
  }
}

function buildAssetManifest(scenarioPath, levels, randLevels) {
  const renderLandlooks = levels.map((level) => level.renderLandlook);
  const metadataLandlooks = randLevels.map((level) => level.landlook);
  const landlooks = [...new Set([...renderLandlooks, ...metadataLandlooks].filter((id) => Number.isInteger(id) && id >= 0))]
    .sort((a, b) => a - b);
  return {
    tileAtlases: landlooks.map((landlook) => ({
      landlook,
      tilesetClue: landlookTilesetClues.get(landlook) || null,
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
  const randLevels = [
    ...parseRandLevels(dataRD, "Data RD", "land"),
    ...parseRandLevels(dataRDD, "Data RDD", "dungeon"),
  ];
  attachLevelRenderInfo(levels, randLevels);
  const doors = [
    ...parseDoorFile(dataDD, "Data DD", "land"),
    ...parseDoorFile(dataDDD, "Data DDD", "dungeon"),
    ...parseDoorFile(dataED3, MACRO_SOURCE, "macro"),
  ];
  const extracodes = parseExtracodes(dataEDCD);
  const simpleEncounters = parseEncounters(dataED, "simple");
  const complexEncounters = parseEncounters(dataED2, "complex");
  const records = buildRecords({ dataMD, dataBD, dataSD, dataSD2, dataMD2, dataTD, dataTD2, dataTD3, dataCI, dataMENU, dataSolids });
  const activeDoors = selectActiveDoors(doors, extracodes, records);
  const graph = buildGraph(activeDoors, extracodes, simpleEncounters, complexEncounters);
  const overlayBoxes = buildOverlayBoxes(activeDoors, randLevels, graph.actions);
  const resources = await parseScenarioResources(resolvedPath);
  attachMapNames(records, resources);
  const assets = buildAssetManifest(resolvedPath, levels, randLevels);

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
  const scenario = {
    name: path.basename(resolvedPath),
    path: resolvedPath,
    analyzedAt: new Date().toISOString(),
  };
  const files = await Promise.all(trackedFiles.map((name) => fileSummary(resolvedPath, name)));
  const alignment = {
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
  };
  const semanticSchema = buildSemanticSchema({
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
  });

  return {
    scenario,
    files,
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
    alignment,
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
    semanticSchema,
    overlayBoxes,
    encounters: {
      simple: simpleEncounters,
      complex: complexEncounters,
    },
  };
}
