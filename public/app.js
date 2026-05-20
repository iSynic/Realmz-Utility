const state = {
  config: null,
  scenarios: [],
  data: null,
  selectedScenarioPath: null,
  selectedLevelId: null,
  selectedItem: null,
  selectedScriptNode: null,
  selectionHistory: [],
  selectionHistoryIndex: -1,
  sidebarCollapsed: false,
  highlightedQuest: null,
  hoverTile: null,
  renderMode: "real",
  useRealmzOrder: true,
  tileAtlasCache: new Map(),
  iconCache: new Map(),
  pictureCache: new Map(),
  secretWalkableCache: new Map(),
  zoom: 8,
  pan: {
    active: false,
    moved: false,
    justDragged: false,
    suppressClickUntil: 0,
    pointerId: null,
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  },
  toggles: {
    doors: true,
    random: true,
    encounters: true,
    quest: true,
    "map mutation": true,
    battle: true,
    text: true,
    unknown: true,
    secrets: false,
  },
};

const DUNGEON_TINY_PICTURE_ID = 302;
const DUNGEON_TINY_SIZE = 16;
const DUNGEON_TINY_COLUMNS = 4;
const DUNGEON_TINY_SOURCE_X = 576;
const DUNGEON_TINY_SOURCE_Y = 320;
const DUNGEON_NATIVE_TILE_PIXELS = 16;
const DUNGEON_SECRET_DIRECTION_MASK = 0x0f00;
const ICON_RENDER_VERSION = 2;

const els = {
  status: document.querySelector("#status"),
  rootForm: document.querySelector("#rootForm"),
  rootPath: document.querySelector("#rootPath"),
  locateScenarios: document.querySelector("#locateScenarios"),
  scenarioList: document.querySelector("#scenarioList"),
  scenarioTitle: document.querySelector("#scenarioTitle"),
  scenarioPath: document.querySelector("#scenarioPath"),
  summary: document.querySelector("#summary"),
  app: document.querySelector("#app"),
  sidebarToggle: document.querySelector("#sidebarToggle"),
  levelSelect: document.querySelector("#levelSelect"),
  mapStage: document.querySelector("#mapStage"),
  mapScroller: document.querySelector("#mapScroller"),
  mapCanvas: document.querySelector("#mapCanvas"),
  overlaySvg: document.querySelector("#overlaySvg"),
  tileStatus: document.querySelector("#tileStatus"),
  mapHud: document.querySelector("#mapHud"),
  selectionPanel: document.querySelector("#selectionPanel"),
  scriptPanel: document.querySelector("#scriptPanel"),
  flagsPanel: document.querySelector("#flagsPanel"),
  dataPanel: document.querySelector("#dataPanel"),
  filesPanel: document.querySelector("#filesPanel"),
  inspectorBack: document.querySelector("#inspectorBack"),
  inspectorForward: document.querySelector("#inspectorForward"),
  toggleRealTiles: document.querySelector("#toggleRealTiles"),
  toggleDecodedColors: document.querySelector("#toggleDecodedColors"),
  toggleRealmzOrder: document.querySelector("#toggleRealmzOrder"),
  toggleDoors: document.querySelector("#toggleDoors"),
  toggleRandom: document.querySelector("#toggleRandom"),
  toggleEncounters: document.querySelector("#toggleEncounters"),
  toggleQuest: document.querySelector("#toggleQuest"),
  toggleMapMutation: document.querySelector("#toggleMapMutation"),
  toggleBattle: document.querySelector("#toggleBattle"),
  toggleText: document.querySelector("#toggleText"),
  toggleUnknown: document.querySelector("#toggleUnknown"),
  toggleSecrets: document.querySelector("#toggleSecrets"),
  importTiles: document.querySelector("#importTiles"),
  exportMap: document.querySelector("#exportMap"),
  zoom: document.querySelector("#zoom"),
  zoomValue: document.querySelector("#zoomValue"),
};

function setStatus(text) {
  els.status.textContent = text;
}

function getTauriInvoke() {
  return window.__TAURI__?.core?.invoke || window.__TAURI__?.tauri?.invoke || window.__TAURI_INTERNALS__?.invoke || null;
}

function updateLauncherControls() {
  const hasDesktopBridge = Boolean(getTauriInvoke());
  els.rootForm.classList.toggle("has-folder-picker", hasDesktopBridge);
  if (els.locateScenarios) {
    els.locateScenarios.hidden = !hasDesktopBridge;
  }
  if (els.exportMap) {
    els.exportMap.hidden = !hasDesktopBridge;
  }
}

async function api(path) {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function apiPost(path) {
  const response = await fetch(path, { method: "POST" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || body.status || `${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function rememberScenarioRoot(root) {
  const invoke = getTauriInvoke();
  if (!invoke || !root) return;

  try {
    await invoke("remember_scenarios_folder", { path: root });
  } catch (error) {
    console.warn("Unable to remember scenario folder", error);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pill(label, value) {
  return `<span class="pill">${escapeHtml(label)} <strong>${escapeHtml(value)}</strong></span>`;
}

function sourceLabel(item) {
  if (!item) return "";
  if (item.source === "Data ED3") return `macro ${item.recordIndex}`;
  return `${item.levelType ?? "?"} ${item.levelIndex ?? "-"} / record ${item.recordIndex ?? "-"}`;
}

function currentLevel() {
  if (!state.data || !state.selectedLevelId) return null;
  return state.data.levels.find((level) => level.id === state.selectedLevelId) || null;
}

function randLevelFor(level) {
  if (!state.data || !level) return null;
  return state.data.randLevels.find((entry) => entry.levelType === level.type && entry.levelIndex === level.index) || null;
}

function levelCode(level) {
  if (!level) return "";
  return `${level.type[0].toUpperCase()}${level.index}`;
}

function levelTitle(level, options = {}) {
  if (!level) return "Level";
  if (!level.name) {
    const hints = (level.nameHints || []).map((hint) => hint.name).filter(Boolean);
    if (hints.length && !options.long) {
      const shown = hints.slice(0, 2).join(" / ");
      return `${levelCode(level)}: ${shown}${hints.length > 2 ? "..." : ""}`;
    }
    if (hints.length && options.long) {
      return `${level.type} level ${level.index} (${hints.slice(0, 3).join(" / ")}${hints.length > 3 ? "..." : ""})`;
    }
    return options.long ? `${level.type} level ${level.index}` : levelCode(level);
  }
  return options.long ? `${level.name} (${level.type} ${level.index})` : `${level.name} (${levelCode(level)})`;
}

function atlasForLandlook(landlook) {
  return state.data?.assets?.tileAtlases?.find((atlas) => atlas.landlook === landlook) || null;
}

function isDungeonTopdownLevel(level) {
  return level?.renderKind === "dungeon-topdown" || (level?.type === "dungeon" && level?.renderPictureId === DUNGEON_TINY_PICTURE_ID);
}

function renderLandlookForLevel(level) {
  if (isDungeonTopdownLevel(level)) {
    return null;
  }
  const rand = randLevelFor(level);
  if (Number.isInteger(level?.renderLandlook)) {
    return level.renderLandlook;
  }
  return Number.isInteger(rand?.landlook) ? rand.landlook : null;
}

function atlasForLevel(level) {
  return atlasForLandlook(renderLandlookForLevel(level));
}

function atlasCacheKey(landlook) {
  return `${state.selectedScenarioPath || ""}:${landlook}`;
}

function atlasStatusForLandlook(landlook) {
  const cached = state.tileAtlasCache.get(atlasCacheKey(landlook));
  if (cached?.status === "loaded") return "available";
  if (cached?.status === "loading") return "loading";
  if (cached?.status === "missing") return "fallback colors";
  return atlasForLandlook(landlook)?.available ? "available" : "not loaded";
}

function atlasStatusForLevel(level) {
  if (isDungeonTopdownLevel(level)) {
    const entry = loadDungeonSpriteSheet();
    if (entry?.status === "loaded") return "available";
    if (entry?.status === "loading") return "loading";
    return "not loaded";
  }
  return atlasStatusForLandlook(renderLandlookForLevel(level));
}

function renderTilesetLabel(level) {
  if (isDungeonTopdownLevel(level)) {
    return `${level?.renderTileset || "top-down dungeon"} (PICT ${level?.renderPictureId || DUNGEON_TINY_PICTURE_ID})`;
  }
  const renderLandlook = renderLandlookForLevel(level);
  const label = level?.renderTileset || (Number.isInteger(renderLandlook) ? `look ${renderLandlook}` : "decoded colors");
  return Number.isInteger(renderLandlook) && !label.includes(String(renderLandlook))
    ? `${label} (landlook ${renderLandlook})`
    : label;
}

function levelLookMeta(level) {
  const rand = randLevelFor(level);
  if (!rand) return "";
  if (isDungeonTopdownLevel(level)) {
    return `, ${renderTilesetLabel(level)}`;
  }
  if (level?.type === "dungeon" && Number.isInteger(level.renderLandlook) && level.renderLandlook !== rand.landlook) {
    return `, ${renderTilesetLabel(level)}`;
  }
  return `, look ${rand.landlook}`;
}

function doorsFor(level) {
  if (!state.data || !level) return [];
  return state.data.doors.filter((door) => door.levelType === level.type && door.levelIndex === level.index);
}

function actionsForDoor(door) {
  if (!state.data) return [];
  return state.data.graph.actions.filter((action) => action.doorId === door.id);
}

function doorByRecordRef(recordRef) {
  return state.data?.doors.find((door) => door.id === recordRef) || null;
}

function scriptNodeById(id) {
  return state.data?.scriptGraph?.nodes?.find((node) => node.id === id) || state.data?.graph?.nodes?.find((node) => node.id === id) || null;
}

function normalizeTile(value) {
  let out = value;
  while (out > 999) out -= 1000;
  while (out < -999) out += 1000;
  return out;
}

function tileColor(value) {
  const base = normalizeTile(value);
  const hasDoorMarker = Math.abs(value) >= 1000;
  const noteBit = value & 2;
  const pathBit = value & 4;
  let hue = (base * 43 + 2100) % 360;
  let sat = 34 + (Math.abs(base) % 20);
  let light = 28 + (Math.abs(base) % 26);

  if (base < 0) {
    hue = (hue + 180) % 360;
    sat += 10;
    light -= 8;
  }
  if (hasDoorMarker) {
    sat += 12;
    light += 10;
  }
  if (pathBit) {
    hue = 90;
    sat = 42;
    light = 45;
  }
  if (noteBit) {
    hue = 285;
    sat = 44;
    light = 48;
  }
  return hslToRgb(hue, Math.min(sat, 80), Math.max(12, Math.min(light, 70)));
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function normalizeAtlasTile(value, baseTile = 1) {
  let tile = value;
  const fallbackTile = Number.isInteger(baseTile) && baseTile > 0 ? baseTile : 1;
  if (tile < 0) {
    while (tile < -999) tile += 1000;
    tile = fallbackTile;
  }
  if (tile > 999) {
    tile = clearRealmzShortBit(tile, 1);
    tile = clearRealmzShortBit(tile, 2);
    for (let attempt = 0; attempt < 3 && tile > 999; attempt += 1) {
      tile -= 1000;
    }
  }
  if (tile > 200) {
    tile = fallbackTile;
  }
  return Math.max(1, normalizeTile(tile));
}

function clearRealmzShortBit(value, bit) {
  const unsigned = value & 0xffff;
  const cleared = unsigned & ~(1 << (15 - bit));
  return cleared >= 0x8000 ? cleared - 0x10000 : cleared;
}

function normalizeIconId(value) {
  let iconId = value;
  while (iconId < -999) iconId += 1000;
  return iconId;
}

function loadAtlasImage(atlas) {
  if (!atlas?.url) return null;
  const key = atlasCacheKey(atlas.landlook);
  const cached = state.tileAtlasCache.get(key);
  if (cached) return cached;
  const entry = { status: "loading", image: null, error: null, metadata: null, promise: null };
  state.tileAtlasCache.set(key, entry);
  const metadataPromise = fetch(`/api/asset/tile-atlas-meta?scenarioPath=${encodeURIComponent(state.selectedScenarioPath)}&landlook=${encodeURIComponent(atlas.landlook)}`)
    .then((response) => response.ok ? response.json() : null)
    .then((metadata) => {
      entry.metadata = metadata;
      drawMap();
      renderSelectionPanel();
      return metadata;
    })
    .catch(() => {
      entry.metadata = null;
      return null;
    });
  const image = new Image();
  const imagePromise = new Promise((resolve) => {
    image.onload = () => {
      entry.status = "loaded";
      entry.image = image;
      drawMap();
      renderSelectionPanel();
      resolve(entry);
    };
    image.onerror = () => {
      entry.status = "missing";
      entry.error = "atlas unavailable";
      drawMap();
      renderSelectionPanel();
      resolve(entry);
    };
  });
  entry.promise = Promise.allSettled([metadataPromise, imagePromise]).then(() => entry);
  image.src = atlas.url;
  return entry;
}

function loadIconImage(iconId) {
  if (!Number.isInteger(iconId)) return null;
  const cacheKey = `${state.selectedScenarioPath || ""}:${iconId}`;
  const cached = state.iconCache.get(cacheKey);
  if (cached) return cached;
  const entry = { status: "loading", image: null, error: null, promise: null };
  state.iconCache.set(cacheKey, entry);
  const image = new Image();
  entry.promise = new Promise((resolve) => {
    image.onload = () => {
      entry.status = "loaded";
      entry.image = image;
      drawMap();
      resolve(entry);
    };
    image.onerror = () => {
      entry.status = "missing";
      entry.error = "icon unavailable";
      drawMap();
      resolve(entry);
    };
  });
  const params = new URLSearchParams({ id: String(iconId) });
  if (state.selectedScenarioPath) {
    params.set("scenarioPath", state.selectedScenarioPath);
  }
  params.set("v", String(ICON_RENDER_VERSION));
  image.src = `/api/asset/icon?${params.toString()}`;
  return entry;
}

function loadPictureImage(pictureId) {
  if (!Number.isInteger(pictureId)) return null;
  const cacheKey = String(pictureId);
  const cached = state.pictureCache.get(cacheKey);
  if (cached) return cached;
  const entry = { status: "loading", image: null, error: null, promise: null };
  state.pictureCache.set(cacheKey, entry);
  const image = new Image();
  entry.promise = new Promise((resolve) => {
    image.onload = () => {
      entry.status = "loaded";
      entry.image = image;
      drawMap();
      renderSelectionPanel();
      resolve(entry);
    };
    image.onerror = () => {
      entry.status = "missing";
      entry.error = "picture unavailable";
      drawMap();
      renderSelectionPanel();
      resolve(entry);
    };
  });
  image.src = `/api/asset/picture?id=${encodeURIComponent(pictureId)}`;
  return entry;
}

function loadDungeonSpriteSheet() {
  const entry = loadPictureImage(DUNGEON_TINY_PICTURE_ID);
  if (!entry) return null;
  if (!entry.sprites) {
    entry.sprites = new Map();
  }
  return entry;
}

function dungeonSpriteCanvas(entry, index) {
  if (!entry?.image || entry.status !== "loaded") return null;
  if (entry.sprites.has(index)) {
    return entry.sprites.get(index);
  }

  const canvas = document.createElement("canvas");
  canvas.width = DUNGEON_TINY_SIZE;
  canvas.height = DUNGEON_TINY_SIZE;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  const sx = DUNGEON_TINY_SOURCE_X + (index % DUNGEON_TINY_COLUMNS) * DUNGEON_TINY_SIZE;
  const sy = DUNGEON_TINY_SOURCE_Y + Math.floor(index / DUNGEON_TINY_COLUMNS) * DUNGEON_TINY_SIZE;
  context.drawImage(entry.image, sx, sy, DUNGEON_TINY_SIZE, DUNGEON_TINY_SIZE, 0, 0, DUNGEON_TINY_SIZE, DUNGEON_TINY_SIZE);

  if (index !== 15) {
    const image = context.getImageData(0, 0, DUNGEON_TINY_SIZE, DUNGEON_TINY_SIZE);
    for (let offset = 0; offset < image.data.length; offset += 4) {
      const r = image.data[offset];
      const g = image.data[offset + 1];
      const b = image.data[offset + 2];
      if (r > 245 && g > 245 && b > 245) {
        image.data[offset + 3] = 0;
      }
    }
    context.putImageData(image, 0, 0);
  }

  entry.sprites.set(index, canvas);
  return canvas;
}

function tileValueAt(level, x, y) {
  if (isDungeonTopdownLevel(level)) {
    return level.values[y * level.width + x] ?? 0;
  }
  const index = state.useRealmzOrder
    ? x * level.height + y
    : y * level.width + x;
  return level.values[index] ?? 0;
}

function normalizedTileBase(value) {
  let out = Math.abs(value);
  while (out > 999) out -= 1000;
  return out;
}

function hasDungeonSecretDirection(value) {
  return Boolean((value & 0xffff) & DUNGEON_SECRET_DIRECTION_MASK);
}

function hasDungeonShownSecretMarker(value) {
  return dungeonFieldHasBit(value, 9);
}

function hasSecretMarker(value, level = null) {
  if (isDungeonTopdownLevel(level)) {
    return hasDungeonSecretDirection(value) || hasDungeonShownSecretMarker(value);
  }
  return Math.abs(value) >= 3000;
}

function hasSecretPath(value, level = null) {
  if (isDungeonTopdownLevel(level)) {
    return hasDungeonSecretDirection(value);
  }
  return Math.abs(value) >= 1000;
}

function isSecretWalkableGlyph(value) {
  const base = normalizedTileBase(value);
  return base === 169;
}

function isSecretWalkableTile(value, level = null) {
  if (isDungeonTopdownLevel(level)) {
    return hasDungeonSecretDirection(value);
  }
  const base = normalizedTileBase(value);
  return isSecretWalkableGlyph(value) || (hasSecretMarker(value, level) && (base === 169 || base === 181));
}

function secretWalkableTileSet(level) {
  const cacheKey = `${state.selectedScenarioPath || ""}:${level?.id || ""}:${state.useRealmzOrder ? "realmz" : "row"}`;
  const cached = state.secretWalkableCache.get(cacheKey);
  if (cached) return cached;
  const output = new Set();
  if (!level) return output;
  const keyFor = (x, y) => `${x},${y}`;

  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      if (isSecretWalkableTile(tileValueAt(level, x, y), level)) {
        output.add(keyFor(x, y));
      }
    }
  }

  state.secretWalkableCache.set(cacheKey, output);
  return output;
}

function drawColorMap(context, level, tilePixels = 1) {
  if (tilePixels !== 1) {
    context.imageSmoothingEnabled = false;
    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const [r, g, b] = tileColor(tileValueAt(level, x, y));
        context.fillStyle = `rgb(${r}, ${g}, ${b})`;
        context.fillRect(x * tilePixels, y * tilePixels, tilePixels, tilePixels);
      }
    }
    return;
  }

  const image = context.createImageData(level.width, level.height);
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const [r, g, b] = tileColor(tileValueAt(level, x, y));
      const offset = (y * level.width + x) * 4;
      image.data[offset] = r;
      image.data[offset + 1] = g;
      image.data[offset + 2] = b;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

function drawAtlasTile(context, atlasEntry, tile, x, y) {
  const tileSize = 32;
  const columns = Math.max(1, Math.floor((atlasEntry.image?.naturalWidth || 640) / tileSize));
  const atlasIndex = tile - 1;
  const sx = (atlasIndex % columns) * tileSize;
  const sy = Math.floor(atlasIndex / columns) * tileSize;
  if (sy + tileSize <= atlasEntry.image.naturalHeight) {
    context.drawImage(atlasEntry.image, sx, sy, tileSize, tileSize, x * tileSize, y * tileSize, tileSize, tileSize);
    return true;
  }
  return false;
}

function drawRealTileMap(context, level, atlasEntry) {
  const tileSize = 32;
  context.imageSmoothingEnabled = false;
  const baseTile = atlasEntry.metadata?.metadata?.baseTile
    ?? atlasEntry.metadata?.cached?.metadata?.baseTile
    ?? 1;
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const value = tileValueAt(level, x, y);
      const tile = normalizeAtlasTile(value, baseTile);
      if (!drawAtlasTile(context, atlasEntry, tile, x, y)) {
        const [r, g, b] = tileColor(value);
        context.fillStyle = `rgb(${r}, ${g}, ${b})`;
        context.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
      if (value < 0) {
        const iconEntry = loadIconImage(normalizeIconId(value));
        if (iconEntry?.status === "loaded" && iconEntry.image) {
          context.drawImage(iconEntry.image, x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    }
  }
}

function dungeonFieldHasBit(value, bit) {
  return Boolean((value & 0xffff) & (1 << (15 - bit)));
}

function drawDungeonSprite(context, spriteEntry, index, x, y, tilePixels = DUNGEON_NATIVE_TILE_PIXELS) {
  const sprite = dungeonSpriteCanvas(spriteEntry, index);
  if (!sprite) return false;
  context.drawImage(sprite, x * tilePixels, y * tilePixels, tilePixels, tilePixels);
  return true;
}

function drawDungeonTopdownMap(context, level, spriteEntry, tilePixels = DUNGEON_NATIVE_TILE_PIXELS) {
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#000";
  context.fillRect(0, 0, level.width * tilePixels, level.height * tilePixels);

  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const value = tileValueAt(level, x, y);
      drawDungeonSprite(context, spriteEntry, 15, x, y, tilePixels);
      // Realmz uses bit 8 as an explored/hidden flag in normal play.
      // The utility is a full-map viewer, so reveal terrain but avoid drawing marker/editor bits.
      for (let index = 0; index <= 6; index += 1) {
        if (dungeonFieldHasBit(value, 15 - index)) {
          drawDungeonSprite(context, spriteEntry, index, x, y, tilePixels);
        }
      }
    }
  }
}

function drawMap() {
  const level = currentLevel();
  const canvas = els.mapCanvas;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (els.zoomValue) {
    els.zoomValue.textContent = `${state.zoom}px`;
  }

  const stageWidth = level ? level.width * state.zoom : 720;
  const stageHeight = level ? level.height * state.zoom : 720;
  els.mapStage.style.width = `${stageWidth}px`;
  els.mapStage.style.height = `${stageHeight}px`;

  if (!level) {
    els.tileStatus.textContent = "";
    renderOverlay();
    return;
  }

  const renderLandlook = renderLandlookForLevel(level);
  const useDungeonTopdown = state.renderMode === "real" && isDungeonTopdownLevel(level);
  const dungeonSpriteEntry = useDungeonTopdown ? loadDungeonSpriteSheet() : null;
  const canDrawDungeonTopdown = Boolean(dungeonSpriteEntry?.status === "loaded" && dungeonSpriteEntry.image);
  const atlas = useDungeonTopdown ? null : atlasForLandlook(renderLandlook);
  const atlasEntry = state.renderMode === "real" && !useDungeonTopdown ? loadAtlasImage(atlas) : null;
  const canDrawReal = Boolean(atlasEntry?.status === "loaded" && atlasEntry.image);
  const tilePixels = canDrawDungeonTopdown ? DUNGEON_NATIVE_TILE_PIXELS : canDrawReal ? 32 : 1;
  canvas.width = level.width * tilePixels;
  canvas.height = level.height * tilePixels;
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (canDrawDungeonTopdown) {
    drawDungeonTopdownMap(context, level, dungeonSpriteEntry);
    els.tileStatus.textContent = `Dungeon overhead renderer: ${renderTilesetLabel(level)}, Data DL bitfield sprites.`;
  } else if (canDrawReal) {
    drawRealTileMap(context, level, atlasEntry);
    const sourceLabel = atlasEntry.metadata?.cached?.importedFrom || "exported PICT";
    const baseTile = atlasEntry.metadata?.metadata?.baseTile ?? atlasEntry.metadata?.cached?.metadata?.baseTile;
    els.tileStatus.textContent = `Real tile atlas: ${renderTilesetLabel(level)}, ${sourceLabel}${baseTile ? `, base tile ${baseTile}` : ""}.`;
  } else {
    drawColorMap(context, level);
    if (useDungeonTopdown && dungeonSpriteEntry?.status === "loading") {
      els.tileStatus.textContent = `Loading dungeon overhead sprites from PICT ${DUNGEON_TINY_PICTURE_ID}...`;
    } else if (useDungeonTopdown) {
      els.tileStatus.textContent = `Dungeon overhead sprites missing for PICT ${DUNGEON_TINY_PICTURE_ID}; using decoded colors.`;
    } else if (state.renderMode === "real" && atlasEntry?.status === "loading") {
      els.tileStatus.textContent = `Loading real tile atlas for ${renderTilesetLabel(level)}...`;
    } else if (state.renderMode === "real") {
      els.tileStatus.textContent = `Real tile atlas missing for ${renderTilesetLabel(level)}; using decoded colors.`;
    } else {
      els.tileStatus.textContent = "Decoded color map mode.";
    }
  }
  renderOverlay();
}

function svgEl(name, attrs = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs)) {
    element.setAttribute(key, value);
  }
  return element;
}

function addLabel(group, x, y, text, color = "#fff") {
  const label = svgEl("text", {
    x,
    y,
    class: "overlay-label",
    fill: color,
  });
  label.textContent = text;
  group.appendChild(label);
  return label;
}

function isQuestDoor(door) {
  return actionsForDoor(door).some((action) => ["quest_read", "quest_write"].includes(action.category));
}

function isEncounterDoor(door) {
  return actionsForDoor(door).some((action) => action.links.some((link) => link.type === "encounter"));
}

function isHighlightedQuestDoor(door) {
  if (state.highlightedQuest == null) return false;
  return actionsForDoor(door).some((action) => {
    if (action.code === 47) return Math.abs(action.id) === state.highlightedQuest;
    if ([46, 76, 77].includes(action.code) && action.extracode) return action.extracode[0] === state.highlightedQuest;
    if (action.code === 72 && action.extracode) return state.highlightedQuest >= action.extracode[0] && state.highlightedQuest <= action.extracode[1];
    return false;
  });
}

function categoryEnabled(category) {
  if (category === "random") return state.toggles.random;
  if (category === "quest") return state.toggles.quest && state.toggles.doors;
  if (category === "encounter") return state.toggles.encounters && state.toggles.doors;
  if (category === "entrance") return state.toggles["map mutation"] && state.toggles.doors;
  return state.toggles.doors && state.toggles[category] !== false;
}

function overlayForLevel(level) {
  if (!state.data || !level) return [];
  return (state.data.overlayBoxes || []).filter((box) => box.levelType === level.type && box.levelIndex === level.index);
}

function colorForCategory(category, highlighted = false) {
  if (highlighted || category === "quest") return "var(--quest)";
  if (category === "encounter") return "var(--encounter)";
  if (category === "random") return "var(--random)";
  if (category === "entrance") return "var(--map)";
  if (category === "map mutation") return "var(--map)";
  if (category === "battle") return "var(--battle)";
  if (category === "text") return "var(--text-overlay)";
  return "var(--trigger)";
}

const overlayDefinitions = {
  quest: {
    name: "Quest trigger",
    shortName: "Quest",
    summary: "Reads or changes quest state, usually to remember choices, unlock branches, or track progress.",
  },
  encounter: {
    name: "Encounter trigger",
    shortName: "Encounter",
    summary: "Starts or branches into a scripted encounter with choices, text, or follow-up actions.",
  },
  random: {
    name: "Random encounter area",
    shortName: "Random",
    summary: "An area where movement can roll for a wandering encounter, battle, or scripted follow-up.",
  },
  "map mutation": {
    name: "Map change trigger",
    shortName: "Map",
    summary: "Changes map state, movement, terrain, visibility, teleport position, or another location-related setting.",
  },
  entrance: {
    name: "Entrance trigger",
    shortName: "Entrance",
    summary: "Moves the party into another mapped place, often after showing text or checking a branch.",
  },
  battle: {
    name: "Battle trigger",
    shortName: "Battle",
    summary: "Starts or configures combat directly from this map position.",
  },
  text: {
    name: "Message trigger",
    shortName: "Text",
    summary: "Shows scenario text, a map, or other player-facing information.",
  },
  unknown: {
    name: "Unclassified trigger",
    shortName: "Other",
    summary: "Contains decoded action slots, but the utility does not yet have a confident semantic category for them.",
  },
};

function categoryName(category) {
  return overlayDefinitions[category]?.shortName || category || "Unknown";
}

function categoryDefinition(category) {
  return overlayDefinitions[category] || overlayDefinitions.unknown;
}

function recordShortId(recordRef) {
  return String(recordRef ?? "").replace(/^.*:/, "") || "-";
}

function formatBounds(bounds) {
  if (!bounds) return "-";
  if (bounds.width <= 1.2 && bounds.height <= 1.2) {
    return `tile ${Math.round(bounds.left)}, ${Math.round(bounds.top)}`;
  }
  return `x ${bounds.left}-${bounds.right - 1}, y ${bounds.top}-${bounds.bottom - 1} (${bounds.width} x ${bounds.height})`;
}

function boxTitle(box) {
  const bounds = box.bounds;
  const definition = categoryDefinition(box.category);
  const ref = box.label || recordShortId(box.recordRef);
  const location = bounds.width <= 1.2 && bounds.height <= 1.2
    ? `${Math.round(bounds.left + 0.5)},${Math.round(bounds.top + 0.5)}`
    : `${bounds.left},${bounds.top} - ${bounds.right},${bounds.bottom}`;
  return `${definition.name}${ref && ref !== "-" ? ` ${ref}` : ""} @ ${location}`;
}

function doorDestinationLabel(door) {
  if (!door || !Number.isInteger(door.targetLandId) || door.targetLandId <= 0) return "";
  const target = Number.isInteger(door.targetX) && Number.isInteger(door.targetY)
    ? `tile ${door.targetX}, ${door.targetY}`
    : "unknown tile";
  return `level ${door.targetLandId}, ${target}`;
}

function boxesAtTile(level, x, y) {
  if (!level) return [];
  return overlayForLevel(level).filter((box) => {
    if (!categoryEnabled(box.category)) return false;
    return x >= box.bounds.left && x < box.bounds.right && y >= box.bounds.top && y < box.bounds.bottom;
  });
}

function boxArea(box) {
  return Math.max(1, box.bounds.width * box.bounds.height);
}

function sortBoxesForSelection(boxes) {
  return [...boxes].sort((a, b) => {
    const areaDelta = boxArea(a) - boxArea(b);
    if (areaDelta !== 0) return areaDelta;
    return boxTitle(a).localeCompare(boxTitle(b));
  });
}

function overlayPayload(box) {
  const level = currentLevel();
  if (!box) return null;
  if (box.category === "random") {
    const rand = randLevelFor(level);
    return { box, random: rand?.rects.find((rect) => rect.id === box.recordRef) || null };
  }
  const door = doorByRecordRef(box.recordRef);
  return door ? { box, door: { ...door, actions: actionsForDoor(door), nodeId: box.nodeId } } : { box };
}

function selectOverlayBox(box, context = {}) {
  const payload = overlayPayload(box);
  if (payload) {
    selectItem("overlay", { ...payload, ...context });
  }
}

function mapPointFromEvent(event) {
  const level = currentLevel();
  if (!level) return null;
  const rect = els.mapStage.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * level.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * level.height);
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return null;
  return { x, y };
}

function selectBoxesAtEvent(event, fallbackBox = null) {
  if (state.pan.justDragged || Date.now() < state.pan.suppressClickUntil) return;
  const level = currentLevel();
  const point = mapPointFromEvent(event);
  const boxes = point ? sortBoxesForSelection(boxesAtTile(level, point.x, point.y)) : [];
  if (!boxes.length && fallbackBox) {
    selectOverlayBox(fallbackBox);
    return;
  }
  if (boxes.length === 1) {
    selectOverlayBox(boxes[0]);
    return;
  }
  if (boxes.length > 1) {
    selectOverlayBox(boxes[0], { point, alternateBoxes: boxes.slice(1), allBoxesAtPoint: boxes });
  }
}

function renderMapHud() {
  if (!els.mapHud) return;
  const level = currentLevel();
  if (!level) {
    els.mapHud.innerHTML = "";
    return;
  }
  const overlays = overlayForLevel(level).filter((box) => categoryEnabled(box.category));
  const hover = state.hoverTile;
  const hoverBoxes = hover ? boxesAtTile(level, hover.x, hover.y) : [];
  const hoverValue = hover ? tileValueAt(level, hover.x, hover.y) : null;
  const secretWalkable = state.toggles.secrets ? secretWalkableTileSet(level) : new Set();
  const hoverIsSecretWalkable = hover ? secretWalkable.has(`${hover.x},${hover.y}`) : false;
  const hoverSecrets = hover
    ? [
        hasSecretMarker(hoverValue, level) ? (isDungeonTopdownLevel(level) ? "dungeon secret" : "secret marker") : "",
        hoverIsSecretWalkable ? "hidden walkable tile" : "",
        hasSecretPath(hoverValue, level) && !hoverIsSecretWalkable ? "encoded passability flag" : "",
      ].filter(Boolean)
    : [];
  const legend = [
    ["random", "random"],
    ["quest", "quest"],
    ["encounter", "encounter"],
    ["battle", "battle"],
    ["entrance", "entrance"],
    ["map mutation", "map"],
    ["text", "text"],
    ["unknown", "trigger"],
  ];
  els.mapHud.innerHTML = `
    <div class="hud-title">${escapeHtml(levelTitle(level, { long: true }))} | ${level.width} x ${level.height} | ${overlays.length} boxes</div>
    <div class="hud-row">${hover ? `tile ${hover.x},${hover.y} | raw ${escapeHtml(hoverValue)}${hoverSecrets.length ? ` | ${escapeHtml(hoverSecrets.join(", "))}` : ""}` : "hover a tile for metadata"}</div>
    ${hoverBoxes.length ? `<div class="hud-row">${hoverBoxes.slice(0, 4).map((box) => escapeHtml(boxTitle(box))).join("<br />")}${hoverBoxes.length > 4 ? `<br />+ ${hoverBoxes.length - 4} more` : ""}</div>` : ""}
    <div class="hud-legend">
      ${legend.map(([category, label]) => `<span><i class="legend-swatch ${escapeHtml(category.replaceAll(" ", "-"))}"></i>${escapeHtml(label)}</span>`).join("")}
    </div>
  `;
}

function handleMapHover(event) {
  state.hoverTile = mapPointFromEvent(event);
  renderMapHud();
}

function renderSecretTileOverlay(root, level) {
  if (!state.toggles.secrets || !level) return;
  const group = svgEl("g", { class: "secret-tile-layer" });
  const walkableTiles = secretWalkableTileSet(level);
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const value = tileValueAt(level, x, y);
      if (walkableTiles.has(`${x},${y}`)) {
        group.appendChild(svgEl("rect", {
          x,
          y,
          width: 1,
          height: 1,
          class: "secret-path-tile",
        }));
      }
      if (hasSecretMarker(value, level)) {
        const marker = svgEl("text", {
          x: x + 0.5,
          y: y + 0.78,
          class: "secret-marker",
        });
        marker.textContent = "S";
        group.appendChild(marker);
      }
    }
  }
  root.appendChild(group);
}

function renderOverlay() {
  const svg = els.overlaySvg;
  svg.textContent = "";
  const level = currentLevel();
  if (!level) {
    renderMapHud();
    return;
  }

  const root = svgEl("g");
  const selectedRoot = svgEl("g", { class: "overlay-selected-layer" });
  svg.appendChild(root);
  svg.appendChild(selectedRoot);
  renderSecretTileOverlay(root, level);

  for (const box of overlayForLevel(level)) {
    const door = box.category === "random" ? null : doorByRecordRef(box.recordRef);
    const highlighted = door ? isHighlightedQuestDoor(door) || state.selectedScriptNode === box.nodeId : false;
    if (!categoryEnabled(box.category) && !highlighted) continue;
    const bounds = box.bounds;
    const width = Math.max(0.8, bounds.width);
    const height = Math.max(0.8, bounds.height);
    const selected = (state.selectedItem?.type === "overlay" && state.selectedItem.item?.box?.id === box.id)
      || (state.selectedItem?.type === "record" && state.selectedItem.item?.sourceOverlay?.box?.id === box.id);
    const color = colorForCategory(box.category, highlighted || selected);
    const isZone = width > 1.2 || height > 1.2;
    const rect = svgEl("rect", {
      x: bounds.left,
      y: bounds.top,
      width,
      height,
      fill: selected ? "rgba(241, 180, 102, 0.22)" : highlighted ? "rgba(216, 140, 240, 0.24)" : "transparent",
      stroke: color,
      "stroke-width": selected ? "2.4" : highlighted ? "2.1" : isZone ? "1.25" : "0.95",
      class: `overlay-hit ${selected ? "selected" : ""} ${isZone ? "overlay-zone" : "overlay-point"} ${box.category.replaceAll(" ", "-")}`,
      "data-category": box.category,
      "data-record": box.recordRef ?? "",
    });
    rect.appendChild(svgEl("title"));
    rect.firstChild.textContent = boxTitle(box);
    rect.addEventListener("click", (event) => {
      event.stopPropagation();
      selectBoxesAtEvent(event, box);
    });
    const targetRoot = selected ? selectedRoot : root;
    targetRoot.appendChild(rect);
    if (isZone) {
      const label = addLabel(targetRoot, bounds.left + 0.18, Math.max(bounds.top + height - 0.28, bounds.top + 0.55), `${box.label || categoryName(box.category)} ${bounds.left},${bounds.top} - ${bounds.right},${bounds.bottom}`, selected ? "var(--accent-2)" : "#f5f3e8");
      label.classList.add("overlay-zone-label");
    } else if (box.recordRef != null) {
      const label = addLabel(targetRoot, bounds.left + 0.12, bounds.top + 0.36, String(box.recordRef).replace(/^.*:/, ""), selected ? "var(--accent-2)" : color);
      label.classList.add("overlay-point-label");
    }
  }
  renderMapHud();
}

const EXPORT_TILE_PIXELS = 32;

function exportTilePixelsForLevel(level) {
  return isDungeonTopdownLevel(level) ? DUNGEON_NATIVE_TILE_PIXELS : EXPORT_TILE_PIXELS;
}

function resolveCanvasColor(value, fallback = "#ffffff") {
  const color = String(value ?? "").trim();
  const variable = color.match(/^var\((--[^),\s]+)\)$/);
  if (!variable) return color || fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(variable[1]).trim() || fallback;
}

function isBoxSelected(box) {
  return (state.selectedItem?.type === "overlay" && state.selectedItem.item?.box?.id === box.id)
    || (state.selectedItem?.type === "record" && state.selectedItem.item?.sourceOverlay?.box?.id === box.id);
}

function isBoxHighlighted(box) {
  const door = box.category === "random" ? null : doorByRecordRef(box.recordRef);
  return door ? isHighlightedQuestDoor(door) || state.selectedScriptNode === box.nodeId : false;
}

function drawExportText(context, text, x, y, options = {}) {
  context.save();
  context.font = `${options.weight || 760} ${options.size || 12}px "Cascadia Mono", Consolas, ui-monospace, monospace`;
  context.textAlign = options.align || "left";
  context.textBaseline = options.baseline || "alphabetic";
  context.lineJoin = "round";
  context.strokeStyle = options.stroke || "rgba(0, 0, 0, 0.9)";
  context.lineWidth = options.strokeWidth || 4;
  context.fillStyle = options.fill || "#ffffff";
  context.strokeText(text, x, y);
  context.fillText(text, x, y);
  context.restore();
}

function drawSecretExportOverlay(context, level, tilePixels) {
  if (!state.toggles.secrets || !level) return;
  const walkableTiles = secretWalkableTileSet(level);
  context.save();
  context.fillStyle = "rgba(217, 54, 35, 0.34)";
  context.strokeStyle = "rgba(255, 132, 92, 0.75)";
  context.lineWidth = 1;
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const value = tileValueAt(level, x, y);
      if (walkableTiles.has(`${x},${y}`)) {
        context.fillRect(x * tilePixels, y * tilePixels, tilePixels, tilePixels);
        context.strokeRect(x * tilePixels + 0.5, y * tilePixels + 0.5, tilePixels - 1, tilePixels - 1);
      }
      if (hasSecretMarker(value, level)) {
        drawExportText(context, "S", (x + 0.5) * tilePixels, (y + 0.78) * tilePixels, {
          align: "center",
          fill: "#ff523b",
          size: tilePixels * 0.82,
          strokeWidth: Math.max(3, tilePixels * 0.16),
          weight: 900,
        });
      }
    }
  }
  context.restore();
}

function exportStrokeForBox(box, highlighted, selected, isZone) {
  if (selected) return resolveCanvasColor("var(--accent-2-strong)", "#f0c86d");
  if (isZone || box.category === "random") return "rgba(229, 220, 192, 0.82)";
  return resolveCanvasColor(colorForCategory(box.category, highlighted), "#e5dcc0");
}

function drawExportBox(context, box, tilePixels) {
  const highlighted = isBoxHighlighted(box);
  const selected = isBoxSelected(box);
  const bounds = box.bounds;
  const width = Math.max(0.8, bounds.width);
  const height = Math.max(0.8, bounds.height);
  const isZone = width > 1.2 || height > 1.2;
  const x = bounds.left * tilePixels;
  const y = bounds.top * tilePixels;
  const w = width * tilePixels;
  const h = height * tilePixels;
  const stroke = exportStrokeForBox(box, highlighted, selected, isZone);

  context.save();
  context.lineWidth = selected ? 3 : highlighted ? 2.4 : isZone ? 1.5 : 1.25;
  context.strokeStyle = stroke;
  context.fillStyle = selected
    ? "rgba(240, 200, 109, 0.32)"
    : highlighted ? "rgba(216, 140, 240, 0.24)" : "transparent";
  if (selected || highlighted) {
    context.fillRect(x, y, w, h);
  }
  context.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  context.restore();

  if (isZone) {
    drawExportText(
      context,
      `${box.label || categoryName(box.category)} ${bounds.left},${bounds.top} - ${bounds.right},${bounds.bottom}`,
      (bounds.left + 0.18) * tilePixels,
      Math.max(bounds.top + height - 0.28, bounds.top + 0.55) * tilePixels,
      {
        fill: selected ? resolveCanvasColor("var(--accent-2)", "#d4a64f") : "#f5f3e8",
        size: tilePixels * 0.28,
        strokeWidth: Math.max(2, tilePixels * 0.12),
        weight: 680,
      },
    );
  } else if (box.recordRef != null) {
    drawExportText(context, String(box.recordRef).replace(/^.*:/, ""), (bounds.left + 0.12) * tilePixels, (bounds.top + 0.36) * tilePixels, {
      fill: selected ? resolveCanvasColor("var(--accent-2)", "#d4a64f") : stroke,
      size: tilePixels * 0.32,
      strokeWidth: Math.max(2, tilePixels * 0.12),
    });
  }
}

function drawExportOverlays(context, level, tilePixels) {
  drawSecretExportOverlay(context, level, tilePixels);
  const selectedBoxes = [];
  for (const box of overlayForLevel(level)) {
    const highlighted = isBoxHighlighted(box);
    if (!categoryEnabled(box.category) && !highlighted) continue;
    if (isBoxSelected(box)) {
      selectedBoxes.push(box);
    } else {
      drawExportBox(context, box, tilePixels);
    }
  }
  for (const box of selectedBoxes) {
    drawExportBox(context, box, tilePixels);
  }
}

async function atlasEntryForExport(level) {
  if (state.renderMode !== "real") return null;
  if (isDungeonTopdownLevel(level)) return null;
  const atlas = atlasForLevel(level);
  const atlasEntry = loadAtlasImage(atlas);
  if (atlasEntry?.status === "loading" && atlasEntry.promise) {
    await atlasEntry.promise;
  }
  return atlasEntry?.status === "loaded" && atlasEntry.image ? atlasEntry : null;
}

async function dungeonSpriteEntryForExport(level) {
  if (state.renderMode !== "real" || !isDungeonTopdownLevel(level)) return null;
  const entry = loadDungeonSpriteSheet();
  if (entry?.status === "loading" && entry.promise) {
    await entry.promise;
  }
  return entry?.status === "loaded" && entry.image ? entry : null;
}

async function preloadIconImagesForLevel(level) {
  const promises = [];
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const value = tileValueAt(level, x, y);
      if (value < 0) {
        const iconEntry = loadIconImage(normalizeIconId(value));
        if (iconEntry?.status === "loading" && iconEntry.promise) {
          promises.push(iconEntry.promise);
        }
      }
    }
  }
  if (promises.length) {
    await Promise.allSettled(promises);
  }
}

async function renderCurrentMapExportCanvas() {
  const level = currentLevel();
  if (!level) {
    throw new Error("Load a map before exporting.");
  }

  const canvas = document.createElement("canvas");
  const exportTilePixels = exportTilePixelsForLevel(level);
  canvas.width = level.width * exportTilePixels;
  canvas.height = level.height * exportTilePixels;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;

  const dungeonSpriteEntry = await dungeonSpriteEntryForExport(level);
  const atlasEntry = dungeonSpriteEntry ? null : await atlasEntryForExport(level);
  if (dungeonSpriteEntry) {
    drawDungeonTopdownMap(context, level, dungeonSpriteEntry, exportTilePixels);
  } else if (atlasEntry) {
    await preloadIconImagesForLevel(level);
    drawRealTileMap(context, level, atlasEntry);
  } else {
    drawColorMap(context, level, exportTilePixels);
  }
  drawExportOverlays(context, level, exportTilePixels);
  return canvas;
}

function safeFilenamePart(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^a-z0-9._ -]+/gi, "-")
    .replace(/[-\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "map";
}

function suggestedMapExportFilename(level) {
  const scenario = safeFilenamePart(state.data?.scenario?.name || "Realmz");
  const map = safeFilenamePart(levelTitle(level, { long: true }));
  const mode = state.renderMode === "real" ? "real-tiles" : "decoded-colors";
  return `${scenario}-${map}-${mode}.png`;
}

async function exportCurrentMap() {
  const invoke = getTauriInvoke();
  if (!invoke) {
    setStatus("Map PNG export is available in the desktop launcher.");
    updateLauncherControls();
    return;
  }
  const level = currentLevel();
  if (!level) {
    setStatus("Load a map before exporting.");
    return;
  }

  els.exportMap.disabled = true;
  setStatus("Rendering full-size map export...");
  try {
    const canvas = await renderCurrentMapExportCanvas();
    const pngBase64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
    setStatus("Choose where to save the map PNG...");
    const savedPath = await invoke("save_exported_map_png", {
      suggestedFilename: suggestedMapExportFilename(level),
      pngBase64,
    });
    if (savedPath) {
      setStatus(`Exported ${levelTitle(level)} to ${savedPath}`);
    } else {
      setStatus("Map export canceled");
    }
  } catch (error) {
    setStatus(`Unable to export map: ${error.message || error}`);
  } finally {
    els.exportMap.disabled = false;
  }
}

function renderScenarioList() {
  els.scenarioList.innerHTML = state.scenarios
    .map((scenario) => `
      <button class="scenario-item ${scenario.path === state.selectedScenarioPath ? "active" : ""}" data-path="${escapeHtml(scenario.path)}">
        ${escapeHtml(scenario.name)}
        <span>${escapeHtml(scenario.path)}</span>
      </button>
    `)
    .join("");
  for (const button of els.scenarioList.querySelectorAll(".scenario-item")) {
    button.addEventListener("click", () => loadScenario(button.dataset.path));
  }
}

function renderHeader() {
  const data = state.data;
  if (!data) {
    els.scenarioTitle.textContent = "No scenario loaded";
    els.scenarioPath.textContent = "";
    els.summary.innerHTML = "";
    return;
  }
  els.scenarioTitle.textContent = data.scenario.name;
  els.scenarioPath.textContent = data.scenario.path;
  els.summary.innerHTML = [
    pill("levels", data.counts.levels),
    pill("triggers", data.counts.activeDoors),
    pill("random rects", data.counts.randomRects),
    pill("actions", data.counts.actions),
    pill("quest flags", data.counts.questFlags),
    pill("encounters", `${data.counts.simpleEncounters}/${data.counts.complexEncounters}`),
    pill("script edges", data.counts.scriptEdges ?? 0),
    pill("overlays", data.counts.overlayBoxes ?? 0),
  ].join("");
}

function renderLevelTabs() {
  if (!state.data) {
    els.levelSelect.innerHTML = "";
    els.levelSelect.disabled = true;
    return;
  }
  els.levelSelect.disabled = false;
  els.levelSelect.innerHTML = state.data.levels
    .map((level) => {
      const meta = levelLookMeta(level);
      return `<option value="${escapeHtml(level.id)}">${escapeHtml(`${levelTitle(level)}${meta}`)}</option>`;
    })
    .join("");
  els.levelSelect.value = state.selectedLevelId || state.data.levels[0]?.id || "";
}

function kv(label, value) {
  return `<div class="kv"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

function renderActionLines(actions) {
  if (!actions?.length) return `<div class="empty">No action slots are populated.</div>`;
  return `<div class="code-list">${actions
    .map((action) => {
      const extra = action.extracode ? ` EDCD [${action.extracode.join(", ")}]` : "";
      const links = action.links?.length ? ` -> ${action.links.map((link) => `${link.kind || link.type} ${link.id}`).join(", ")}` : "";
      const questClass = action.category?.startsWith("quest") ? "quest" : action.category;
      return `<div class="code-line ${escapeHtml(questClass)}">slot ${action.slot}: ${action.rawCode}/${action.id} ${escapeHtml(action.label)}${escapeHtml(extra)}${escapeHtml(links)}</div>`;
    })
    .join("")}</div>`;
}

function recordById(groupKey, id) {
  const records = state.data?.records?.[groupKey]?.records || [];
  return records.find((record) => record.id === id) || null;
}

function recordGroupName(groupKey, kind = null) {
  if (groupKey === "strings") return "Message";
  if (groupKey === "battles") return "Battle";
  if (groupKey === "shops") return "Shop";
  if (groupKey === "treasure") return "Treasure";
  if (groupKey === "time") return "Timed encounter";
  if (groupKey === "maps") return "Map";
  if (groupKey === "encounter") return `${kind === "complex" ? "Complex" : "Simple"} encounter`;
  if (groupKey === "extracode") return "Action data";
  return groupKey || "Record";
}

function encounterById(kind, id) {
  return state.data?.encounters?.[kind]?.find((record) => record.id === id) || null;
}

function textPreview(id) {
  const record = recordById("strings", id);
  return record?.preview ? `: "${record.preview}"` : "";
}

function encounterPreview(kind, id) {
  const encounter = encounterById(kind, id);
  const text = encounter?.text?.find(Boolean);
  return text ? `: "${text.slice(0, 96)}${text.length > 96 ? "..." : ""}"` : "";
}

function battlePreview(id) {
  const battle = recordById("battles", id);
  if (!battle) return "";
  const monsters = battle.monsters?.length ? `, monsters ${battle.monsters.join(", ")}` : "";
  return ` (${battle.monsterSlots || 0} occupied slots${monsters})`;
}

function treasurePreview(id) {
  const treasure = recordById("treasure", id);
  if (!treasure) return "";
  return ` (${treasure.gold || 0} gold, ${treasure.gems || 0} gems, ${treasure.itemCount || 0} item slots)`;
}

function shopPreview(id) {
  const shop = recordById("shops", id);
  if (!shop) return "";
  return ` (${shop.itemCount || 0} items, inflation ${shop.inflation ?? "-"})`;
}

function mapRecordTitle(id) {
  const map = recordById("maps", id);
  return map?.name ? `Map ${id}: ${map.name}` : `Map ${id}`;
}

function mapPreview(id) {
  const map = recordById("maps", id);
  if (!map) return "";
  const name = map.name ? `: ${map.name}` : "";
  const note = map.note ? `: ${map.note.slice(0, 80)}${map.note.length > 80 ? "..." : ""}` : "";
  return `${name} (${map.isDungeon ? "dungeon" : "land"} level ${map.level}${note})`;
}

function recordButtonTitle(groupKey, kind, id) {
  if (groupKey === "maps") return mapRecordTitle(id);
  return `${recordGroupName(groupKey, kind)} ${id}`;
}

function linkSummary(link) {
  if (!link) return "";
  if (link.type === "macro") return `${link.role || "branches"} to macro ${link.id}`;
  if (link.type === "extracode") return `uses action-data row ${link.id}`;
  if (link.type === "encounter") return `${link.role || "opens"} ${link.kind} encounter ${link.id}${encounterPreview(link.kind, link.id)}`;
  if (link.type === "text") return `${link.role || "shows message"} ${link.id}${textPreview(link.id)}`;
  if (link.type === "battle") return `${link.role || "starts battle"} ${link.id}${battlePreview(link.id)}`;
  if (link.type === "shop") return `${link.role || "opens shop"} ${link.id}${shopPreview(link.id)}`;
  if (link.type === "treasure") return `${link.role || "uses treasure"} ${link.id}${treasurePreview(link.id)}`;
  if (link.type === "time") return `${link.role || "uses timed encounter"} ${link.id}`;
  if (link.type === "map") return `${link.role || "uses map"} ${link.id}${mapPreview(link.id)}`;
  if (link.type === "level") return `${link.role || "uses level"} ${link.levelType || "level"} ${link.id}`;
  if (link.type === "flow") return link.role || "changes script flow";
  return `${link.kind || link.type || "link"} ${link.id ?? ""}`.trim();
}

function linkedRecordsForAction(action) {
  const links = [];
  const add = (groupKey, id, options = {}) => {
    if (!Number.isFinite(id)) return;
    const key = `${groupKey}:${options.kind || ""}:${id}`;
    if (links.some((entry) => entry.key === key)) return;
    links.push({ key, groupKey, id, ...options });
  };

  if (action.code === 1) add("strings", action.id);
  if ([2, 48, 56, 107].includes(action.code) && !action.extracode) add("battles", action.id);
  if (action.code === 4) add("encounter", action.id, { kind: "simple" });
  if (action.code === 5) add("encounter", action.id, { kind: "complex" });
  if (action.code === 6) add("shops", action.id);
  if (action.code === 10) add("treasure", action.id);
  if (action.code === 29) add("maps", action.id);
  if (action.code === 7 || action.extracode) add("extracode", action.id);

  for (const link of action.links || []) {
    if (link.type === "encounter") add("encounter", link.id, { kind: link.kind });
    if (link.type === "extracode") add("extracode", link.id);
    if (link.type === "text") add("strings", link.id);
    if (link.type === "battle") add("battles", link.id);
    if (link.type === "shop") add("shops", link.id);
    if (link.type === "treasure") add("treasure", link.id);
    if (link.type === "time") add("time", link.id);
    if (link.type === "map") add("maps", link.id);
  }

  return links;
}

function linkedRecordSummary(link) {
  if (link.groupKey === "strings") {
    const record = recordById("strings", link.id);
    return record?.preview || "Message text was not decoded.";
  }
  if (link.groupKey === "encounter") {
    const encounter = encounterById(link.kind, link.id);
    return encounter?.text?.filter(Boolean).slice(0, 2).join(" | ") || "Encounter record.";
  }
  if (link.groupKey === "battles") return battlePreview(link.id).replace(/^\s*[()]/, "").replace(/[)]$/, "") || "Battle record.";
  if (link.groupKey === "shops") return shopPreview(link.id).replace(/^\s*[()]/, "").replace(/[)]$/, "") || "Shop inventory record.";
  if (link.groupKey === "treasure") return treasurePreview(link.id).replace(/^\s*[()]/, "").replace(/[)]$/, "") || "Treasure record.";
  if (link.groupKey === "time") {
    const record = recordById("time", link.id);
    return record ? `day ${record.day}, percent ${record.percent}, door ${record.door}` : "Timed encounter record.";
  }
  if (link.groupKey === "maps") {
    const map = recordById("maps", link.id);
    if (!map) return "Map record.";
    const parts = [
      `${map.isDungeon ? "dungeon" : "land"} level ${map.level}`,
      map.note || "",
    ].filter(Boolean);
    return parts.join(" | ");
  }
  if (link.groupKey === "extracode") {
    const row = state.data?.extracodes?.find((entry) => entry.id === link.id);
    return row ? row.values.join(", ") : "Action-data row was not decoded.";
  }
  return "";
}

function renderLinkedRecordButtons(actions) {
  const links = [];
  for (const action of actions || []) {
    for (const link of linkedRecordsForAction(action)) {
      if (!links.some((entry) => entry.key === link.key)) {
        links.push({ ...link, action });
      }
    }
  }
  if (!links.length) return `<div class="empty">No linked records were decoded from these actions.</div>`;
  return `<div class="list">${links.map((link) => `
    <button class="row-button" data-record-group="${escapeHtml(link.groupKey)}" data-record-kind="${escapeHtml(link.kind || "")}" data-record-id="${escapeHtml(link.id)}">
      <span class="row-title"><strong>${escapeHtml(recordButtonTitle(link.groupKey, link.kind, link.id))}</strong><span>slot ${escapeHtml(link.action.slot)}</span></span>
      <span class="row-meta">${escapeHtml(linkedRecordSummary(link))}</span>
    </button>
  `).join("")}</div>`;
}

function wireRecordLinkButtons(root, context = {}) {
  for (const button of root.querySelectorAll("[data-record-group][data-record-id]")) {
    button.addEventListener("click", () => {
      selectItem("record", {
        groupKey: button.dataset.recordGroup,
        kind: button.dataset.recordKind || null,
        id: Number(button.dataset.recordId),
        ...context,
      });
    });
  }
}

function actionSummary(action) {
  const code = action.code;
  if (action.extracodeUsage?.summary) return action.extracodeUsage.summary;
  if (code === 1) return `Shows message ${action.id}${textPreview(action.id)}`;
  if (code === 2) return `Starts battle ${action.id}${battlePreview(action.id)}`;
  if (code === 3) return `Presents a player choice and follows the matching branch.`;
  if (code === 4) return `Opens simple encounter ${action.id}${encounterPreview("simple", action.id)}`;
  if (code === 5) return `Opens complex encounter ${action.id}${encounterPreview("complex", action.id)}`;
  if (code === 6) return `Opens shop ${action.id}${shopPreview(action.id)}`;
  if (code === 7) return `Uses action-data row ${action.id} to branch, replace an encounter result, or jump to another script.`;
  if (code === 8) return `Reuses the actions from another trigger.`;
  if (code === 10) return `Gives treasure ${action.id}${treasurePreview(action.id)}`;
  if (code === 12) return `Changes a land icon or terrain value to ${action.id}.`;
  if (code === 13) return `Enables or disables another trigger.`;
  if (code === 20 || code === 45) return `Moves the party to another map position.`;
  if (code === 21) return `Branches based on whether the party has item ${action.id}.`;
  if (code === 23 || code === -23) return `Changes a random encounter rectangle.`;
  if (code === 24) return `Keeps this trigger's action list active after it runs.`;
  if (code === 25) return `Removes a trigger or door from the map.`;
  if (code === 29) return `Gives or displays map ${action.id}${mapPreview(action.id)}`;
  if (code === 37) return `Moves the party within a dungeon.`;
  if (code === 39) return `Extends this trigger with actions from macro ${action.id}.`;
  if (code === 40) return `Branches based on a party condition.`;
  if (code === 41) return `Disables a simple encounter option.`;
  if (code === 42) return `Branches based on a percent chance.`;
  if (code === 46) return `Checks quest flag ${action.extracode?.[0] ?? action.id} and branches from the result.`;
  if (code === 47) return `Sets quest flag ${Math.abs(action.id)}.`;
  if (code === 48 || code === 107) return `Starts selective battle ${action.id}${battlePreview(action.id)}`;
  if (code === 54) return `Changes a timed encounter.`;
  if (code === 56) return `Branches based on a battle outcome.`;
  if (code === 57) return `Changes the level's land look to ${action.id}.`;
  if (code === 59) return `Branches based on the tile at a map position.`;
  if (code === 61) return `Shifts the party to another level or coordinate.`;
  if (code === 63) return `Changes the in-game clock.`;
  if (code === 64) return `Branches based on the in-game clock.`;
  if (code === 66) return `Enables or disables camping.`;
  if (code === 70) return `Saves or restores the party position.`;
  if (code === 72) return `Checks quest flags ${action.extracode?.[0] ?? "?"} to ${action.extracode?.[1] ?? "?"} and branches from the range result.`;
  if (code === 73) return `Opens shop ${action.id} with restricted items${shopPreview(action.id)}`;
  if (code === 75) return `Branches based on spell points.`;
  if (code === 76) return `Changes quest value ${action.extracode?.[0] ?? action.id} and may branch from the new value.`;
  if (code === 77) return `Checks quest value ${action.extracode?.[0] ?? action.id} and branches from the result.`;
  if (code === 78) return `Branches based on tile parameters.`;
  if (code === 81) return `Branches based on a player-character condition.`;
  if (code === 85) return `Branches to a random trigger.`;
  if (code === 86) return `Branches based on a miscellaneous scenario condition.`;
  if (code === 87) return `Branches based on allies in the party.`;
  if (code === 88) return `Removes allies from the party.`;
  if (code === 89) return `Adds allies to the party.`;
  if (code === 92) return `Changes the size of a random encounter rectangle.`;
  if (code === 97) return `Allows the full map to be viewed.`;
  if (code === 103) return `Checks or changes boat/camp status.`;
  if (code === 106) return `Changes whether the level is dark.`;
  if (code === 111) return `Returns from a subroutine-like script jump.`;
  if (code === 112) return `Pops the script stack.`;
  if (code === 124) return `Spawns a combatant or combat event.`;
  if (code === 126) return `Runs battle macro ${action.id}.`;
  return action.label ? `${action.label} (${action.id})` : `Runs opcode ${action.rawCode}/${action.id}.`;
}

function renderSemanticActions(actions) {
  if (!actions?.length) return `<div class="empty">This trigger has no populated action slots.</div>`;
  return `<div class="semantic-list">${actions.map((action) => {
    const links = (action.links || []).map(linkSummary).filter(Boolean);
    const extra = action.extracodeUsage?.fields?.length
      ? `Action data: ${action.extracodeUsage.fields.map((entry) => `${entry.label} ${entry.value}`).join("; ")}`
      : action.extracode ? `Action data: ${action.extracode.join(", ")}` : "";
    const meta = [extra, ...links].filter(Boolean).join(" | ");
    const questClass = action.category?.startsWith("quest") ? "quest" : action.category;
    return `
      <div class="semantic-line ${escapeHtml(questClass || "")}">
        <div class="semantic-title">${escapeHtml(actionSummary(action))}</div>
        <div class="semantic-meta">slot ${escapeHtml(action.slot)} | opcode ${escapeHtml(action.rawCode)} | id ${escapeHtml(action.id)}${meta ? ` | ${escapeHtml(meta)}` : ""}</div>
      </div>
    `;
  }).join("")}</div>`;
}

function actionCategoryName(category) {
  if (!category) return "";
  if (category.startsWith("quest")) return "quest state";
  if (category === "combat") return "battle";
  if (category === "ui_text") return "message";
  if (category === "item_shop") return "items/shop";
  if (category === "map") return "map";
  if (category === "branch") return "branching";
  if (category === "flow") return "script flow";
  if (category === "time") return "time";
  if (category === "state") return "party/scenario state";
  return category.replaceAll("_", " ");
}

function randomFollowups(rect) {
  if (!rect) return [];
  return rect.randDoor
    .map((recordIndex, slot) => ({ recordIndex, percent: rect.randDoorPercent[slot], slot }))
    .filter((entry) => entry.recordIndex);
}

function renderRandomFollowups(rect) {
  const followups = randomFollowups(rect);
  if (!followups.length) return `<div class="empty">No scripted random follow-up triggers are listed.</div>`;
  return `<div class="semantic-list">${followups.map((entry) => {
    const door = state.data?.doors?.find((candidate) =>
      candidate.levelType === rect.levelType &&
      candidate.levelIndex === rect.levelIndex &&
      candidate.recordIndex === entry.recordIndex
    );
    const actions = door ? actionsForDoor(door) : [];
    const overlay = door ? state.data.overlayBoxes?.find((box) => box.recordRef === door.id) : null;
    const definition = categoryDefinition(overlay?.category);
    return `
      <div class="semantic-line">
        <div class="semantic-title">${escapeHtml(definition.name)} ${escapeHtml(entry.recordIndex)}${entry.percent ? ` (${escapeHtml(entry.percent)}%)` : ""}</div>
        <div class="semantic-meta">${escapeHtml(actions.length ? actions.map(actionSummary).slice(0, 2).join(" | ") : "No matching trigger record decoded on this level.")}</div>
      </div>
    `;
  }).join("")}</div>`;
}

function renderRecordDetail(selected) {
  const { groupKey, kind, id } = selected.item;
  const title = recordButtonTitle(groupKey, kind, id);
  let body = "";

  if (groupKey === "strings") {
    const record = recordById("strings", id);
    body = record ? `
      ${kv("source", "Data SD2")}
      ${kv("length", record.length)}
      <div class="record-text">${escapeHtml(record.text || "")}</div>
    ` : `<div class="empty">Message ${escapeHtml(id)} was not decoded.</div>`;
  } else if (groupKey === "encounter") {
    const encounter = encounterById(kind, id);
    body = encounter ? `
      ${kv("source", kind === "complex" ? "Data ED2" : "Data ED")}
      ${kv("can back out", encounter.canBackOut ? "yes" : "no")}
      ${kv("max times", encounter.maxTimes)}
      ${Number.isFinite(encounter.prompt) ? kv("prompt", encounter.prompt) : ""}
      <div class="record-text">${escapeHtml(encounter.text?.filter(Boolean).join("\n\n") || "")}</div>
    ` : `<div class="empty">${escapeHtml(title)} was not decoded.</div>`;
  } else if (groupKey === "battles") {
    const record = recordById("battles", id);
    body = record ? `
      ${kv("source", "Data BD")}
      ${kv("monster slots", record.monsterSlots)}
      ${kv("monsters", record.monsters?.join(", ") || "-")}
      ${kv("message before", record.messageBefore)}
      ${kv("message after", record.messageAfter)}
      ${kv("battle macro", record.battleMacro)}
    ` : `<div class="empty">Battle ${escapeHtml(id)} was not decoded.</div>`;
  } else if (groupKey === "shops") {
    const record = recordById("shops", id);
    body = record ? `
      ${kv("source", "Data SD")}
      ${kv("items", record.itemCount)}
      ${kv("quantity slots", record.quantitySlots)}
      ${kv("inflation", record.inflation)}
      ${kv("sample items", record.sampleItems?.join(", ") || "-")}
    ` : `<div class="empty">Shop ${escapeHtml(id)} was not decoded.</div>`;
  } else if (groupKey === "treasure") {
    const record = recordById("treasure", id);
    body = record ? `
      ${kv("source", "Data TD")}
      ${kv("items", record.itemCount)}
      ${kv("sample items", record.sampleItems?.join(", ") || "-")}
      ${kv("experience", record.exp)}
      ${kv("gold", record.gold)}
      ${kv("gems", record.gems)}
      ${kv("jewelry", record.jewelry)}
    ` : `<div class="empty">Treasure ${escapeHtml(id)} was not decoded.</div>`;
  } else if (groupKey === "time") {
    const record = recordById("time", id);
    body = record ? `
      ${kv("source", "Data TD3")}
      ${kv("day", record.day)}
      ${kv("increment", record.increment)}
      ${kv("percent", record.percent)}
      ${kv("door", record.door)}
      ${kv("level", record.level)}
      ${kv("rect", record.rect)}
      ${kv("position", `${record.x}, ${record.y}`)}
      ${kv("item", record.item)}
      ${kv("quest", record.quest)}
    ` : `<div class="empty">Timed encounter ${escapeHtml(id)} was not decoded.</div>`;
  } else if (groupKey === "maps") {
    const record = recordById("maps", id);
    body = record ? `
      ${kv("source", "Data MD2")}
      ${record.name ? kv("name", record.name) : ""}
      ${record.name ? kv("name source", record.nameSource || "Scenario resource") : ""}
      ${kv("level", `${record.isDungeon ? "dungeon" : "land"} ${record.level}`)}
      ${kv("start", `${record.startX}, ${record.startY}`)}
      ${kv("picture", record.pictId)}
      ${kv("show", record.show)}
      <div class="record-text">${escapeHtml(record.note || "")}</div>
    ` : `<div class="empty">Map ${escapeHtml(id)} was not decoded.</div>`;
  } else if (groupKey === "extracode") {
    const record = state.data?.extracodes?.find((entry) => entry.id === id);
    body = record ? `
      ${kv("source", "Data EDCD")}
      ${kv("values", record.values.join(", "))}
    ` : `<div class="empty">Action-data row ${escapeHtml(id)} was not decoded.</div>`;
  } else {
    body = `<div class="empty">No detail view exists for this record type yet.</div>`;
  }

  els.selectionPanel.innerHTML = `
    <div class="section">
      <h3>${escapeHtml(title)}</h3>
      ${body}
    </div>
    ${selected.item.sourceOverlay ? `
      <div class="section">
        <button class="row-button" data-back-overlay="1">
          <span class="row-title"><strong>Back to trigger</strong><span>${escapeHtml(boxTitle(selected.item.sourceOverlay.box))}</span></span>
        </button>
      </div>
    ` : ""}
  `;
  const back = els.selectionPanel.querySelector("[data-back-overlay]");
  if (back) {
    back.addEventListener("click", () => selectItem("overlay", selected.item.sourceOverlay));
  }
}

function renderSelectionPanel() {
  const selected = state.selectedItem;
  const level = currentLevel();
  if (!state.data) {
    els.selectionPanel.innerHTML = `<div class="empty">Load a scenario folder to inspect maps, actions, encounters, and quest flag links.</div>`;
    return;
  }
  if (!selected) {
    const rand = randLevelFor(level);
    const doors = doorsFor(level);
    const questDoors = doors.filter(isQuestDoor).length;
    const encounterDoors = doors.filter(isEncounterDoor).length;
    const overlays = overlayForLevel(level);
    els.selectionPanel.innerHTML = `
      <div class="section">
        <h3>${escapeHtml(levelTitle(level, { long: true }))}</h3>
        ${kv("source", level?.source || "-")}
        ${level?.nameSource ? kv("name source", level.nameSource) : ""}
        ${level?.nameHints?.length ? kv("map name hints", level.nameHints.map((hint) => hint.name).slice(0, 5).join(" / ")) : ""}
        ${kv("tiles", level ? `${level.width} x ${level.height}` : "-")}
        ${kv("tile range", level ? `${level.min} to ${level.max}` : "-")}
        ${kv("landlook metadata", rand ? rand.landlook : "-")}
        ${kv("render tileset", level ? renderTilesetLabel(level) : "-")}
        ${level?.renderTilesetSource ? kv("render source", level.renderTilesetSource) : ""}
        ${kv(isDungeonTopdownLevel(level) ? "render art" : "tile atlas", level ? atlasStatusForLevel(level) : "-")}
        ${kv("dark/LOS", rand ? `${rand.isdark ? "dark" : "lit"} / ${rand.uselos ? "LOS" : "no LOS"}` : "-")}
        ${kv("triggers", doors.length)}
        ${kv("overlay boxes", overlays.length)}
        ${kv("quest points", questDoors)}
        ${kv("encounter points", encounterDoors)}
      </div>
      <div class="section">
        <h3>Dominant Tiles</h3>
        <div class="list">${(level?.topTiles || []).map((tile) => `<div class="row-meta">tile ${tile.tile}: ${tile.count}</div>`).join("")}</div>
      </div>
    `;
    return;
  }

  if (selected.type === "record") {
    renderRecordDetail(selected);
    return;
  }

  if (selected.type === "overlay") {
    const box = selected.item.box || selected.item;
    const door = selected.item.door || (box.category === "random" ? null : doorByRecordRef(box.recordRef));
    const random = selected.item.random || randLevelFor(level)?.rects.find((rect) => rect.id === box.recordRef) || null;
    const definition = categoryDefinition(box.category);
    const actions = door ? actionsForDoor(door) : [];
    const actionCategories = [...new Set(actions.map((action) => actionCategoryName(action.category)).filter(Boolean))];
    const destination = doorDestinationLabel(door);
    els.selectionPanel.innerHTML = `
      <div class="section">
        <h3>${escapeHtml(definition.name)}${box.label ? ` ${escapeHtml(box.label)}` : ""}</h3>
        <div class="semantic-summary">${escapeHtml(definition.summary)}</div>
        ${kv("location", `${box.levelType} ${box.levelIndex}, ${formatBounds(box.bounds)}`)}
        ${destination ? kv("destination", destination) : ""}
        ${kv("source", box.source || "-")}
        ${kv("record", recordShortId(box.recordRef))}
        ${kv("selection", box.bounds.width > 1.2 || box.bounds.height > 1.2 ? "area" : "single tile")}
      </div>
      ${random ? `
        <div class="section">
          <h3>What It Does</h3>
          ${kv("roll chance", random.percent ? `${random.percent}% while in this area` : "no percent roll decoded")}
          ${kv("battle range", random.battleRange?.some(Boolean) ? random.battleRange.join(" to ") : "-")}
          ${kv("repeat rule", `${random.only ? "only once/limited" : "can repeat"}${random.option ? `, option ${random.option}` : ""}`)}
          ${kv("message", random.text ? `text ${random.text}${textPreview(random.text)}` : "-")}
          ${kv("sound", random.sound || "-")}
        </div>
        <div class="section">
          <h3>Scripted Follow-Ups</h3>
          ${renderRandomFollowups(random)}
        </div>
      ` : ""}
      ${door ? `
        <div class="section">
          <h3>What It Does</h3>
          ${kv("activation", door.percent ? `${door.percent}% chance` : "always or scenario-defined")}
          ${kv("script shape", actionCategories.length ? actionCategories.join(", ") : "no decoded action category")}
          ${kv("trigger", sourceLabel(door))}
          ${renderSemanticActions(actions)}
        </div>
        <div class="section">
          <h3>Linked Records</h3>
          ${renderLinkedRecordButtons(actions)}
        </div>
        <div class="section">
          <h3>Raw Action Slots</h3>
          ${renderActionLines(actions)}
        </div>
      ` : ""}
      ${!door && !random ? `
        <div class="section">
          <h3>What It Does</h3>
          <div class="empty">This box is visible, but no related trigger or random-area record was decoded for it yet.</div>
        </div>
      ` : ""}
      ${selected.item.alternateBoxes?.length ? `
        <div class="section">
          <h3>Other Boxes Here</h3>
          <div class="semantic-summary">The click selected the smallest matching box. These larger boxes also cover the same tile.</div>
          <div class="list">
            ${selected.item.alternateBoxes.map((otherBox) => {
              const otherDefinition = categoryDefinition(otherBox.category);
              return `
                <button class="row-button" data-overlay-id="${escapeHtml(otherBox.id)}">
                  <span class="row-title"><strong>${escapeHtml(boxTitle(otherBox))}</strong><span>${escapeHtml(otherDefinition.shortName)}</span></span>
                  <span class="row-meta">${escapeHtml(formatBounds(otherBox.bounds))}</span>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      ` : ""}
    `;
    wireRecordLinkButtons(els.selectionPanel, { sourceOverlay: selected.item });
    for (const button of els.selectionPanel.querySelectorAll("[data-overlay-id]")) {
      button.addEventListener("click", () => {
        const boxAtPoint = selected.item.allBoxesAtPoint?.find((entry) => entry.id === button.dataset.overlayId)
          || selected.item.alternateBoxes?.find((entry) => entry.id === button.dataset.overlayId);
        selectOverlayBox(boxAtPoint, {
          point: selected.item.point,
          alternateBoxes: (selected.item.allBoxesAtPoint || []).filter((entry) => entry.id !== boxAtPoint?.id),
          allBoxesAtPoint: selected.item.allBoxesAtPoint,
        });
      });
    }
    return;
  }

  if (selected.type === "door") {
    const door = selected.item;
    els.selectionPanel.innerHTML = `
      <div class="section">
        <h3>Trigger ${escapeHtml(sourceLabel(door))}</h3>
        ${kv("position", `${door.levelType} ${door.levelIndex} (${door.x}, ${door.y})`)}
        ${kv("doorid", door.doorid)}
        ${kv("percent", door.percent)}
        ${kv("source", door.source)}
      </div>
      <div class="section">
        <h3>Actions</h3>
        ${renderActionLines(door.actions)}
      </div>
    `;
    return;
  }

  if (selected.type === "random") {
    const rect = selected.item;
    els.selectionPanel.innerHTML = `
      <div class="section">
        <h3>Random Area ${rect.rectIndex}</h3>
        ${kv("level", `${rect.levelType} ${rect.levelIndex}`)}
        ${kv("bounds", `left ${rect.left}, top ${rect.top}, right ${rect.right}, bottom ${rect.bottom}`)}
        ${kv("percent", rect.percent)}
        ${kv("battle range", rect.battleRange.join(" to "))}
        ${kv("doors", rect.randDoor.join(", "))}
        ${kv("door chance", rect.randDoorPercent.join(", "))}
        ${kv("only/option", `${rect.only ? "only" : "repeat"} / ${rect.option}`)}
        ${kv("sound/text", `${rect.sound} / ${rect.text}`)}
      </div>
    `;
  }
}

function renderScriptPanel() {
  if (!state.data) {
    els.scriptPanel.innerHTML = `<div class="empty">No scenario loaded.</div>`;
    return;
  }
  const graph = state.data.scriptGraph || state.data.graph;
  const node = scriptNodeById(state.selectedScriptNode) || scriptNodeById(state.selectedItem?.item?.nodeId);
  if (!node) {
    const currentBoxes = overlayForLevel(currentLevel()).filter((box) => box.nodeId);
    els.scriptPanel.innerHTML = `
      <div class="section">
        <h3>Script Graph</h3>
        ${kv("nodes", graph.nodes?.length ?? 0)}
        ${kv("edges", graph.edges?.length ?? 0)}
        ${kv("unresolved refs", graph.unresolvedRefs?.length ?? 0)}
      </div>
      <div class="section">
        <h3>Visible Triggers</h3>
        <div class="list">
          ${currentBoxes.slice(0, 80).map((box) => `
            <button class="row-button" data-node="${escapeHtml(box.nodeId)}">
              <span class="row-title"><strong>${escapeHtml(box.label || box.category)}</strong><span>${escapeHtml(box.category)}</span></span>
              <span class="row-meta">${escapeHtml(box.recordRef)} at ${box.bounds.left + 0.5},${box.bounds.top + 0.5}</span>
            </button>
          `).join("") || `<div class="empty">No script-backed boxes on this level.</div>`}
        </div>
      </div>
    `;
  } else {
    const outgoing = (graph.edges || []).filter((edge) => edge.from === node.id);
    const incoming = (graph.edges || []).filter((edge) => edge.to === node.id).slice(0, 24);
    const door = doorByRecordRef(node.recordRef);
    const actions = door ? actionsForDoor(door) : [];
    els.scriptPanel.innerHTML = `
      <div class="section">
        <h3>${escapeHtml(node.label || node.id)}</h3>
        ${kv("type", node.type)}
        ${kv("source", node.source || "-")}
        ${node.levelType ? kv("map", `${node.levelType} ${node.levelIndex} (${node.x}, ${node.y})`) : ""}
        ${node.values ? kv("values", `[${node.values.join(", ")}]`) : ""}
      </div>
      ${actions.length ? `<div class="section"><h3>Action List</h3>${renderActionLines(actions)}</div>` : ""}
      <div class="section">
        <h3>Outgoing Links</h3>
        <div class="list">
          ${outgoing.map((edge) => {
            const target = scriptNodeById(edge.to);
            return `
              <button class="row-button" data-node="${escapeHtml(edge.to)}">
                <span class="row-title"><strong>${escapeHtml(edge.kind)}</strong><span>${escapeHtml(edge.code ?? "")}/${escapeHtml(edge.actionId ?? "")}</span></span>
                <span class="row-meta">${escapeHtml(target?.label || edge.to)}</span>
              </button>
            `;
          }).join("") || `<div class="empty">No decoded downstream links.</div>`}
        </div>
      </div>
      <div class="section">
        <h3>Incoming Links</h3>
        <div class="list">
          ${incoming.map((edge) => `
            <button class="row-button" data-node="${escapeHtml(edge.from)}">
              <span class="row-title"><strong>${escapeHtml(edge.kind)}</strong><span>${escapeHtml(edge.code ?? "")}/${escapeHtml(edge.actionId ?? "")}</span></span>
              <span class="row-meta">${escapeHtml(scriptNodeById(edge.from)?.label || edge.from)}</span>
            </button>
          `).join("") || `<div class="empty">No decoded incoming links.</div>`}
        </div>
      </div>
    `;
  }

  for (const button of els.scriptPanel.querySelectorAll("[data-node]")) {
    button.addEventListener("click", () => selectScriptNode(button.dataset.node));
  }
}

function renderDataPanel() {
  if (!state.data) {
    els.dataPanel.innerHTML = `<div class="empty">No scenario loaded.</div>`;
    return;
  }
  const groups = Object.entries(state.data.records || {});
  els.dataPanel.innerHTML = `
    <div class="section">
      <h3>Discrete Records</h3>
      <div class="list">
        ${groups.map(([key, group]) => {
          const sample = (group.records || []).slice(0, 3).map((record) => {
            const label = record.name || record.preview || record.note || record.text || record.sampleItems?.join(", ") || "";
            return `#${record.id}${label ? `: ${String(label).slice(0, 80)}` : ""}`;
          }).join(" | ");
          return `
            <button class="row-button" data-record-group="${escapeHtml(key)}">
              <span class="row-title"><strong>${escapeHtml(group.kind || key)}</strong><span>${escapeHtml(group.status)} / ${group.count}</span></span>
              <span class="row-meta">${escapeHtml(sample || `${group.recordBytes || "-"} bytes each`)}</span>
            </button>
          `;
        }).join("")}
      </div>
    </div>
    <div class="section">
      <h3>Script Risk</h3>
      <div class="list">
        ${(state.data.scriptGraph?.highRiskOpcodes || []).slice(0, 24).map((entry) => `
          <div class="code-line ${escapeHtml(entry.label?.includes("quest") ? "quest" : "branch")}">opcode ${entry.code}: ${escapeHtml(entry.label)} (${entry.count})</div>
        `).join("") || `<div class="empty">No high-risk opcode references found.</div>`}
      </div>
    </div>
  `;
}

function renderFlagsPanel() {
  if (!state.data) {
    els.flagsPanel.innerHTML = `<div class="empty">No scenario loaded.</div>`;
    return;
  }
  const flags = state.data.graph.questFlags;
  if (!flags.length) {
    els.flagsPanel.innerHTML = `<div class="empty">No quest flag references were decoded from door or macro actions.</div>`;
    return;
  }
  els.flagsPanel.innerHTML = `
    <div class="section">
      <h3>Quest Flags</h3>
      <div class="list">
        ${flags
          .map((flag) => `
            <button class="row-button ${state.highlightedQuest === flag.id ? "active" : ""}" data-flag="${flag.id}">
              <span class="row-title"><strong>Quest ${flag.id}</strong><span>${flag.writeCount} set / ${flag.readCount} read</span></span>
              <span class="row-meta">${escapeHtml(flag.locations.slice(0, 4).map((loc) => `${loc.source} ${loc.levelIndex ?? "macro"} (${loc.x},${loc.y}) ${loc.label}`).join(" | "))}</span>
            </button>
          `)
          .join("")}
      </div>
    </div>
  `;
  for (const button of els.flagsPanel.querySelectorAll("[data-flag]")) {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.flag);
      state.highlightedQuest = state.highlightedQuest === id ? null : id;
      const flag = flags.find((entry) => entry.id === id);
      const first = flag?.locations.find((loc) => loc.levelType === currentLevel()?.type && loc.levelIndex === currentLevel()?.index) || flag?.locations[0];
      if (first?.levelType && Number.isInteger(first.levelIndex)) {
        state.selectedLevelId = `${first.levelType}:${first.levelIndex}`;
      }
      state.selectedItem = null;
      state.selectedScriptNode = null;
      clearSelectionHistory();
      renderAll();
    });
  }
}

function renderFilesPanel() {
  if (!state.data) {
    els.filesPanel.innerHTML = `<div class="empty">No scenario loaded.</div>`;
    return;
  }
  const rows = state.data.files
    .map((file) => `
      <tr>
        <td class="${file.exists ? "" : "missing"}">${escapeHtml(file.name)}</td>
        <td>${file.exists ? file.bytes : "missing"}</td>
        <td>${escapeHtml(file.sha256 || "-")}</td>
      </tr>
    `)
    .join("");
  const alignment = Object.entries(state.data.alignment)
    .map(([key, value]) => {
      const text = value.exists ? `${value.full} full${value.trailing ? `, rem ${value.trailing}, loop ${value.loopRecords}` : ""}` : "missing";
      return `<div class="kv"><span>${escapeHtml(key)}</span><span>${escapeHtml(text)}</span></div>`;
    })
    .join("");
  els.filesPanel.innerHTML = `
    <div class="section">
      <h3>Alignment</h3>
      ${alignment}
    </div>
    <div class="section">
      <h3>Files</h3>
      <table class="file-table">
        <thead><tr><th>Name</th><th>Bytes</th><th>SHA-256</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function activeInspectorPanelName() {
  const active = document.querySelector(".panel.active");
  return active?.id?.replace(/Panel$/, "") || "selection";
}

function activateInspectorPanel(name) {
  document.querySelectorAll(".tab").forEach((entry) => entry.classList.toggle("active", entry.dataset.panel === name));
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelector(`#${name}Panel`)?.classList.add("active");
  updateInspectorNav();
}

function selectionHistoryItemKey(selectedItem) {
  if (!selectedItem) return "empty";
  const { type, item } = selectedItem;
  if (type === "overlay") return `overlay:${item.box?.id || item.id || ""}`;
  if (type === "record") return `record:${item.groupKey || ""}:${item.kind || ""}:${item.id ?? ""}:${item.sourceOverlay?.box?.id || ""}`;
  if (type === "door") return `door:${item.recordRef || item.nodeId || sourceLabel(item)}`;
  return `${type}:${JSON.stringify(item)}`;
}

function selectionSnapshotKey(snapshot) {
  return [
    snapshot.selectedLevelId || "",
    snapshot.selectedScriptNode || "",
    snapshot.panel || "",
    selectionHistoryItemKey(snapshot.selectedItem),
  ].join("|");
}

function currentSelectionSnapshot(panel = activeInspectorPanelName()) {
  return {
    selectedLevelId: state.selectedLevelId,
    selectedItem: state.selectedItem,
    selectedScriptNode: state.selectedScriptNode,
    panel,
  };
}

function updateInspectorNav() {
  if (!els.inspectorBack || !els.inspectorForward) return;
  els.inspectorBack.disabled = state.selectionHistoryIndex <= 0;
  els.inspectorForward.disabled = state.selectionHistoryIndex < 0 || state.selectionHistoryIndex >= state.selectionHistory.length - 1;
}

function clearSelectionHistory() {
  state.selectionHistory = [];
  state.selectionHistoryIndex = -1;
  updateInspectorNav();
}

function rememberSelection(panel = activeInspectorPanelName()) {
  const snapshot = currentSelectionSnapshot(panel);
  if (!snapshot.selectedItem && !snapshot.selectedScriptNode) {
    updateInspectorNav();
    return;
  }
  const current = state.selectionHistory[state.selectionHistoryIndex];
  if (current && selectionSnapshotKey(current) === selectionSnapshotKey(snapshot)) {
    updateInspectorNav();
    return;
  }
  state.selectionHistory = state.selectionHistory.slice(0, state.selectionHistoryIndex + 1);
  state.selectionHistory.push(snapshot);
  if (state.selectionHistory.length > 80) {
    state.selectionHistory.shift();
  }
  state.selectionHistoryIndex = state.selectionHistory.length - 1;
  updateInspectorNav();
}

function restoreSelectionHistory(offset) {
  const nextIndex = state.selectionHistoryIndex + offset;
  const snapshot = state.selectionHistory[nextIndex];
  if (!snapshot) return;
  state.selectionHistoryIndex = nextIndex;
  state.selectedLevelId = snapshot.selectedLevelId;
  state.selectedItem = snapshot.selectedItem;
  state.selectedScriptNode = snapshot.selectedScriptNode;
  renderLevelTabs();
  drawMap();
  renderSelectionPanel();
  renderScriptPanel();
  activateInspectorPanel(snapshot.panel || "selection");
  updateInspectorNav();
}

function selectItem(type, item, options = {}) {
  state.selectedItem = { type, item };
  if (type === "door" && item.nodeId) {
    state.selectedScriptNode = item.nodeId;
  } else if (type === "overlay" && item.box?.nodeId) {
    state.selectedScriptNode = item.box.nodeId;
  } else if (type === "record" && item.sourceOverlay?.box?.nodeId) {
    state.selectedScriptNode = item.sourceOverlay.box.nodeId;
  } else {
    state.selectedScriptNode = null;
  }
  activateInspectorPanel("selection");
  renderSelectionPanel();
  renderScriptPanel();
  renderOverlay();
  if (options.history !== false) {
    rememberSelection("selection");
  }
}

function handleMapClick(event) {
  if (event.button !== 0 || event.target.closest("button, input, label")) return;
  selectBoxesAtEvent(event);
}

function selectScriptNode(nodeId) {
  state.selectedScriptNode = nodeId;
  const node = scriptNodeById(nodeId);
  const door = node ? doorByRecordRef(node.recordRef) : null;
  if (door && Number.isInteger(door.levelIndex)) {
    state.selectedLevelId = `${door.levelType}:${door.levelIndex}`;
    state.selectedItem = { type: "door", item: { ...door, actions: actionsForDoor(door) } };
  }
  renderLevelTabs();
  drawMap();
  renderSelectionPanel();
  renderScriptPanel();
  rememberSelection(activeInspectorPanelName());
}

function renderAll() {
  renderScenarioList();
  renderHeader();
  renderLevelTabs();
  drawMap();
  renderSelectionPanel();
  renderScriptPanel();
  renderFlagsPanel();
  renderDataPanel();
  renderFilesPanel();
  updateInspectorNav();
}

async function loadScenarios() {
  const root = els.rootPath.value.trim();
  setStatus("Reading scenario folders...");
  const result = await api(`/api/scenarios?root=${encodeURIComponent(root)}`);
  state.scenarios = result.scenarios;
  if (state.scenarios.length) {
    await rememberScenarioRoot(result.root || root);
  }
  if (!state.scenarios.some((scenario) => scenario.path === state.selectedScenarioPath)) {
    state.selectedScenarioPath = null;
    state.data = null;
    state.selectedLevelId = null;
    state.selectedItem = null;
    state.selectedScriptNode = null;
    clearSelectionHistory();
  }
  setStatus(`${state.scenarios.length} scenario folders found`);
  renderScenarioList();
  if (!state.selectedScenarioPath && state.scenarios.length) {
    await loadScenario(state.scenarios[0].path);
  } else {
    renderAll();
  }
}

async function loadScenario(scenarioPath) {
  state.selectedScenarioPath = scenarioPath;
  state.selectedItem = null;
  state.selectedScriptNode = null;
  state.highlightedQuest = null;
  state.hoverTile = null;
  clearSelectionHistory();
  state.tileAtlasCache.clear();
  state.secretWalkableCache.clear();
  setStatus("Analyzing scenario...");
  renderScenarioList();
  state.data = await api(`/api/analyze?path=${encodeURIComponent(scenarioPath)}`);
  state.selectedLevelId = state.data.levels[0]?.id || null;
  setStatus(`Loaded ${state.data.scenario.name}`);
  renderAll();
}

async function importTilemaps() {
  if (!state.selectedScenarioPath) {
    return;
  }
  els.importTiles.disabled = true;
  setStatus("Importing tilemaps...");
  try {
    const result = await apiPost(`/api/asset/import-tile-atlases?scenarioPath=${encodeURIComponent(state.selectedScenarioPath)}`);
    const imported = result.results.filter((entry) => entry.available).length;
    const failed = result.results.length - imported;
    state.tileAtlasCache.clear();
    state.renderMode = "real";
    els.toggleRealTiles.checked = true;
    els.toggleDecodedColors.checked = false;
    setStatus(`Imported ${imported} tilemap${imported === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}`);
    drawMap();
  } catch (error) {
    setStatus(error.message);
  } finally {
    els.importTiles.disabled = false;
  }
}

async function locateScenariosFolder() {
  const invoke = getTauriInvoke();
  if (!invoke) {
    setStatus("Folder picker is available in the desktop launcher.");
    updateLauncherControls();
    return;
  }

  els.locateScenarios.disabled = true;
  setStatus("Locating scenarios folder...");
  try {
    const initialPath = els.rootPath.value.trim() || state.config?.defaultScenarioRoot || null;
    const selectedPath = await invoke("pick_scenarios_folder", { initialPath });
    if (selectedPath) {
      els.rootPath.value = selectedPath;
      await loadScenarios();
    } else {
      setStatus("Folder selection canceled");
    }
  } catch (error) {
    setStatus(`Unable to open folder picker: ${error.message || error}`);
  } finally {
    els.locateScenarios.disabled = false;
  }
}

function beginMapPan(event) {
  if (event.button !== 0 || event.target.closest("button, input, label")) return;
  state.pan.active = true;
  state.pan.moved = false;
  state.pan.pointerId = event.pointerId;
  state.pan.x = event.clientX;
  state.pan.y = event.clientY;
  state.pan.scrollLeft = els.mapScroller.scrollLeft;
  state.pan.scrollTop = els.mapScroller.scrollTop;
}

function moveMapPan(event) {
  if (!state.pan.active || state.pan.pointerId !== event.pointerId) return;
  const dx = event.clientX - state.pan.x;
  const dy = event.clientY - state.pan.y;
  if (!state.pan.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
    state.pan.moved = true;
    els.mapScroller.classList.add("dragging");
    els.mapScroller.setPointerCapture?.(event.pointerId);
  }
  if (state.pan.moved) {
    els.mapScroller.scrollLeft = state.pan.scrollLeft - dx;
    els.mapScroller.scrollTop = state.pan.scrollTop - dy;
    event.preventDefault();
  }
  handleMapHover(event);
}

function endMapPan(event) {
  if (!state.pan.active || state.pan.pointerId !== event.pointerId) return;
  if (state.pan.moved) {
    els.mapScroller.releasePointerCapture?.(event.pointerId);
  }
  els.mapScroller.classList.remove("dragging");
  state.pan.active = false;
  state.pan.pointerId = null;
  if (state.pan.moved) {
    state.pan.justDragged = true;
    state.pan.suppressClickUntil = Date.now() + 600;
    window.setTimeout(() => {
      state.pan.justDragged = false;
    }, 120);
  }
}

function wireEvents() {
  els.rootForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadScenarios().catch((error) => setStatus(error.message));
  });
  els.locateScenarios?.addEventListener("click", () => {
    locateScenariosFolder();
  });

  els.sidebarToggle.addEventListener("click", () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    els.app.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
    els.sidebarToggle.textContent = state.sidebarCollapsed ? ">" : "<";
    els.sidebarToggle.title = state.sidebarCollapsed ? "Expand scenarios" : "Collapse scenarios";
    els.sidebarToggle.setAttribute("aria-label", els.sidebarToggle.title);
    els.sidebarToggle.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
  });

  els.levelSelect.addEventListener("change", () => {
    state.selectedLevelId = els.levelSelect.value;
    state.selectedItem = null;
    state.selectedScriptNode = null;
    state.hoverTile = null;
    clearSelectionHistory();
    renderAll();
  });

  els.inspectorBack.addEventListener("click", () => restoreSelectionHistory(-1));
  els.inspectorForward.addEventListener("click", () => restoreSelectionHistory(1));

  for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => {
      activateInspectorPanel(tab.dataset.panel);
    });
  }

  els.toggleDoors.addEventListener("change", () => {
    state.toggles.doors = els.toggleDoors.checked;
    renderOverlay();
  });
  els.toggleRealTiles.addEventListener("change", () => {
    state.renderMode = els.toggleRealTiles.checked ? "real" : "color";
    els.toggleDecodedColors.checked = state.renderMode === "color";
    drawMap();
  });
  els.toggleDecodedColors.addEventListener("change", () => {
    state.renderMode = els.toggleDecodedColors.checked ? "color" : "real";
    els.toggleRealTiles.checked = state.renderMode === "real";
    drawMap();
  });
  els.toggleRealmzOrder.addEventListener("change", () => {
    state.useRealmzOrder = els.toggleRealmzOrder.checked;
    state.secretWalkableCache.clear();
    drawMap();
  });
  els.toggleRandom.addEventListener("change", () => {
    state.toggles.random = els.toggleRandom.checked;
    renderOverlay();
  });
  els.toggleEncounters.addEventListener("change", () => {
    state.toggles.encounters = els.toggleEncounters.checked;
    renderOverlay();
  });
  els.toggleQuest.addEventListener("change", () => {
    state.toggles.quest = els.toggleQuest.checked;
    renderOverlay();
  });
  els.toggleMapMutation.addEventListener("change", () => {
    state.toggles["map mutation"] = els.toggleMapMutation.checked;
    renderOverlay();
  });
  els.toggleBattle.addEventListener("change", () => {
    state.toggles.battle = els.toggleBattle.checked;
    renderOverlay();
  });
  els.toggleText.addEventListener("change", () => {
    state.toggles.text = els.toggleText.checked;
    renderOverlay();
  });
  els.toggleUnknown.addEventListener("change", () => {
    state.toggles.unknown = els.toggleUnknown.checked;
    renderOverlay();
  });
  els.toggleSecrets.addEventListener("change", () => {
    state.toggles.secrets = els.toggleSecrets.checked;
    renderOverlay();
  });
  els.importTiles.addEventListener("click", () => {
    importTilemaps();
  });
  els.exportMap?.addEventListener("click", () => {
    exportCurrentMap();
  });
  els.zoom.addEventListener("input", () => {
    state.zoom = Number(els.zoom.value);
    drawMap();
  });
  els.mapScroller.addEventListener("pointerdown", beginMapPan);
  els.mapStage.addEventListener("click", handleMapClick);
  els.mapScroller.addEventListener("pointermove", (event) => {
    if (state.pan.active) {
      moveMapPan(event);
    } else {
      handleMapHover(event);
    }
  });
  els.mapScroller.addEventListener("pointerup", endMapPan);
  els.mapScroller.addEventListener("pointercancel", endMapPan);
  els.mapScroller.addEventListener("mouseleave", () => {
    if (!state.pan.active) {
      state.hoverTile = null;
      renderMapHud();
    }
  });
}

async function init() {
  wireEvents();
  updateLauncherControls();
  window.setTimeout(updateLauncherControls, 250);
  state.config = await api("/api/config");
  els.rootPath.value = state.config.defaultScenarioRoot;
  await loadScenarios();
}

init().catch((error) => {
  console.error(error);
  setStatus(error.message);
});
