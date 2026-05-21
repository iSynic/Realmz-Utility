const state = {
  config: null,
  scenarios: [],
  data: null,
  schemaIndex: null,
  scenarioFolderInitialPath: "",
  selectedScenarioPath: null,
  selectedLevelId: null,
  selectedItem: null,
  selectedScriptNode: null,
  selectionHistory: [],
  selectionHistoryIndex: -1,
  sidebarCollapsed: false,
  layout: {
    explorerWidth: 320,
    inspectorWidth: 390,
  },
  highlightedQuest: null,
  hoverTile: null,
  renderMode: "real",
  useRealmzOrder: true,
  overlayBucketOpen: {},
  tileAtlasCache: new Map(),
  iconCache: new Map(),
  pictureCache: new Map(),
  secretWalkableCache: new Map(),
  zoom: 8,
  projectSearch: {
    open: false,
    query: "",
    activeIndex: 0,
    results: [],
    pageQuery: "",
  },
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
  scenarioTitle: document.querySelector("#scenarioTitle"),
  app: document.querySelector("#app"),
  sidebarToggle: document.querySelector("#sidebarToggle"),
  explorerResizer: document.querySelector("#explorerResizer"),
  inspectorResizer: document.querySelector("#inspectorResizer"),
  levelSelect: document.querySelector("#levelSelect"),
  mapStage: document.querySelector("#mapStage"),
  mapScroller: document.querySelector("#mapScroller"),
  mapCanvas: document.querySelector("#mapCanvas"),
  overlaySvg: document.querySelector("#overlaySvg"),
  tileStatus: document.querySelector("#tileStatus"),
  mapHud: document.querySelector("#mapHud"),
  selectionPanel: document.querySelector("#detailPanel"),
  explorerSelectionPanel: document.querySelector("#explorerSelectionPanel"),
  scriptPanel: document.querySelector("#scriptPanel"),
  flagsPanel: document.querySelector("#flagsPanel"),
  dataPanel: document.querySelector("#dataPanel"),
  decodingPanel: document.querySelector("#decodingPanel"),
  searchPanel: document.querySelector("#searchPanel"),
  filesPanel: document.querySelector("#filesPanel"),
  inspectorBack: document.querySelector("#inspectorBack"),
  inspectorForward: document.querySelector("#inspectorForward"),
  toggleRealTiles: document.querySelector("#toggleRealTiles"),
  toggleDoors: document.querySelector("#toggleDoors"),
  toggleRandom: document.querySelector("#toggleRandom"),
  toggleEncounters: document.querySelector("#toggleEncounters"),
  toggleQuest: document.querySelector("#toggleQuest"),
  toggleMapMutation: document.querySelector("#toggleMapMutation"),
  toggleBattle: document.querySelector("#toggleBattle"),
  toggleText: document.querySelector("#toggleText"),
  toggleUnknown: document.querySelector("#toggleUnknown"),
  toggleSecrets: document.querySelector("#toggleSecrets"),
  overlayFilterButton: document.querySelector("#overlayFilterButton"),
  overlayFilterCount: document.querySelector("#overlayFilterCount"),
  overlayFilterMenu: document.querySelector("#overlayFilterMenu"),
  overlayFilterClose: document.querySelector("#overlayFilterClose"),
  overlayShowAll: document.querySelector("#overlayShowAll"),
  overlayHideAll: document.querySelector("#overlayHideAll"),
  overlayOnlySecrets: document.querySelector("#overlayOnlySecrets"),
  importTiles: document.querySelector("#importTiles"),
  exportMap: document.querySelector("#exportMap"),
  zoom: document.querySelector("#zoom"),
  zoomValue: document.querySelector("#zoomValue"),
  projectSearchLauncher: document.querySelector("#projectSearchLauncher"),
  projectSearchOverlay: document.querySelector("#projectSearchOverlay"),
  projectSearchInput: document.querySelector("#projectSearchInput"),
  projectSearchResults: document.querySelector("#projectSearchResults"),
  projectSearchSubtitle: document.querySelector("#projectSearchSubtitle"),
  projectSearchFooter: document.querySelector("#projectSearchFooter"),
};

function setStatus(text) {
  els.status.textContent = text;
}

function getTauriInvoke() {
  return window.__TAURI__?.core?.invoke || window.__TAURI__?.tauri?.invoke || window.__TAURI_INTERNALS__?.invoke || null;
}

function updateLauncherControls() {
  const hasDesktopBridge = Boolean(getTauriInvoke());
  if (els.locateScenarios) {
    els.locateScenarios.hidden = false;
    els.locateScenarios.title = hasDesktopBridge ? "Choose scenario folder" : "Choose scenario folder from filesystem";
  }
  if (els.exportMap) {
    els.exportMap.hidden = !hasDesktopBridge;
  }
}

function overlayToggleInputs() {
  return [
    els.toggleDoors,
    els.toggleRandom,
    els.toggleEncounters,
    els.toggleQuest,
    els.toggleMapMutation,
    els.toggleBattle,
    els.toggleText,
    els.toggleUnknown,
    els.toggleSecrets,
  ].filter(Boolean);
}

function updateOverlayFilterSummary() {
  const inputs = overlayToggleInputs();
  const active = inputs.filter((input) => input.checked).length;
  if (els.overlayFilterCount) {
    els.overlayFilterCount.textContent = `${active}/${inputs.length}`;
  }
  if (els.overlayFilterButton) {
    els.overlayFilterButton.classList.toggle("has-hidden", active < inputs.length);
    els.overlayFilterButton.title = `${active} of ${inputs.length} overlay filters visible`;
  }
}

function setOverlayFilterMenu(open) {
  if (!els.overlayFilterMenu || !els.overlayFilterButton) return;
  els.overlayFilterMenu.hidden = !open;
  els.overlayFilterButton.setAttribute("aria-expanded", String(open));
}

const LAYOUT_STORAGE_KEY = "realmz-scenario-utility-layout";
const EXPLORER_WIDTH_RANGE = { min: 240, max: 520 };
const INSPECTOR_WIDTH_RANGE = { min: 300, max: 620 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyLayoutWidths() {
  document.documentElement.style.setProperty("--explorer-width", `${state.layout.explorerWidth}px`);
  document.documentElement.style.setProperty("--inspector-width", `${state.layout.inspectorWidth}px`);
}

function saveLayoutWidths() {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(state.layout));
  } catch {
    // Layout persistence is a convenience; resizing should still work if storage is unavailable.
  }
}

function loadLayoutWidths() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) || "null");
  } catch {
    saved = null;
  }
  if (!saved) {
    applyLayoutWidths();
    return;
  }
  state.layout.explorerWidth = clamp(Number(saved.explorerWidth) || state.layout.explorerWidth, EXPLORER_WIDTH_RANGE.min, EXPLORER_WIDTH_RANGE.max);
  state.layout.inspectorWidth = clamp(Number(saved.inspectorWidth) || state.layout.inspectorWidth, INSPECTOR_WIDTH_RANGE.min, INSPECTOR_WIDTH_RANGE.max);
  applyLayoutWidths();
}

function beginSidebarResize(kind, event) {
  if (event.button != null && event.button !== 0) return;
  event.preventDefault();
  const resizer = kind === "explorer" ? els.explorerResizer : els.inspectorResizer;
  const startX = event.clientX;
  const startWidth = kind === "explorer" ? state.layout.explorerWidth : state.layout.inspectorWidth;
  const workspaceRect = els.app.querySelector(".workspace")?.getBoundingClientRect();
  const appRect = els.app.getBoundingClientRect();
  resizer?.classList.add("dragging");

  const onPointerMove = (moveEvent) => {
    if (kind === "explorer") {
      const nextWidth = startWidth + (moveEvent.clientX - startX);
      state.layout.explorerWidth = clamp(nextWidth, EXPLORER_WIDTH_RANGE.min, EXPLORER_WIDTH_RANGE.max);
    } else {
      const rightEdge = workspaceRect?.right || appRect.right;
      const nextWidth = rightEdge - moveEvent.clientX;
      state.layout.inspectorWidth = clamp(nextWidth, INSPECTOR_WIDTH_RANGE.min, INSPECTOR_WIDTH_RANGE.max);
    }
    applyLayoutWidths();
    drawMap();
  };

  const onPointerUp = () => {
    resizer?.classList.remove("dragging");
    saveLayoutWidths();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}

async function api(path) {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || `${response.status} ${response.statusText}`);
    error.status = response.status;
    error.path = path;
    throw error;
  }
  return response.json();
}

async function apiPost(path) {
  const response = await fetch(path, { method: "POST" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.error || body.status || `${response.status} ${response.statusText}`);
    error.status = response.status;
    error.path = path;
    throw error;
  }
  return response.json();
}

function isUnknownApiEndpoint(error) {
  return error?.status === 404 && /unknown api endpoint/i.test(error.message || "");
}

async function rememberScenarioFolder(folderPath) {
  const invoke = getTauriInvoke();
  if (!invoke || !folderPath) return;

  try {
    await invoke("remember_scenarios_folder", { path: folderPath });
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

function pushIndexList(map, key, value) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function buildSchemaIndex(schema) {
  const index = {
    entitiesById: new Map(),
    recordsById: new Map(),
    linksFrom: new Map(),
    linksTo: new Map(),
    diagnosticsBySource: new Map(),
    entitiesByRecordRef: new Map(),
    entitiesByType: new Map(),
    recordsBySource: new Map(),
  };
  if (!schema) return index;
  for (const entity of schema.entities || []) {
    index.entitiesById.set(entity.id, entity);
    pushIndexList(index.entitiesByType, entity.type || "unknown", entity);
    pushIndexList(index.entitiesByRecordRef, entity.recordRef, entity);
  }
  for (const record of schema.records || []) {
    index.recordsById.set(record.id, record);
    pushIndexList(index.recordsBySource, record.source || record.type || "unknown", record);
  }
  for (const link of schema.links || []) {
    pushIndexList(index.linksFrom, link.from, link);
    pushIndexList(index.linksTo, link.to, link);
  }
  for (const diagnostic of schema.diagnostics || []) {
    pushIndexList(index.diagnosticsBySource, diagnostic.source, diagnostic);
    if (diagnostic.data?.source) pushIndexList(index.diagnosticsBySource, diagnostic.data.source, diagnostic);
    if (diagnostic.data?.recordIndex != null && diagnostic.data?.source) {
      const key = `record:${diagnostic.data.source}:${diagnostic.data.levelIndex ?? "macro"}:${diagnostic.data.recordIndex}`;
      pushIndexList(index.diagnosticsBySource, key, diagnostic);
    }
  }
  return index;
}

function schema() {
  return state.data?.semanticSchema || null;
}

function schemaIndex() {
  if (!state.schemaIndex) state.schemaIndex = buildSchemaIndex(schema());
  return state.schemaIndex;
}

function entityById(id) {
  return id ? schemaIndex().entitiesById.get(id) || null : null;
}

function schemaRecordById(id) {
  return id ? schemaIndex().recordsById.get(id) || null : null;
}

function linksFrom(id) {
  return id ? schemaIndex().linksFrom.get(id) || [] : [];
}

function linksTo(id) {
  return id ? schemaIndex().linksTo.get(id) || [] : [];
}

function currentMapEntityId() {
  const level = currentLevel();
  return level ? `map:${level.type}:${level.index}` : null;
}

function labelize(value) {
  return String(value ?? "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, length = 180) {
  const text = String(value ?? "");
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function formatSummaryValue(value) {
  if (value == null || value === "") return "-";
  if (Array.isArray(value)) {
    if (!value.length) return "-";
    if (value.every((entry) => entry == null || ["string", "number", "boolean"].includes(typeof entry))) {
      return truncateText(value.join(" / "), 260);
    }
    return truncateText(value.map((entry) => {
      if (entry?.name) return entry.name;
      if (entry?.id != null) return `${entry.id}`;
      return JSON.stringify(entry);
    }).join(" / "), 260);
  }
  if (typeof value === "object") {
    if (Number.isFinite(value.left) && Number.isFinite(value.top) && Number.isFinite(value.right) && Number.isFinite(value.bottom)) {
      return `${value.left},${value.top} - ${value.right},${value.bottom}`;
    }
    return truncateText(JSON.stringify(value), 260);
  }
  return truncateText(value, 260);
}

function isTextSummaryField(key, value) {
  return String(key).toLowerCase() === "text" &&
    Array.isArray(value) &&
    value.some((entry) => String(entry || "").trim());
}

function renderSummaryField(key, value) {
  const label = labelize(key);
  if (isTextSummaryField(key, value)) {
    return `
      <div class="kv text-summary">
        <span>${escapeHtml(label)}</span>
        <div class="record-text">${escapeHtml(value.filter(Boolean).join("\n"))}</div>
      </div>
    `;
  }
  return kv(label, formatSummaryValue(value));
}

function renderSummaryKv(summary, options = {}) {
  const skip = new Set(options.skip || []);
  const entries = Object.entries(summary || {}).filter(([key, value]) => !skip.has(key) && value != null && value !== "");
  if (!entries.length) return `<div class="empty">No decoded summary fields.</div>`;
  return entries.map(([key, value]) => renderSummaryField(key, value)).join("");
}

function renderReaderSummary(entity) {
  const skip = new Set([
    "actions",
    "actionCount",
    "labelSource",
    "render",
    "tilesetClue",
    "levelType",
    "levelIndex",
    "x",
    "y",
    "percent",
    "source",
    "record",
    "recordIndex",
    "scriptShape",
    "selection",
    "trigger",
  ]);
  const entries = Object.entries(entity?.summary || {}).filter(([key, value]) =>
    !skip.has(key) &&
    value != null &&
    value !== "" &&
    !(Array.isArray(value) && !value.length)
  );
  if (!entries.length) return "";
  return `
    <div class="section">
      <h3>Details</h3>
      ${entries.map(([key, value]) => renderSummaryField(key, value)).join("")}
    </div>
  `;
}

function entityTitle(entity) {
  if (!entity) return "Unknown Entity";
  return entity.label || entity.id;
}

function entityReadableType(entity) {
  return labelize(entity?.type || "entity");
}

function entityLocationSummary(entity) {
  const summary = entity?.summary || {};
  const type = entity?.type || "";
  if (Number.isFinite(summary.x) && Number.isFinite(summary.y) && summary.levelType != null && Number.isFinite(summary.levelIndex)) {
    return `${labelize(summary.levelType)} ${summary.levelIndex}, tile ${summary.x}, ${summary.y}`;
  }
  if (summary.bounds) {
    return formatSummaryValue(summary.bounds);
  }
  if (type === "map") {
    const levelType = summary.levelType ?? entity.id?.split(":")[1];
    const levelIndex = Number.isFinite(summary.levelIndex) ? summary.levelIndex : entity.id?.split(":")[2];
    const size = Number.isFinite(summary.width) && Number.isFinite(summary.height) ? `, ${summary.width} x ${summary.height}` : "";
    return `${labelize(levelType || "map")} ${levelIndex ?? ""}${size}`.trim();
  }
  if (entity?.id?.startsWith("message:")) return `message ${entity.id.slice("message:".length)}`;
  if (entity?.id?.startsWith("battle:")) return `battle ${entity.id.slice("battle:".length)}`;
  if (entity?.id?.startsWith("monster:")) return `monster ${entity.id.slice("monster:".length)}`;
  if (entity?.id?.startsWith("shop:")) return `shop ${entity.id.slice("shop:".length)}`;
  if (entity?.id?.startsWith("resource:")) {
    const [, resourceType, resourceId] = entity.id.split(":");
    return `${resourceType} ${resourceId}`;
  }
  return "";
}

function entityReaderMeta(entity) {
  if (!entity) return "";
  const location = entityLocationSummary(entity);
  return location ? `${entityReadableType(entity)} at ${location}` : entityReadableType(entity);
}

function entityButtonMeta(entity) {
  if (!entity) return "";
  const summary = entity?.summary || {};
  if (entity.type === "message" && summary.preview) return truncateText(summary.preview, 140);
  if (entity.type === "battle" && summary.monsters) return `Monsters: ${formatSummaryValue(summary.monsters)}`;
  return entityLocationSummary(entity) || entityReadableType(entity);
}

function entityRecord(entity) {
  return schemaRecordById(entity?.recordRef);
}

function entityIdForRecordSelection(item) {
  if (!item) return null;
  const id = Number(item.id);
  if (!Number.isFinite(id)) return null;
  if (item.groupKey === "strings") return `message:${id}`;
  if (item.groupKey === "battles") return `battle:${id}`;
  if (item.groupKey === "monsters") return `monster:${id}`;
  if (item.groupKey === "shops") return `shop:${id}`;
  if (item.groupKey === "treasure") return `treasure:${id}`;
  if (item.groupKey === "time") return `time:${id}`;
  if (item.groupKey === "maps") return `map-record:${id}`;
  if (item.groupKey === "extracode") return `record:Data EDCD:${id}`;
  if (item.groupKey === "encounter" || item.groupKey === "encounters") return `encounter:${item.kind || "simple"}:${id}`;
  return null;
}

function entityIdForOverlayBox(box) {
  if (!box) return null;
  if (box.category === "random") {
    return `random:${box.levelType}:${box.levelIndex}:${box.recordRef}`;
  }
  if (box.nodeId && entityById(box.nodeId)) return box.nodeId;
  const door = doorByRecordRef(box.recordRef);
  if (!door) return null;
  if (door.source === "Data ED3") return `macro:${door.recordIndex}`;
  return `trigger:${door.levelType}:${door.levelIndex}:${door.recordIndex}`;
}

function targetExists(id) {
  return Boolean(entityById(id) || schemaRecordById(id));
}

function recordSourceLabel(record) {
  if (!record) return "";
  const range = record.byteRange ? `bytes ${record.byteRange.start}-${record.byteRange.endExclusive}` : "";
  return [record.type, record.source, range].filter(Boolean).join(" | ");
}

function renderSchemaTargetButton(targetId, options = {}) {
  const entity = entityById(targetId);
  const record = entity ? null : schemaRecordById(targetId);
  const title = entity ? entityTitle(entity) : record ? record.id : targetId;
  const meta = entity ? entityButtonMeta(entity) : record ? recordSourceLabel(record) : "unresolved";
  const attr = entity ? `data-entity-id="${escapeHtml(targetId)}"` : record ? `data-schema-record-id="${escapeHtml(targetId)}"` : "";
  const disabled = attr ? "" : " disabled";
  const role = options.role ? `<span>${escapeHtml(options.role)}</span>` : "";
  const renderedMeta = options.hideMeta ? "" : options.meta != null ? options.meta : meta;
  return `
    <button class="row-button" ${attr}${disabled}>
      <span class="row-title"><strong>${escapeHtml(title)}</strong>${role}</span>
      ${renderedMeta ? `<span class="row-meta">${escapeHtml(renderedMeta)}</span>` : ""}
    </button>
  `;
}

function wireSchemaNavigation(root) {
  for (const button of root.querySelectorAll("[data-entity-id]")) {
    button.addEventListener("click", () => selectEntity(button.dataset.entityId));
  }
  for (const button of root.querySelectorAll("[data-schema-record-id]")) {
    button.addEventListener("click", () => selectSchemaRecord(button.dataset.schemaRecordId));
  }
}

function selectSchemaTarget(targetId) {
  if (entityById(targetId)) {
    selectEntity(targetId);
    return true;
  }
  if (schemaRecordById(targetId)) {
    selectSchemaRecord(targetId);
    return true;
  }
  return false;
}

function diagnosticsForEntity(entity) {
  if (!entity) return [];
  const index = schemaIndex();
  const keys = new Set([entity.id, entity.recordRef, entity.source].filter(Boolean));
  const record = entityRecord(entity);
  if (record?.id) keys.add(record.id);
  const diagnostics = new Map();
  for (const key of keys) {
    for (const diagnostic of index.diagnosticsBySource.get(key) || []) {
      diagnostics.set(diagnostic.id || `${diagnostic.type}:${diagnostic.message}`, diagnostic);
    }
  }
  for (const diagnostic of schema()?.diagnostics || []) {
    const haystack = JSON.stringify(diagnostic.data || {});
    if ([entity.id, entity.recordRef].some((key) => key && haystack.includes(key))) {
      diagnostics.set(diagnostic.id || `${diagnostic.type}:${diagnostic.message}`, diagnostic);
    }
  }
  return [...diagnostics.values()];
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9#:_./\\' -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchEntryText(entry) {
  return normalizeSearchText([
    entry.title,
    entry.subtitle,
    entry.meta,
    entry.keywords,
    entry.kind,
  ].filter(Boolean).join(" "));
}

function scoreSearchEntry(entry, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return entry.defaultScore || 0;
  const text = searchEntryText(entry);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  let score = entry.baseScore || 1;
  for (const token of tokens) {
    if (!text.includes(token)) return 0;
    if (normalizeSearchText(entry.title).startsWith(token)) score += 24;
    else if (normalizeSearchText(entry.title).includes(token)) score += 14;
    else if (normalizeSearchText(entry.subtitle).includes(token)) score += 8;
    else score += 3;
  }
  if (text.includes(normalizedQuery)) score += 12;
  return score;
}

function entryKindLabel(kind) {
  if (!kind) return "ITEM";
  if (kind.length <= 10) return kind.toUpperCase();
  return kind.split(/\s+/).map((part) => part[0]).join("").slice(0, 10).toUpperCase();
}

function schemaEntitySearchKeywords(entity) {
  const parts = [
    entity.id,
    entity.recordRef,
    entity.source,
    entity.confidence,
    formatSummaryValue(entity.summary),
  ];
  if (entity.type === "message") {
    const id = parseEntityNumber(entity, "message:");
    const record = Number.isFinite(id) ? recordById("strings", id) : null;
    parts.push(record?.text);
  }
  return parts.filter(Boolean).join(" ");
}

function levelIdForEntity(entity) {
  const levelType = entity?.summary?.levelType;
  const levelIndex = entity?.summary?.levelIndex;
  if (levelType && Number.isInteger(levelIndex)) return `${levelType}:${levelIndex}`;
  const match = entity?.id?.match(/^(?:map|trigger|random):([^:]+):(\d+)/);
  if (match) return `${match[1]}:${match[2]}`;
  return null;
}

function buildWorkspaceSearchEntries() {
  const loaded = Boolean(state.data);
  const workspaceEntries = [
    {
      kind: "tab",
      title: "Selection",
      subtitle: "Inspect the current map or selected scenario entity",
      keywords: "current selected inspector entity",
      defaultScore: 100,
      action: { type: "panel", panel: "selection" },
    },
    {
      kind: "tab",
      title: "Script",
      subtitle: "Browse incoming and outgoing schema links for scripts and actions",
      keywords: "actions triggers macros links graph",
      defaultScore: 96,
      action: { type: "panel", panel: "script" },
    },
    {
      kind: "tab",
      title: "Flags",
      subtitle: "Open quest flag read/write links",
      keywords: "quest flags state reads writes",
      defaultScore: 92,
      action: { type: "panel", panel: "flags" },
    },
    {
      kind: "tab",
      title: "Data",
      subtitle: "Browse schema entity and raw record catalogues",
      keywords: "records entities catalogue schema raw",
      defaultScore: 88,
      action: { type: "panel", panel: "data" },
    },
    {
      kind: "tab",
      title: "Decoding",
      subtitle: "Review semantic coverage, unknown clusters, hypotheses, and format notes",
      keywords: "decoding unknown opcodes hypotheses coverage evidence semantics format gaps",
      defaultScore: 86,
      action: { type: "panel", panel: "decoding" },
    },
    {
      kind: "tab",
      title: "Files",
      subtitle: "View sources, resource types, alignment, and diagnostics",
      keywords: "files resources diagnostics source hashes alignment",
      defaultScore: 84,
      action: { type: "panel", panel: "files" },
    },
  ];
  if (loaded && currentMapEntityId()) {
    workspaceEntries.unshift({
      kind: "map",
      title: "Current Map",
      subtitle: levelTitle(currentLevel(), { long: true }),
      keywords: currentMapEntityId(),
      defaultScore: 110,
      action: { type: "entity", entityId: currentMapEntityId() },
    });
  }
  return workspaceEntries;
}

function buildProjectSearchEntries() {
  const entries = [...buildWorkspaceSearchEntries()];
  if (!state.data) return entries;

  for (const level of state.data.levels || []) {
    const entityId = `map:${level.type}:${level.index}`;
    entries.push({
      kind: "map",
      title: levelTitle(level),
      subtitle: `Open ${level.type} level ${level.index}`,
      meta: [
        level.nameSource,
        tilesetClueLabel(level) ? `tileset: ${tilesetClueLabel(level)}` : "",
      ].filter(Boolean).join(" | "),
      keywords: [entityId, levelTitle(level, { long: true }), level.name, tilesetClueLabel(level)].join(" "),
      baseScore: 12,
      action: entityById(entityId) ? { type: "entity", entityId } : { type: "level", levelId: level.id },
    });
  }

  const index = schemaIndex();
  for (const entity of schema()?.entities || []) {
    entries.push({
      kind: entity.type || "entity",
      title: entityTitle(entity),
      subtitle: labelize(entity.type || "entity"),
      meta: [entity.source, entity.confidence, entity.recordRef].filter(Boolean).join(" | "),
      keywords: schemaEntitySearchKeywords(entity),
      baseScore: entity.type === "map" ? 16 : entity.type === "trigger" ? 14 : entity.type === "message" ? 12 : 8,
      action: { type: "entity", entityId: entity.id },
    });
  }

  for (const record of schema()?.records || []) {
    if (index.entitiesByRecordRef.has(record.id)) continue;
    entries.push({
      kind: record.type || "record",
      title: record.id,
      subtitle: labelize(record.type || "raw record"),
      meta: recordSourceLabel(record),
      keywords: [record.source, record.confidence, formatSummaryValue(record.summary)].filter(Boolean).join(" "),
      baseScore: 3,
      action: { type: "schema-record", recordId: record.id },
    });
  }

  for (const diagnostic of schema()?.diagnostics || []) {
    entries.push({
      kind: "diagnostic",
      title: diagnostic.readerTitle || diagnostic.message || diagnostic.id || diagnostic.type,
      subtitle: labelize(diagnostic.type || "diagnostic"),
      meta: [diagnostic.source, diagnostic.severity, diagnostic.confidence].filter(Boolean).join(" | "),
      keywords: [diagnostic.id, diagnostic.readerSummary, JSON.stringify(diagnostic.data || {})].join(" "),
      baseScore: 5,
      action: { type: "panel", panel: "decoding" },
    });
  }

  const decoding = schema()?.decoding;
  for (const cluster of decoding?.unknownClusters || []) {
    entries.push({
      kind: "unknown cluster",
      title: cluster.title,
      subtitle: "Decoding unknown",
      meta: [cluster.type, cluster.count ? `${cluster.count} examples` : "", cluster.confidence].filter(Boolean).join(" | "),
      keywords: [cluster.clusterKey, cluster.summary, JSON.stringify(cluster.examples || [])].join(" "),
      baseScore: 18,
      action: { type: "decoding", decodingId: cluster.id },
    });
  }
  for (const hypothesis of decoding?.hypotheses || []) {
    entries.push({
      kind: "hypothesis",
      title: hypothesis.title,
      subtitle: "Decoding hypothesis",
      meta: [hypothesis.confidence, hypothesis.evidenceRef].filter(Boolean).join(" | "),
      keywords: [hypothesis.summary, hypothesis.evidenceRef].join(" "),
      baseScore: 10,
      action: { type: "decoding", decodingId: hypothesis.id },
    });
  }

  return entries;
}

function projectSearchResults(query) {
  const scored = buildProjectSearchEntries()
    .map((entry, originalIndex) => ({ ...entry, originalIndex, score: scoreSearchEntry(entry, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return scored.slice(0, 80);
}

function renderProjectSearchResults() {
  const query = state.projectSearch.query;
  const results = projectSearchResults(query);
  state.projectSearch.results = results;
  if (state.projectSearch.activeIndex >= results.length) {
    state.projectSearch.activeIndex = query ? -1 : Math.max(0, results.length - 1);
  }
  if (!results.length) {
    els.projectSearchResults.innerHTML = `<div class="project-search-empty">No matching project entries.</div>`;
    els.projectSearchFooter.textContent = "Try a map name, trigger number, message text, resource id, or file name.";
    return;
  }
  els.projectSearchSubtitle.textContent = query
    ? `Found ${results.length}${results.length === 80 ? "+" : ""} matching indexed entries.`
    : "Jump to workspaces and entities, or search inside the open scenario.";
  els.projectSearchFooter.textContent = query && state.projectSearch.activeIndex < 0
    ? "Press Enter for full search results, or use arrow keys/mouse to choose a direct jump."
    : "Use arrow keys to move, and Enter to jump.";
  els.projectSearchResults.innerHTML = results.map((entry, index) => `
    <button class="project-search-result ${index === state.projectSearch.activeIndex ? "active" : ""}" type="button" role="option" aria-selected="${index === state.projectSearch.activeIndex}" data-search-index="${index}">
      <span class="project-search-badge">${escapeHtml(entryKindLabel(entry.kind))}</span>
      <span class="project-search-copy">
        <strong>${escapeHtml(entry.title)}</strong>
        <span>${escapeHtml(entry.subtitle || entry.meta || "")}</span>
        ${entry.meta && entry.subtitle !== entry.meta ? `<small>${escapeHtml(entry.meta)}</small>` : ""}
      </span>
    </button>
  `).join("");
  for (const button of els.projectSearchResults.querySelectorAll("[data-search-index]")) {
    button.addEventListener("mouseenter", () => {
      setProjectSearchActive(Number(button.dataset.searchIndex));
    });
    button.addEventListener("click", () => {
      performProjectSearchResult(Number(button.dataset.searchIndex));
    });
  }
}

function openProjectSearch(initialQuery = "") {
  state.projectSearch.open = true;
  state.projectSearch.query = initialQuery;
  state.projectSearch.activeIndex = initialQuery ? -1 : 0;
  els.projectSearchOverlay.hidden = false;
  els.projectSearchInput.value = initialQuery;
  renderProjectSearchResults();
  window.requestAnimationFrame(() => {
    els.projectSearchInput.focus();
    els.projectSearchInput.select();
  });
}

function closeProjectSearch() {
  state.projectSearch.open = false;
  els.projectSearchOverlay.hidden = true;
}

function setProjectSearchActive(index) {
  const count = state.projectSearch.results.length;
  if (!count) return;
  state.projectSearch.activeIndex = Math.max(0, Math.min(index, count - 1));
  for (const button of els.projectSearchResults.querySelectorAll("[data-search-index]")) {
    const active = Number(button.dataset.searchIndex) === state.projectSearch.activeIndex;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  }
  els.projectSearchFooter.textContent = "Use arrow keys to move, and Enter to jump.";
}

function moveProjectSearchActive(delta) {
  const count = state.projectSearch.results.length;
  if (!count) return;
  if (state.projectSearch.activeIndex < 0) {
    state.projectSearch.activeIndex = delta < 0 ? count - 1 : 0;
  } else {
    state.projectSearch.activeIndex = (state.projectSearch.activeIndex + delta + count) % count;
  }
  setProjectSearchActive(state.projectSearch.activeIndex);
  els.projectSearchResults.querySelector(".project-search-result.active")?.scrollIntoView({ block: "nearest" });
}

async function performProjectSearchResult(index = state.projectSearch.activeIndex) {
  if (index == null || index < 0) {
    openSearchResultsPanel(state.projectSearch.query);
    return;
  }
  const entry = state.projectSearch.results[index];
  if (!entry) return;
  closeProjectSearch();
  await performProjectSearchAction(entry.action);
}

async function performProjectSearchAction(action) {
  if (action.type === "scenario") {
    await loadScenario(action.path);
    return;
  }
  if (action.type === "panel") {
    activateInspectorPanel(action.panel);
    return;
  }
  if (action.type === "level") {
    state.selectedLevelId = action.levelId;
    state.selectedItem = null;
    state.selectedScriptNode = null;
    renderAll();
    return;
  }
  if (action.type === "schema-record") {
    selectSchemaRecord(action.recordId);
    return;
  }
  if (action.type === "decoding") {
    selectDecodingItem(action.decodingId, { panel: "decoding" });
    return;
  }
  if (action.type === "entity") {
    const entity = entityById(action.entityId);
    const levelId = levelIdForEntity(entity);
    if (levelId && state.selectedLevelId !== levelId) {
      state.selectedLevelId = levelId;
      renderLevelTabs();
      drawMap();
    }
    selectEntity(action.entityId);
  }
}

function openSearchResultsPanel(query) {
  state.projectSearch.pageQuery = query || state.projectSearch.query || "";
  closeProjectSearch();
  renderSearchPanel();
  setSidebarCollapsed(false);
  activateInspectorPanel("search");
}

function handleProjectSearchKeydown(event) {
  if (!state.projectSearch.open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeProjectSearch();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    moveProjectSearchActive(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveProjectSearchActive(-1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    performProjectSearchResult();
  }
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
  if (!level.name) return levelFallbackTitle(level);
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

function levelFallbackTitle(level) {
  if (!level) return "Level";
  const kind = level.type === "land" ? "Land" : "Dungeon";
  if (isDungeonTopdownLevel(level)) {
    return `${kind} ${level.index}, PICT ${level.renderPictureId || DUNGEON_TINY_PICTURE_ID}`;
  }
  const landlook = renderLandlookForLevel(level);
  return Number.isInteger(landlook) ? `${kind} ${level.index}, Look ${landlook}` : `${kind} ${level.index}`;
}

function tilesetClueLabel(level) {
  return tilesetClueValue(level?.tilesetClue);
}

function tilesetClueValue(clue) {
  if (!clue) return "";
  return [clue.label, clue.sourceResource].filter(Boolean).join(" / ");
}

function levelEvidenceMeta(level) {
  const entries = [];
  const tilesetClue = tilesetClueLabel(level);
  if (tilesetClue) entries.push(tilesetClue);
  return entries.length ? ` (${entries.join("; ")})` : "";
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
  const base = Number.isInteger(renderLandlook) && !label.includes(String(renderLandlook))
    ? `${label} (landlook ${renderLandlook})`
    : label;
  const clue = tilesetClueLabel(level);
  return clue ? `${base} (${clue})` : base;
}

function levelLookMeta(level) {
  if (!level?.name) return "";
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

function macroDoorById(id) {
  const macroId = Number(id);
  if (!Number.isFinite(macroId)) return null;
  return state.data?.doors?.find((door) => door.source === "Data ED3" && door.recordIndex === macroId) || null;
}

function macroPreviewActions(id, limit = 3) {
  const door = macroDoorById(id);
  if (!door) return { door: null, actions: [] };
  return { door, actions: actionsForDoor(door).slice(0, limit) };
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
  const cacheKey = `${state.selectedScenarioPath || "base"}:${pictureId}`;
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
  const params = new URLSearchParams({ id: String(pictureId) });
  if (state.selectedScenarioPath) params.set("scenarioPath", state.selectedScenarioPath);
  image.src = `/api/asset/picture?${params.toString()}`;
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

const overlayCategoryOrder = ["random", "encounter", "text", "entrance", "map mutation", "quest", "battle", "unknown"];

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

function compactBoxTitle(box) {
  const bounds = box.bounds;
  const ref = box.label || recordShortId(box.recordRef);
  const location = bounds.width <= 1.2 && bounds.height <= 1.2
    ? `tile ${Math.round(bounds.left + 0.5)}, ${Math.round(bounds.top + 0.5)}`
    : `${bounds.left},${bounds.top}-${bounds.right - 1},${bounds.bottom - 1}`;
  return `${ref && ref !== "-" ? ref : categoryName(box.category)} @ ${location}`;
}

function overlayBucketKey(category) {
  return category || "unknown";
}

function overlayBucketSortValue(category) {
  const index = overlayCategoryOrder.indexOf(overlayBucketKey(category));
  return index === -1 ? overlayCategoryOrder.length : index;
}

function groupedVisibleOverlays(overlays) {
  const groups = new Map();
  for (const box of overlays) {
    const key = overlayBucketKey(box.category);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(box);
  }
  return [...groups.entries()]
    .map(([category, boxes]) => ({
      category,
      definition: categoryDefinition(category),
      boxes: boxes.sort((a, b) => String(a.label || a.id).localeCompare(String(b.label || b.id), undefined, { numeric: true })),
      selected: boxes.some((box) => isBoxSelected(box)),
    }))
    .sort((a, b) => overlayBucketSortValue(a.category) - overlayBucketSortValue(b.category)
      || a.definition.shortName.localeCompare(b.definition.shortName));
}

function isOverlayBucketOpen(group) {
  const key = overlayBucketKey(group.category);
  if (Object.prototype.hasOwnProperty.call(state.overlayBucketOpen, key)) {
    return state.overlayBucketOpen[key];
  }
  if (group.selected) return true;
  return group.boxes.length <= 6;
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
    const selected = isBoxSelected(box);
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
  const selected = state.selectedItem;
  if (selected?.type === "entity") {
    const entityId = entityIdForOverlayBox(box);
    if (entityId && entityId === selected.entityId) return true;
    const entity = entityById(selected.entityId);
    if (entity?.recordRef && entity.recordRef === box.recordRef) return true;
  }
  return (selected?.type === "overlay" && selected.item?.box?.id === box.id)
    || (selected?.type === "record" && selected.item?.sourceOverlay?.box?.id === box.id);
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

function renderExplorerSelectionPanel() {
  if (!els.explorerSelectionPanel) return;
  if (!state.data) {
    els.explorerSelectionPanel.innerHTML = `<div class="empty">Choose a scenario folder to browse maps, triggers, records, and resources.</div>`;
    return;
  }

  const level = currentLevel();
  if (!level) {
    els.explorerSelectionPanel.innerHTML = `<div class="empty">No map is selected.</div>`;
    return;
  }

  const mapEntityId = currentMapEntityId();
  const rand = randLevelFor(level);
  const doors = doorsFor(level);
  const overlays = overlayForLevel(level);
  const visibleOverlays = overlays.filter((box) => categoryEnabled(box.category) || isBoxHighlighted(box));
  const overlayGroups = groupedVisibleOverlays(visibleOverlays);
  els.explorerSelectionPanel.innerHTML = `
    <div class="section">
      <h3>Current Map</h3>
      ${mapEntityId && entityById(mapEntityId) ? renderSchemaTargetButton(mapEntityId, {
        role: "detail",
        meta: levelTitle(level, { long: true }),
      }) : ""}
      ${kv("source", level.source || "-")}
      ${kv("tiles", `${level.width} x ${level.height}`)}
      ${kv("landlook", rand ? rand.landlook : "-")}
      ${tilesetClueLabel(level) ? kv("tileset clue", tilesetClueLabel(level)) : ""}
      ${kv("triggers", doors.length)}
      ${kv("overlays", overlays.length)}
    </div>
    <div class="section">
      <h3>Visible Overlays</h3>
      <div class="overlay-bucket-list">
        ${overlayGroups.map((group) => {
          const open = isOverlayBucketOpen(group);
          const active = group.selected ? " active" : "";
          return `
            <div class="overlay-bucket${active}">
              <button class="overlay-bucket-toggle" type="button" data-overlay-bucket="${escapeHtml(group.category)}" aria-expanded="${open}">
                <span class="bucket-caret" aria-hidden="true">${open ? "v" : ">"}</span>
                <strong>${escapeHtml(group.definition.shortName)}</strong>
                <span>${group.boxes.length}</span>
              </button>
              ${open ? `
                <div class="overlay-bucket-items">
                  ${group.boxes.map((box) => {
                    const selected = isBoxSelected(box) ? " active" : "";
                    return `
                      <button class="row-button overlay-row${selected}" data-overlay-id="${escapeHtml(box.id)}">
                        <span class="row-title"><strong>${escapeHtml(compactBoxTitle(box))}</strong><span>${escapeHtml(recordShortId(box.recordRef))}</span></span>
                        <span class="row-meta">${escapeHtml(formatBounds(box.bounds))}</span>
                      </button>
                    `;
                  }).join("")}
                </div>
              ` : ""}
            </div>
          `;
        }).join("") || `<div class="empty">No visible overlays on this map.</div>`}
      </div>
    </div>
  `;
  wireSchemaNavigation(els.explorerSelectionPanel);
  for (const button of els.explorerSelectionPanel.querySelectorAll("[data-overlay-bucket]")) {
    button.addEventListener("click", () => {
      const key = overlayBucketKey(button.dataset.overlayBucket);
      state.overlayBucketOpen[key] = button.getAttribute("aria-expanded") !== "true";
      renderExplorerSelectionPanel();
    });
  }
  for (const button of els.explorerSelectionPanel.querySelectorAll("[data-overlay-id]")) {
    button.addEventListener("click", () => {
      const box = overlays.find((entry) => entry.id === button.dataset.overlayId);
      selectOverlayBox(box);
    });
  }
}

function renderHeader() {
  const data = state.data;
  if (!data) {
    els.scenarioTitle.textContent = "No scenario loaded";
    return;
  }
  els.scenarioTitle.textContent = data.scenario.name;
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
      const meta = level.name ? levelLookMeta(level) : levelEvidenceMeta(level);
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

function actionOutcomeDetails(action, options = {}) {
  const details = [];
  const seen = new Set();
  const add = (title, summary = "", options = {}) => {
    const cleanTitle = String(title || "").trim();
    const cleanSummary = String(summary || "").trim();
    if (!cleanTitle && !cleanSummary) return;
    const key = options.key || `${cleanTitle}:${cleanSummary}`;
    if (seen.has(key)) return;
    seen.add(key);
    details.push({ title: cleanTitle, summary: cleanSummary, ...options });
  };
  const addMacro = (id, summary = "Runs additional action slots.") => {
    const macroId = Number(id);
    if (!Number.isFinite(macroId)) return;
    const detail = {
      title: `Macro ${macroId}`,
      summary,
      key: `macro:${macroId}`,
    };
    if (options.previewMacros && (options.macroPreviewDepth ?? 1) > 0) {
      const preview = macroPreviewActions(macroId, options.macroPreviewLimit || 3);
      detail.macroStatus = preview.door
        ? preview.actions.length ? "" : "No populated action slots."
        : "Macro record not decoded.";
      detail.previewActions = preview.actions;
    }
    add(detail.title, detail.summary, detail);
    const stored = details.find((entry) => entry.key === detail.key);
    if (stored) {
      stored.previewActions = detail.previewActions || [];
      stored.macroStatus = detail.macroStatus || "";
    }
  };

  for (const link of linkedRecordsForAction(action)) {
    add(recordButtonTitle(link.groupKey, link.kind, link.id), linkedRecordSummary(link), {
      key: `record:${link.groupKey}:${link.kind || ""}:${link.id}`,
    });
  }

  for (const link of action.links || []) {
    if (link.type === "macro") {
      addMacro(link.id, link.role ? labelize(link.role) : "Runs additional action slots.");
    } else if (link.type === "quest") {
      add(`Quest flag ${link.id}`, link.role ? labelize(link.role) : "Reads or changes quest state.", { key: `quest:${link.id}` });
    } else if (link.type === "level") {
      const level = levelForActionLink(link, action.levelType);
      add(level ? levelTitle(level) : `${link.levelType || "level"} ${link.id}`, "Destination level.", {
        key: `level:${link.levelType || action.levelType || ""}:${link.id}`,
      });
    } else if (link.type === "flow") {
      add("Script flow", link.role || "Changes script flow.", { key: `flow:${link.role || ""}` });
    }
  }

  if (!details.length) {
    const summary = actionSummary(action);
    if (summary && summary !== actionReaderSummary(action)) {
      add("Decoded effect", summary, { key: "summary" });
    }
  }

  return details;
}

function renderActionPayloadDetail(detail, options = {}) {
  const previewDepth = Math.max(0, (options.macroPreviewDepth ?? 1) - 1);
  return `
    <div class="semantic-payload-row">
      ${detail.title ? `<span class="semantic-payload-title">${escapeHtml(detail.title)}</span>` : ""}
      ${detail.summary ? `<span>${escapeHtml(detail.summary)}</span>` : ""}
      ${detail.previewActions?.length ? `
        <div class="macro-preview">
          ${detail.previewActions.map((action) => renderActionPreviewRow(action, {
            ...options,
            previewMacros: false,
            macroPreviewDepth: previewDepth,
          })).join("")}
        </div>
      ` : ""}
      ${detail.macroStatus ? `<span class="semantic-payload-note">${escapeHtml(detail.macroStatus)}</span>` : ""}
    </div>
  `;
}

function renderActionPreviewRow(action, options = {}) {
  const target = actionPrimaryTarget(action);
  const targetLabel = actionTargetLabel(target);
  const details = actionOutcomeDetails(action, options).slice(0, 2);
  return `
    <div class="macro-preview-row">
      <div class="semantic-title">${escapeHtml(actionReaderSummary(action))}</div>
      <div class="semantic-meta">${escapeHtml([actionCategoryName(action.category), targetLabel].filter(Boolean).join(" | "))}</div>
      ${details.length ? `
        <div class="semantic-payload">
          ${details.map((detail) => renderActionPayloadDetail(detail, options)).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function levelForActionLink(link, fallbackLevelType = null) {
  if (!link || link.type !== "level") return null;
  const levelType = link.levelType || fallbackLevelType;
  return state.data?.levels?.find((level) => level.type === levelType && level.index === link.id)
    || state.data?.levels?.find((level) => level.id === `${levelType}:${link.id}`)
    || null;
}

function recordTargetFromLink(link) {
  if (!link) return null;
  if (link.type === "text") return { type: "record", groupKey: "strings", id: link.id };
  if (link.type === "encounter") return { type: "record", groupKey: "encounter", kind: link.kind || "simple", id: link.id };
  if (link.type === "battle") return { type: "record", groupKey: "battles", id: link.id };
  if (link.type === "shop") return { type: "record", groupKey: "shops", id: link.id };
  if (link.type === "treasure") return { type: "record", groupKey: "treasure", id: link.id };
  if (link.type === "time") return { type: "record", groupKey: "time", id: link.id };
  if (link.type === "map") return { type: "record", groupKey: "maps", id: link.id };
  if (link.type === "extracode") return { type: "record", groupKey: "extracode", id: link.id };
  if (link.type === "macro") return { type: "entity", entityId: `macro:${link.id}` };
  if (link.type === "quest") return { type: "entity", entityId: `quest-flag:${link.id}` };
  return null;
}

function actionLevelTarget(action) {
  const link = (action.links || []).find((entry) => entry.type === "level");
  const level = levelForActionLink(link, action.levelType);
  if (!level) return null;
  const values = action.extracode || [];
  const hasCoordinates = [20, 45, 61].includes(action.code) && Number.isFinite(values[1]) && Number.isFinite(values[2]);
  return {
    type: "level",
    levelId: level.id,
    entityId: `map:${level.type}:${level.index}`,
    x: hasCoordinates ? values[1] : null,
    y: hasCoordinates ? values[2] : null,
  };
}

function actionPrimaryTarget(action) {
  if (!action) return null;
  if ([12, 13, 20, 23, -23, 45, 57, 61].includes(action.code)) {
    const levelTarget = actionLevelTarget(action);
    if (levelTarget) return levelTarget;
  }
  if (action.code === 1 && Number.isFinite(action.id) && action.id > 0) {
    return { type: "record", groupKey: "strings", id: action.id };
  }
  if (action.code === 3 && Number.isFinite(action.id)) {
    return { type: "record", groupKey: "extracode", id: action.id };
  }
  for (const type of ["text", "encounter", "battle", "shop", "treasure", "map", "macro", "quest", "extracode", "time"]) {
    const target = recordTargetFromLink((action.links || []).find((link) => link.type === type));
    if (target) return target;
  }
  if (action.extracode && Number.isFinite(action.id)) {
    return { type: "record", groupKey: "extracode", id: action.id };
  }
  return null;
}

function actionTargetLabel(target) {
  if (!target) return "";
  if (target.type === "level") {
    const level = state.data?.levels?.find((entry) => entry.id === target.levelId);
    const destination = Number.isFinite(target.x) && Number.isFinite(target.y) ? ` at x ${target.x}, y ${target.y}` : "";
    return `Open destination ${level ? levelTitle(level) : target.levelId}${destination}`;
  }
  if (target.type === "entity") {
    const entity = entityById(target.entityId);
    return `Open ${entity ? entityTitle(entity) : target.entityId}`;
  }
  if (target.type === "record") {
    return `Open ${recordButtonTitle(target.groupKey, target.kind, target.id)}`;
  }
  return "";
}

function openActionTarget(action, context = {}) {
  const target = actionPrimaryTarget(action);
  if (!target) return;
  if (target.type === "level") {
    state.selectedLevelId = target.levelId;
    state.selectedItem = null;
    state.selectedScriptNode = null;
    renderLevelTabs();
    drawMap();
    if (target.entityId && entityById(target.entityId)) {
      selectEntity(target.entityId, { panel: "selection", context: { action } });
    } else {
      renderAll();
      activateInspectorPanel("selection");
    }
    if (Number.isFinite(target.x) && Number.isFinite(target.y)) {
      setStatus(`Showing destination ${target.x}, ${target.y}.`);
    }
    return;
  }
  if (target.type === "entity" && entityById(target.entityId)) {
    selectEntity(target.entityId, { panel: "selection", context: { action } });
    return;
  }
  if (target.type === "record") {
    const item = {
      groupKey: target.groupKey,
      kind: target.kind || null,
      id: target.id,
      ...context,
    };
    const targetId = entityIdForRecordSelection(item);
    if (targetId && selectSchemaTarget(targetId)) return;
    selectItem("record", item, { normalize: false });
  }
}

function wireSemanticActionButtons(root, actions, context = {}) {
  for (const button of root.querySelectorAll("[data-action-index]")) {
    button.addEventListener("click", () => {
      const action = actions[Number(button.dataset.actionIndex)];
      openActionTarget(action, context);
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

function renderSemanticActions(actions, options = {}) {
  if (!actions?.length) return `<div class="empty">This trigger has no populated action slots.</div>`;
  return `<div class="semantic-list">${actions.map((action, index) => {
    const questClass = action.category?.startsWith("quest") ? "quest" : action.category;
    const target = actionPrimaryTarget(action);
    const targetLabel = actionTargetLabel(target);
    const details = actionOutcomeDetails(action, {
      previewMacros: true,
      macroPreviewDepth: 1,
      macroPreviewLimit: 3,
      ...options,
    });
    const tagName = target ? "button" : "div";
    const targetAttr = target ? ` type="button" data-action-index="${index}" title="${escapeHtml(targetLabel)}"` : "";
    const buttonClass = target ? " semantic-button" : "";
    return `
      <${tagName} class="semantic-line${buttonClass} ${escapeHtml(questClass || "")}"${targetAttr}>
        <div class="semantic-title">${escapeHtml(actionReaderSummary(action))}</div>
        <div class="semantic-meta">${escapeHtml([actionCategoryName(action.category), targetLabel].filter(Boolean).join(" | "))}</div>
        ${details.length ? `
          <div class="semantic-payload">
            ${details.map((detail) => renderActionPayloadDetail(detail, options)).join("")}
          </div>
        ` : ""}
      </${tagName}>
    `;
  }).join("")}</div>`;
}

function actionReaderSummary(action) {
  const code = action.code;
  if (code === 1) return "Shows a message.";
  if ([2, 48, 107].includes(code)) return "Starts a battle.";
  if (code === 3) return "Offers a choice to the player.";
  if (code === 4 || code === 5) return "Starts an encounter.";
  if (code === 6 || code === 73) return "Opens a shop.";
  if (code === 7) return "Uses extra action data to branch or replace an encounter result.";
  if (code === 8) return "Reuses another trigger's actions.";
  if (code === 10) return "Gives treasure.";
  if (code === 12) return "Changes a tile or map icon.";
  if (code === 13) return "Enables or disables another trigger.";
  if ([20, 37, 45, 61].includes(code)) return "Moves the party to another place.";
  if ([21, 40, 42, 46, 56, 59, 64, 72, 75, 77, 78, 81, 86, 87].includes(code)) return "Checks a condition and branches.";
  if (code === 23 || code === -23 || code === 92) return "Changes a random encounter area.";
  if (code === 24) return "Leaves this trigger active after it runs.";
  if (code === 25) return "Removes a trigger or door from the map.";
  if (code === 29) return "Shows or gives a map.";
  if (code === 39) return "Runs additional actions from a macro.";
  if (code === 41) return "Disables an encounter option.";
  if (code === 47) return "Sets a quest flag.";
  if (code === 54) return "Changes a timed encounter.";
  if (code === 57) return "Changes the level's look.";
  if (code === 63) return "Changes the in-game clock.";
  if (code === 66) return "Changes whether camping is allowed.";
  if (code === 70) return "Saves or restores the party position.";
  if (code === 76) return "Changes a quest value.";
  if (code === 85) return "Branches to a random trigger.";
  if (code === 88) return "Removes allies from the party.";
  if (code === 89) return "Adds allies to the party.";
  if (code === 97) return "Allows the full map to be viewed.";
  if (code === 103) return "Checks or changes travel state.";
  if (code === 106) return "Changes darkness or line-of-sight behavior.";
  if (code === 111 || code === 112) return "Controls script flow.";
  if (code === 124) return "Spawns a combatant or combat event.";
  if (code === 126) return "Runs a battle macro.";
  return action.label ? `${labelize(action.label)}.` : "Runs an unclassified action.";
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

function renderSchemaRecordDetail(recordId) {
  const record = schemaRecordById(recordId);
  if (!record) {
    els.selectionPanel.innerHTML = `<div class="empty">Schema record ${escapeHtml(recordId)} was not found.</div>`;
    return;
  }
  const linkedEntities = schemaIndex().entitiesByRecordRef.get(record.id) || [];
  els.selectionPanel.innerHTML = `
    <div class="section">
      <h3>${escapeHtml(record.id)}</h3>
      ${kv("type", record.type || "-")}
      ${kv("source", record.source || "-")}
      ${record.confidence ? kv("confidence", record.confidence) : ""}
      ${record.byteRange ? kv("byte range", `${record.byteRange.start}-${record.byteRange.endExclusive} (${record.byteRange.length} bytes)`) : ""}
    </div>
    ${linkedEntities.length ? `
      <div class="section">
        <h3>Semantic Entities</h3>
        <div class="list">${linkedEntities.map((entity) => renderSchemaTargetButton(entity.id)).join("")}</div>
      </div>
    ` : ""}
    <div class="section">
      <h3>Raw Evidence</h3>
      ${renderSummaryKv(record.summary)}
      <pre class="raw-json">${escapeHtml(JSON.stringify(record.summary || {}, null, 2))}</pre>
    </div>
  `;
  wireSchemaNavigation(els.selectionPanel);
}

function linkLabel(link) {
  return labelize(link.kind || "link");
}

const TECHNICAL_LINK_KINDS = new Set([
  "located_on",
  "has_record",
  "uses_source",
  "member_of_resource_type",
  "configures_map",
  "occupies_region",
  "uses action-data row",
]);

function isTechnicalLink(link) {
  return TECHNICAL_LINK_KINDS.has(link?.kind) || link?.from === link?.to;
}

function dedupeLinks(links, direction) {
  const seen = new Set();
  const output = [];
  for (const link of links || []) {
    const targetId = direction === "incoming" ? link.from : link.to;
    const key = `${link.kind}:${targetId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(link);
  }
  return output;
}

function renderSchemaLinks(entityId, direction, options = {}) {
  const allLinks = direction === "incoming" ? linksTo(entityId) : linksFrom(entityId);
  const baseLinks = options.filter ? allLinks.filter(options.filter) : allLinks;
  const links = dedupeLinks(baseLinks, direction);
  if (!links.length) return `<div class="empty">${escapeHtml(options.empty || `No ${direction} links decoded.`)}</div>`;
  const limit = options.limit || 80;
  return `
    <div class="list">
      ${links.slice(0, limit).map((link) => {
        const targetId = direction === "incoming" ? link.from : link.to;
        const meta = options.showEvidence
          ? [
              link.confidence,
              (link.evidence || []).slice(0, 2).join(", "),
              link.metadata ? formatSummaryValue(link.metadata) : "",
            ].filter(Boolean).join(" | ")
          : options.showMetadata === false ? "" : formatSummaryValue(link.metadata || "");
        return renderSchemaTargetButton(targetId, { role: linkLabel(link), meta });
      }).join("")}
      ${links.length > limit ? `<div class="row-meta">Showing ${limit} of ${links.length} links.</div>` : ""}
    </div>
  `;
}

function renderRelatedLinks(entityId) {
  const entity = entityById(entityId);
  const outgoing = linksFrom(entityId).filter((link) => !isTechnicalLink(link));
  const incoming = entity?.type === "map" ? [] : linksTo(entityId).filter((link) => !isTechnicalLink(link));
  const sections = [];
  if (outgoing.length) {
    sections.push(`
      <div class="section">
        <h3>Leads To</h3>
        ${renderSchemaLinks(entityId, "outgoing", {
          filter: (link) => !isTechnicalLink(link),
          limit: 40,
          showMetadata: false,
          empty: "No outward relationships.",
        })}
      </div>
    `);
  }
  if (incoming.length) {
    sections.push(`
      <div class="section">
        <h3>Referenced By</h3>
        ${renderSchemaLinks(entityId, "incoming", {
          filter: (link) => !isTechnicalLink(link),
          limit: 40,
          showMetadata: false,
          empty: "No incoming relationships.",
        })}
      </div>
    `);
  }
  return sections.join("");
}

function renderLinkedEvidence(entityId) {
  return `
    <details class="evidence-details linked-evidence">
      <summary>Linked Evidence</summary>
      <div class="evidence-content">
        <div class="evidence-block">
          <h4>Outgoing Links</h4>
          ${renderSchemaLinks(entityId, "outgoing")}
        </div>
        <div class="evidence-block">
          <h4>Incoming Links</h4>
          ${renderSchemaLinks(entityId, "incoming")}
        </div>
      </div>
    </details>
  `;
}

function decodingItems() {
  const decoding = schema()?.decoding || {};
  return [
    ...(decoding.unknownClusters || []),
    ...(decoding.hypotheses || []),
    ...(decoding.coverage || []),
    ...(decoding.formatNotes || []),
  ];
}

function decodingItemById(id) {
  return decodingItems().find((item) => item.id === id) || null;
}

function confidenceBadge(confidence) {
  if (!confidence) return "";
  return `<span class="confidence-badge ${escapeHtml(confidence)}">${escapeHtml(labelize(confidence))}</span>`;
}

function renderDecodingMetric(label, value, meta = "") {
  return `
    <div class="decoding-metric">
      <strong>${escapeHtml(value ?? 0)}</strong>
      <span>${escapeHtml(label)}</span>
      ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
    </div>
  `;
}

function renderDecodingButton(item, options = {}) {
  const meta = [
    item.type ? labelize(item.type) : "",
    item.count != null ? `${item.count} example${item.count === 1 ? "" : "s"}` : "",
    item.confidence ? labelize(item.confidence) : "",
  ].filter(Boolean).join(" | ");
  return `
    <button class="row-button decoding-row ${escapeHtml(options.className || "")}" data-decoding-id="${escapeHtml(item.id)}">
      <span class="row-title">
        <strong>${escapeHtml(item.title || item.id)}</strong>
        ${confidenceBadge(item.confidence)}
      </span>
      <span class="row-meta">${escapeHtml(item.summary || meta || "")}</span>
      ${meta && item.summary ? `<span class="row-meta">${escapeHtml(meta)}</span>` : ""}
    </button>
  `;
}

function decodingExampleTarget(example) {
  const data = example?.data || {};
  if (data.source && data.recordIndex != null) {
    const recordId = data.source === "Data ED3"
      ? `record:${data.source}:macro:${data.recordIndex}`
      : `record:${data.source}:${data.levelIndex ?? "macro"}:${data.recordIndex}`;
    if (schemaRecordById(recordId)) return { type: "record", id: recordId };
  }
  return null;
}

function renderDecodingExamples(examples = []) {
  if (!examples.length) return `<div class="empty">No examples are attached to this decoding item.</div>`;
  return `<div class="list">${examples.map((example, index) => {
    const target = decodingExampleTarget(example);
    const attrs = target ? ` data-schema-record-id="${escapeHtml(target.id)}"` : "";
    const tag = target ? "button" : "div";
    const data = example.data || {};
    const meta = [
      example.source,
      data.levelType && data.levelIndex != null ? `${data.levelType} ${data.levelIndex}` : "",
      data.recordIndex != null ? `record ${data.recordIndex}` : "",
      data.slot != null ? `slot ${data.slot}` : "",
      data.rawCode != null ? `code ${data.rawCode}` : "",
      data.id != null ? `id ${data.id}` : "",
    ].filter(Boolean).join(" | ");
    return `
      <${tag} class="row-button"${attrs}>
        <span class="row-title"><strong>${escapeHtml(example.readerTitle || example.id || `Example ${index + 1}`)}</strong><span>${escapeHtml(example.message || "")}</span></span>
        <span class="row-meta">${escapeHtml(meta || formatSummaryValue(data))}</span>
      </${tag}>
    `;
  }).join("")}</div>`;
}

function renderDecodingDetail(item) {
  const examples = item.examples || [];
  return `
    <div class="section entity-header">
      <h3>${escapeHtml(item.title || item.id)}</h3>
      <div class="semantic-summary">${escapeHtml(item.summary || item.clusterKey || item.evidenceRef || "")}</div>
      <div class="badge-row">
        ${confidenceBadge(item.confidence)}
        ${item.severity ? `<span class="confidence-badge severity-${escapeHtml(item.severity)}">${escapeHtml(labelize(item.severity))}</span>` : ""}
        ${item.userFacingImpact ? `<span class="confidence-badge">${escapeHtml(labelize(item.userFacingImpact))} impact</span>` : ""}
      </div>
    </div>
    <div class="section">
      <h3>Meaning</h3>
      ${item.recommendedNextStep ? kv("next step", item.recommendedNextStep) : ""}
      ${item.clusterKey ? kv("cluster", item.clusterKey) : ""}
      ${item.evidenceRef ? kv("evidence", item.evidenceRef) : ""}
      ${item.count != null ? kv("examples", item.count) : ""}
      ${item.known != null && item.total != null ? kv("coverage", `${item.known}/${item.total}`) : ""}
    </div>
    <div class="section">
      <h3>Examples</h3>
      ${renderDecodingExamples(examples)}
    </div>
    <details class="evidence-details">
      <summary>Technical Evidence</summary>
      <div class="evidence-content">
        <div class="evidence-block">
          <pre>${escapeHtml(JSON.stringify(item, null, 2))}</pre>
        </div>
      </div>
    </details>
  `;
}

function wireDecodingNavigation(root) {
  for (const button of root.querySelectorAll("[data-decoding-id]")) {
    button.addEventListener("click", () => selectDecodingItem(button.dataset.decodingId, { panel: "decoding" }));
  }
}

function renderDiagnosticsList(diagnostics) {
  if (!diagnostics?.length) return `<div class="empty">No schema diagnostics are attached to this item.</div>`;
  return `<div class="semantic-list">${diagnostics.slice(0, 80).map((diagnostic) => `
    <div class="semantic-line diagnostic-line">
      <div class="semantic-title">${escapeHtml(diagnostic.readerTitle || labelize(diagnostic.type || "diagnostic"))} ${confidenceBadge(diagnostic.confidence)}</div>
      <div class="semantic-meta">${escapeHtml(diagnostic.readerSummary || diagnostic.message || "")}</div>
      ${diagnostic.confidence ? `<div class="semantic-meta">${escapeHtml([diagnostic.severity, diagnostic.source, diagnostic.clusterKey].filter(Boolean).join(" | "))}</div>` : ""}
    </div>
  `).join("")}${diagnostics.length > 80 ? `<div class="row-meta">Showing 80 of ${diagnostics.length} diagnostics.</div>` : ""}</div>`;
}

function renderTechnicalEvidence(entity, record, diagnostics) {
  const door = entity?.type === "trigger" || entity?.type === "macro" ? legacyDoorForEntity(entity) : null;
  const actions = door ? actionsForDoor(door) : [];
  const hasOutgoing = linksFrom(entity.id).length > 0;
  const hasIncoming = linksTo(entity.id).length > 0;
  return `
    <details class="evidence-details">
      <summary>Technical Evidence</summary>
      <div class="evidence-content">
        <div class="evidence-block">
          ${kv("entity id", entity.id)}
          ${kv("type", entity.type || "-")}
          ${entity.confidence ? kv("confidence", entity.confidence) : ""}
          ${kv("source", entity.source || "-")}
          ${entity.recordRef ? kv("record", entity.recordRef) : ""}
          ${record?.byteRange ? kv("byte range", `${record.byteRange.start}-${record.byteRange.endExclusive} (${record.byteRange.length} bytes)`) : ""}
        </div>
        ${actions.length ? `
          <div class="evidence-block">
            <h4>Raw Action Slots</h4>
            ${renderActionLines(actions)}
          </div>
        ` : ""}
        ${record ? `
          <div class="evidence-block">
            <h4>Raw Record Summary</h4>
            <pre class="raw-json">${escapeHtml(JSON.stringify(record.summary || {}, null, 2))}</pre>
          </div>
        ` : `
          <div class="evidence-block">
            <div class="empty">No raw record is attached to this semantic entity yet.</div>
          </div>
        `}
        ${diagnostics?.length ? `
          <div class="evidence-block">
            <h4>Diagnostics</h4>
            ${renderDiagnosticsList(diagnostics)}
          </div>
        ` : ""}
        ${hasOutgoing ? `
          <div class="evidence-block">
            <h4>All Outgoing Links</h4>
            ${renderSchemaLinks(entity.id, "outgoing", { showEvidence: true, limit: 80 })}
          </div>
        ` : ""}
        ${hasIncoming ? `
          <div class="evidence-block">
            <h4>All Incoming Links</h4>
            ${renderSchemaLinks(entity.id, "incoming", { showEvidence: true, limit: 80 })}
          </div>
        ` : ""}
      </div>
    </details>
  `;
}

function parseEntityNumber(entity, prefix) {
  if (!entity?.id?.startsWith(prefix)) return null;
  const value = Number(entity.id.slice(prefix.length));
  return Number.isFinite(value) ? value : null;
}

function legacyDoorForEntity(entity) {
  if (!entity?.recordRef) return null;
  const parts = entity.recordRef.split(":");
  if (parts[0] !== "record" || parts.length < 4) return null;
  const source = parts[1];
  const levelIndex = parts[2] === "macro" ? null : Number(parts[2]);
  const recordIndex = Number(parts[3]);
  if (!Number.isFinite(recordIndex)) return null;
  return state.data?.doors?.find((door) =>
    door.source === source &&
    door.recordIndex === recordIndex &&
    (parts[2] === "macro" || door.levelIndex === levelIndex)
  ) || null;
}

function renderResourcePreview(entity) {
  if (!entity?.id?.startsWith("resource:")) return "";
  const [, type, idText] = entity.id.split(":");
  const id = Number(idText);
  if (!Number.isFinite(id)) return "";
  if (type === "cicn") {
    const params = new URLSearchParams({ id: String(id), v: String(ICON_RENDER_VERSION) });
    if (state.selectedScenarioPath) params.set("scenarioPath", state.selectedScenarioPath);
    return `
      <div class="resource-preview-wrap">
        <img class="resource-preview icon-preview" alt="cicn ${escapeHtml(id)}" src="/api/asset/icon?${params.toString()}">
      </div>
    `;
  }
  if (type === "PICT") {
    const params = new URLSearchParams({ id: String(id) });
    if (state.selectedScenarioPath) params.set("scenarioPath", state.selectedScenarioPath);
    return `
      <div class="resource-preview-wrap">
        <img class="resource-preview picture-preview" alt="PICT ${escapeHtml(id)}" src="/api/asset/picture?${params.toString()}">
        <div class="row-meta">Decoded from the scenario or base resource fork when available.</div>
      </div>
    `;
  }
  return `<div class="empty">No decoded preview endpoint exists for ${escapeHtml(type)} resources yet.</div>`;
}

function renderMessageEntity(entity) {
  const id = parseEntityNumber(entity, "message:");
  const record = Number.isFinite(id) ? recordById("strings", id) : null;
  if (!record?.text) return "";
  return `
    <div class="section">
      <h3>Message Text</h3>
      <div class="record-text">${escapeHtml(record.text)}</div>
    </div>
  `;
}

function renderBattleEntity(entity) {
  const id = parseEntityNumber(entity, "battle:");
  const record = Number.isFinite(id) ? recordById("battles", id) : null;
  if (!record) return "";
  return `
    <div class="section">
      <h3>Battle Setup</h3>
      ${kv("monster slots", record.monsterSlots)}
      ${kv("monsters", record.monsters?.join(", ") || "-")}
      ${kv("message before", record.messageBefore)}
      ${kv("message after", record.messageAfter)}
      ${kv("battle macro", record.battleMacro)}
    </div>
  `;
}

function renderMonsterEntity(entity) {
  const id = parseEntityNumber(entity, "monster:");
  const record = Number.isFinite(id) ? recordById("monsters", id) : null;
  if (!record) return "";
  return `
    <div class="section">
      <h3>Monster Details</h3>
      ${renderSummaryKv(record, { skip: ["raw"] })}
    </div>
  `;
}

function renderShopEntity(entity) {
  const id = parseEntityNumber(entity, "shop:");
  const record = Number.isFinite(id) ? recordById("shops", id) : null;
  if (!record) return "";
  return `
    <div class="section">
      <h3>Shop Inventory</h3>
      ${kv("items", record.itemCount)}
      ${kv("quantity slots", record.quantitySlots)}
      ${kv("inflation", record.inflation)}
      ${kv("sample items", record.sampleItems?.join(", ") || "-")}
    </div>
  `;
}

function renderEntitySpecialSections(entity, context = null) {
  if (!entity) return "";
  if (entity.type === "map") {
    const level = currentLevel();
    const isCurrent = entity.id === currentMapEntityId();
    const rand = isCurrent ? randLevelFor(level) : null;
    const summary = entity.summary || {};
    const tilesetClue = isCurrent ? tilesetClueLabel(level) : tilesetClueValue(summary.tilesetClue);
    return `
      <div class="section">
        <h3>Map Rendering</h3>
        ${isCurrent ? kv("render tileset", renderTilesetLabel(level)) : kv("selected level", "Open this map to inspect live render state.")}
        ${tilesetClue ? kv("tileset clue", tilesetClue) : ""}
        ${isCurrent ? kv(isDungeonTopdownLevel(level) ? "render art" : "tile atlas", atlasStatusForLevel(level)) : ""}
        ${isCurrent && rand ? kv("dark/LOS", `${rand.isdark ? "dark" : "lit"} / ${rand.uselos ? "LOS" : "no LOS"}`) : ""}
      </div>
      ${isCurrent ? `<div class="section"><h3>Dominant Tiles</h3><div class="list">${(level?.topTiles || []).map((tile) => `<div class="row-meta">tile ${tile.tile}: ${tile.count}</div>`).join("")}</div></div>` : ""}
    `;
  }
  if (entity.type === "trigger" || entity.type === "macro") {
    const door = legacyDoorForEntity(entity);
    const actions = door ? actionsForDoor(door) : [];
    return `
      ${door ? `
        <div class="section">
          <h3>What It Does</h3>
          ${kv("activation", door.percent ? `${door.percent}% chance` : "always or scenario-defined")}
          ${renderSemanticActions(actions)}
        </div>
      ` : ""}
      ${context?.alternateBoxes?.length ? `
        <div class="section">
          <h3>Other Boxes Here</h3>
          <div class="semantic-summary">The click selected the smallest matching box. These larger boxes also cover the same tile.</div>
          <div class="list">
            ${context.alternateBoxes.map((otherBox) => `
              <button class="row-button" data-overlay-id="${escapeHtml(otherBox.id)}">
                <span class="row-title"><strong>${escapeHtml(boxTitle(otherBox))}</strong><span>${escapeHtml(categoryDefinition(otherBox.category).shortName)}</span></span>
                <span class="row-meta">${escapeHtml(formatBounds(otherBox.bounds))}</span>
              </button>
            `).join("")}
          </div>
        </div>
      ` : ""}
    `;
  }
  if (entity.type === "random encounter area") {
    return `
      <div class="section">
        <h3>Random Area</h3>
        ${renderSummaryKv(entity.summary)}
      </div>
    `;
  }
  if (entity.type === "resource" || entity.type === "resource reference" || entity.id?.startsWith("resource:")) {
    return `
      <div class="section">
        <h3>Resource Preview</h3>
        ${renderResourcePreview(entity)}
      </div>
    `;
  }
  if (entity.type === "message") return renderMessageEntity(entity);
  if (entity.type === "battle") return renderBattleEntity(entity);
  if (entity.type === "monster") return renderMonsterEntity(entity);
  if (entity.type === "shop") return renderShopEntity(entity);
  return "";
}

function renderEntityDetail(entityId, context = null) {
  const entity = entityById(entityId);
  if (!entity) {
    els.selectionPanel.innerHTML = `<div class="empty">Entity ${escapeHtml(entityId)} was not found in the semantic schema.</div>`;
    return;
  }
  const record = entityRecord(entity);
  const diagnostics = diagnosticsForEntity(entity);
  const door = entity.type === "trigger" || entity.type === "macro" ? legacyDoorForEntity(entity) : null;
  const actions = door ? actionsForDoor(door) : [];
  els.selectionPanel.innerHTML = `
    <div class="section entity-header">
      <h3>${escapeHtml(entityTitle(entity))}</h3>
      <div class="semantic-summary">${escapeHtml(entityReaderMeta(entity) || entity.id)}</div>
    </div>
    ${renderReaderSummary(entity)}
    ${renderEntitySpecialSections(entity, context)}
    ${(entity.type === "trigger" || entity.type === "macro") ? "" : renderRelatedLinks(entity.id)}
    ${diagnostics.length ? `
      <div class="section">
        <h3>Needs Attention</h3>
        ${renderDiagnosticsList(diagnostics)}
      </div>
    ` : ""}
    ${renderTechnicalEvidence(entity, record, diagnostics)}
  `;
  wireSchemaNavigation(els.selectionPanel);
  wireSemanticActionButtons(els.selectionPanel, actions, context || {});
  for (const button of els.selectionPanel.querySelectorAll("[data-overlay-id]")) {
    button.addEventListener("click", () => {
      const allBoxes = context?.allBoxesAtPoint || context?.alternateBoxes || [];
      const boxAtPoint = allBoxes.find((entry) => entry.id === button.dataset.overlayId);
      if (boxAtPoint) {
        selectOverlayBox(boxAtPoint, {
          point: context?.point,
          alternateBoxes: allBoxes.filter((entry) => entry.id !== boxAtPoint.id),
          allBoxesAtPoint: allBoxes,
        });
      }
    });
  }
}

function renderSelectionPanel() {
  const selected = state.selectedItem;
  const level = currentLevel();
  if (!state.data) {
    els.selectionPanel.innerHTML = `<div class="empty">Load a scenario folder to inspect maps, actions, encounters, and quest flag links.</div>`;
    return;
  }
  if (selected?.type === "entity") {
    renderEntityDetail(selected.entityId, selected.context);
    return;
  }
  if (selected?.type === "schema-record") {
    renderSchemaRecordDetail(selected.recordId);
    return;
  }
  if (selected?.type === "decoding") {
    const item = decodingItemById(selected.decodingId);
    els.selectionPanel.innerHTML = item
      ? renderDecodingDetail(item)
      : `<div class="empty">Decoding item ${escapeHtml(selected.decodingId)} was not found.</div>`;
    wireSchemaNavigation(els.selectionPanel);
    return;
  }
  if (!selected) {
    const mapEntityId = currentMapEntityId();
    if (mapEntityId && entityById(mapEntityId)) {
      renderEntityDetail(mapEntityId);
      return;
    }
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
        ${kv("tiles", level ? `${level.width} x ${level.height}` : "-")}
        ${kv("tile range", level ? `${level.min} to ${level.max}` : "-")}
        ${kv("landlook metadata", rand ? rand.landlook : "-")}
        ${kv("render tileset", level ? renderTilesetLabel(level) : "-")}
        ${tilesetClueLabel(level) ? kv("tileset clue", tilesetClueLabel(level)) : ""}
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
          ${renderSemanticActions(actions)}
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
      <details class="evidence-details">
        <summary>Technical Evidence</summary>
        <div class="evidence-content">
          <div class="evidence-block">
            ${kv("source", box.source || "-")}
            ${kv("record", recordShortId(box.recordRef))}
            ${kv("selection", box.bounds.width > 1.2 || box.bounds.height > 1.2 ? "area" : "single tile")}
            ${door ? kv("trigger", sourceLabel(door)) : ""}
            ${door ? kv("script shape", actionCategories.length ? actionCategories.join(", ") : "no decoded action category") : ""}
          </div>
          ${actions.length ? `
            <div class="evidence-block">
              <h4>Raw Action Slots</h4>
              ${renderActionLines(actions)}
            </div>
          ` : ""}
        </div>
      </details>
    `;
    wireSemanticActionButtons(els.selectionPanel, actions, { sourceOverlay: selected.item });
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
    const graphActions = actionsForDoor(door);
    const actions = graphActions.length ? graphActions : door.actions;
    els.selectionPanel.innerHTML = `
      <div class="section">
        <h3>Trigger ${escapeHtml(sourceLabel(door))}</h3>
        ${kv("position", `${door.levelType} ${door.levelIndex} (${door.x}, ${door.y})`)}
        ${kv("doorid", door.doorid)}
        ${kv("percent", door.percent)}
        ${kv("source", door.source)}
      </div>
      <div class="section">
        <h3>What It Does</h3>
        ${renderSemanticActions(actions)}
      </div>
    `;
    wireSemanticActionButtons(els.selectionPanel, actions, { sourceDoor: door });
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
  const selectedEntityId = state.selectedItem?.type === "entity" ? state.selectedItem.entityId : state.selectedScriptNode;
  const selectedEntity = entityById(selectedEntityId);
  let scriptActions = [];
  if (!selectedEntity) {
    const currentBoxes = overlayForLevel(currentLevel()).filter((box) => box.nodeId);
    const schemaData = schema();
    els.scriptPanel.innerHTML = `
      <div class="section">
        <h3>Script Graph</h3>
        ${kv("schema entities", schemaData?.entities?.length ?? 0)}
        ${kv("schema links", schemaData?.links?.length ?? 0)}
        ${kv("diagnostics", schemaData?.diagnostics?.length ?? 0)}
        ${kv("legacy nodes", graph.nodes?.length ?? 0)}
        ${kv("legacy edges", graph.edges?.length ?? 0)}
      </div>
      <div class="section">
        <h3>Visible Triggers</h3>
        <div class="list">
          ${currentBoxes.slice(0, 80).map((box) => {
            const entityId = entityIdForOverlayBox(box) || box.nodeId;
            return renderSchemaTargetButton(entityId, {
              role: box.category,
              meta: `${box.recordRef} at ${box.bounds.left + 0.5},${box.bounds.top + 0.5}`,
            });
          }).join("") || `<div class="empty">No script-backed boxes on this level.</div>`}
        </div>
      </div>
    `;
  } else {
    const door = legacyDoorForEntity(selectedEntity);
    scriptActions = door ? actionsForDoor(door) : [];
    els.scriptPanel.innerHTML = `
      <div class="section">
        <h3>${escapeHtml(entityTitle(selectedEntity))}</h3>
        ${kv("type", selectedEntity.type)}
        ${kv("source", selectedEntity.source || "-")}
        ${kv("confidence", selectedEntity.confidence || "-")}
        ${selectedEntity.recordRef ? kv("record", selectedEntity.recordRef) : ""}
      </div>
      <div class="section">
        <h3>Action List</h3>
        ${renderSemanticActions(scriptActions)}
      </div>
      ${renderLinkedEvidence(selectedEntity.id)}
    `;
  }
  wireSchemaNavigation(els.scriptPanel);
  wireSemanticActionButtons(els.scriptPanel, scriptActions, { sourceEntityId: selectedEntityId });
}

function renderDataPanel() {
  if (!state.data) {
    els.dataPanel.innerHTML = `<div class="empty">No scenario loaded.</div>`;
    return;
  }
  const index = schemaIndex();
  const entityGroups = [...index.entitiesByType.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const recordGroups = [...index.recordsBySource.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  els.dataPanel.innerHTML = `
    <div class="section">
      <h3>Semantic Entities</h3>
      <div class="list">
        ${entityGroups.map(([type, entities]) => `
          <div class="semantic-line">
            <div class="semantic-title">${escapeHtml(labelize(type))} <span class="schema-count">${entities.length}</span></div>
            <div class="list compact-list">
              ${entities.slice(0, 12).map((entity) => renderSchemaTargetButton(entity.id)).join("")}
              ${entities.length > 12 ? `<div class="row-meta">Showing 12 of ${entities.length} ${escapeHtml(labelize(type))} entities.</div>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="section">
      <h3>Raw Records</h3>
      <div class="list">
        ${recordGroups.map(([source, records]) => `
          <div class="semantic-line">
            <div class="semantic-title">${escapeHtml(source)} <span class="schema-count">${records.length}</span></div>
            <div class="list compact-list">
              ${records.slice(0, 8).map((record) => renderSchemaTargetButton(record.id)).join("")}
              ${records.length > 8 ? `<div class="row-meta">Showing 8 of ${records.length} records.</div>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="section">
      <h3>Diagnostics</h3>
      ${renderDiagnosticsList(schema()?.diagnostics || [])}
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
  wireSchemaNavigation(els.dataPanel);
}

function renderDecodingPanel() {
  if (!state.data) {
    els.decodingPanel.innerHTML = `<div class="empty">No scenario loaded.</div>`;
    return;
  }
  const decoding = schema()?.decoding || {};
  const summary = decoding.summary || {};
  const coverage = decoding.coverage || [];
  const clusters = decoding.unknownClusters || [];
  const hypotheses = decoding.hypotheses || [];
  const notes = decoding.formatNotes || [];
  const confidence = summary.confidence || {};
  els.decodingPanel.innerHTML = `
    <div class="section">
      <h3>Decoding Summary</h3>
      <div class="decoding-metrics">
        ${renderDecodingMetric("unknown clusters", summary.unknownClusterCount || clusters.length)}
        ${renderDecodingMetric("hypotheses", summary.hypothesisCount || hypotheses.length)}
        ${renderDecodingMetric("format notes", summary.formatNoteCount || notes.length)}
        ${renderDecodingMetric("format-gap actions", summary.formatGapActionCount || 0)}
        ${renderDecodingMetric("unreferenced ED3", summary.unreferencedMacroCount || 0)}
      </div>
      <div class="badge-row">
        ${Object.entries(confidence).slice(0, 6).map(([key, value]) => `<span class="confidence-badge ${escapeHtml(key)}">${escapeHtml(labelize(key))}: ${escapeHtml(value)}</span>`).join("")}
      </div>
    </div>
    <div class="section">
      <h3>Highest Impact Unknowns</h3>
      <div class="list">
        ${clusters.slice(0, 24).map((cluster) => renderDecodingButton(cluster)).join("") || `<div class="empty">No unknown clusters for this scenario.</div>`}
      </div>
    </div>
    <div class="section">
      <h3>Hypotheses</h3>
      <div class="list">
        ${hypotheses.slice(0, 18).map((hypothesis) => renderDecodingButton(hypothesis, { className: "hypothesis" })).join("") || `<div class="empty">No decoding hypotheses were emitted.</div>`}
      </div>
    </div>
    <div class="section">
      <h3>Format Coverage</h3>
      <div class="list">
        ${coverage.map((entry) => renderDecodingButton(entry, { className: "coverage" })).join("") || `<div class="empty">No coverage entries were emitted.</div>`}
      </div>
    </div>
    <div class="section">
      <h3>Format Notes</h3>
      <div class="list">
        ${notes.slice(0, 24).map((note) => renderDecodingButton(note, { className: "note" })).join("") || `<div class="empty">No format notes were emitted.</div>`}
        ${notes.length > 24 ? `<div class="row-meta">Showing 24 of ${notes.length} notes.</div>` : ""}
      </div>
    </div>
  `;
  wireDecodingNavigation(els.decodingPanel);
}

function renderSearchPanel() {
  if (!state.data) {
    els.searchPanel.innerHTML = `<div class="empty">No scenario loaded.</div>`;
    return;
  }
  const query = state.projectSearch.pageQuery || "";
  const results = projectSearchResults(query);
  els.searchPanel.innerHTML = `
    <div class="section">
      <h3>Search Results</h3>
      ${kv("query", query || "recent/indexed project entries")}
      ${kv("matches", results.length)}
      <button class="row-button" data-open-project-search="1">
        <span class="row-title"><strong>Open search palette</strong><span>Ctrl+Space</span></span>
        <span class="row-meta">Search maps, entities, records, resources, messages, and diagnostics in the open scenario.</span>
      </button>
    </div>
    <div class="section">
      <h3>Results</h3>
      <div class="list">
        ${results.map((entry, index) => `
          <button class="row-button" data-search-page-index="${index}">
            <span class="row-title"><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(labelize(entry.kind))}</span></span>
            <span class="row-meta">${escapeHtml([entry.subtitle, entry.meta].filter(Boolean).join(" | "))}</span>
          </button>
        `).join("") || `<div class="empty">No matching entries. Try a map name, trigger number, message text, resource id, or file name.</div>`}
      </div>
    </div>
  `;
  const openButton = els.searchPanel.querySelector("[data-open-project-search]");
  openButton?.addEventListener("click", () => openProjectSearch(query));
  for (const button of els.searchPanel.querySelectorAll("[data-search-page-index]")) {
    button.addEventListener("click", () => {
      const entry = results[Number(button.dataset.searchPageIndex)];
      if (entry) performProjectSearchAction(entry.action);
    });
  }
}

function renderFlagsPanel() {
  if (!state.data) {
    els.flagsPanel.innerHTML = `<div class="empty">No scenario loaded.</div>`;
    return;
  }
  const flags = schemaIndex().entitiesByType.get("quest flag") || [];
  if (!flags.length) {
    els.flagsPanel.innerHTML = `<div class="empty">No quest flag references were decoded from door or macro actions.</div>`;
    return;
  }
  els.flagsPanel.innerHTML = `
    <div class="section">
      <h3>Quest Flags</h3>
      <div class="list">
        ${flags
          .map((flag) => {
            const numericId = Number(flag.id.replace(/^quest-flag:/, ""));
            const incoming = linksTo(flag.id).length;
            const outgoing = linksFrom(flag.id).length;
            return `
            <button class="row-button ${state.highlightedQuest === numericId ? "active" : ""}" data-entity-id="${escapeHtml(flag.id)}" data-flag="${escapeHtml(numericId)}">
              <span class="row-title"><strong>${escapeHtml(entityTitle(flag))}</strong><span>${escapeHtml(flag.summary?.writeCount ?? 0)} set / ${escapeHtml(flag.summary?.readCount ?? 0)} read</span></span>
              <span class="row-meta">${escapeHtml(`${incoming} incoming links, ${outgoing} outgoing links | ${flag.confidence}`)}</span>
            </button>
          `;
          })
          .join("")}
      </div>
    </div>
  `;
  wireSchemaNavigation(els.flagsPanel);
  for (const button of els.flagsPanel.querySelectorAll("[data-flag]")) {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.flag);
      state.highlightedQuest = state.highlightedQuest === id ? null : id;
      const legacyFlag = state.data.graph.questFlags.find((entry) => entry.id === id);
      const first = legacyFlag?.locations.find((loc) => loc.levelType === currentLevel()?.type && loc.levelIndex === currentLevel()?.index) || legacyFlag?.locations[0];
      if (first?.levelType && Number.isInteger(first.levelIndex)) {
        state.selectedLevelId = `${first.levelType}:${first.levelIndex}`;
      }
      if (button.dataset.entityId) {
        state.selectedItem = { type: "entity", entityId: button.dataset.entityId };
        state.selectedScriptNode = null;
      }
      renderAll();
    });
  }
}

function renderFilesPanel() {
  if (!state.data) {
    els.filesPanel.innerHTML = `<div class="empty">No scenario loaded.</div>`;
    return;
  }
  const schemaData = schema();
  const sources = schemaData?.sources || [];
  const resourceTypes = (schemaIndex().entitiesByType.get("resource type") || [])
    .sort((a, b) => entityTitle(a).localeCompare(entityTitle(b)));
  const diagnostics = schemaData?.diagnostics || [];
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
      <h3>Schema Sources</h3>
      <div class="list">
        ${sources.slice(0, 80).map((source) => `
          <div class="semantic-line">
            <div class="semantic-title">${escapeHtml(source.id || source.path || source.name || "source")}</div>
            <div class="semantic-meta">${escapeHtml([source.type, source.path, source.sha256 ? `sha256 ${source.sha256}` : ""].filter(Boolean).join(" | "))}</div>
          </div>
        `).join("") || `<div class="empty">No schema source records emitted.</div>`}
        ${sources.length > 80 ? `<div class="row-meta">Showing 80 of ${sources.length} sources.</div>` : ""}
      </div>
    </div>
    <div class="section">
      <h3>Resource Fork</h3>
      <div class="list">
        ${resourceTypes.map((entity) => renderSchemaTargetButton(entity.id, {
          meta: `${formatSummaryValue(entity.summary)} | ${linksTo(entity.id).length} members`,
        })).join("") || `<div class="empty">No resource type entities decoded.</div>`}
      </div>
    </div>
    <div class="section">
      <h3>Diagnostics</h3>
      ${renderDiagnosticsList(diagnostics)}
    </div>
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
  wireSchemaNavigation(els.filesPanel);
}

function activeInspectorPanelName() {
  const active = document.querySelector(".explorer-panel.active");
  if (active?.id === "explorerSelectionPanel") return "selection";
  return active?.id?.replace(/Panel$/, "") || "selection";
}

function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  els.app.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  els.sidebarToggle.textContent = state.sidebarCollapsed ? ">" : "<";
  els.sidebarToggle.title = state.sidebarCollapsed ? "Expand explorer" : "Collapse explorer";
  els.sidebarToggle.setAttribute("aria-label", els.sidebarToggle.title);
  els.sidebarToggle.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
}

function activateInspectorPanel(name) {
  const panelId = name === "selection" ? "explorerSelectionPanel" : `${name}Panel`;
  document.querySelectorAll(".explorer-tab").forEach((entry) => entry.classList.toggle("active", entry.dataset.panel === name));
  document.querySelectorAll(".explorer-panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelector(`#${panelId}`)?.classList.add("active");
  updateInspectorNav();
}

function selectionHistoryItemKey(selectedItem) {
  if (!selectedItem) return "empty";
  const { type, item } = selectedItem;
  if (type === "entity") return `entity:${selectedItem.entityId || item?.entityId || ""}`;
  if (type === "schema-record") return `schema-record:${selectedItem.recordId || item?.recordId || ""}`;
  if (type === "decoding") return `decoding:${selectedItem.decodingId || ""}`;
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
  renderExplorerSelectionPanel();
  renderSelectionPanel();
  renderScriptPanel();
  renderDecodingPanel();
  activateInspectorPanel(snapshot.panel || "selection");
  updateInspectorNav();
}

function selectEntity(entityId, options = {}) {
  const entity = entityById(entityId);
  if (!entity) return;
  const panel = options.panel || activeInspectorPanelName();
  state.selectedItem = { type: "entity", entityId, context: options.context || null };
  state.selectedScriptNode = scriptNodeById(entityId) ? entityId : null;
  if (entity.type === "quest flag") {
    const id = Number(entity.id.replace(/^quest-flag:/, ""));
    state.highlightedQuest = Number.isFinite(id) ? id : state.highlightedQuest;
  }
  if (options.panel) activateInspectorPanel(options.panel);
  renderExplorerSelectionPanel();
  renderSelectionPanel();
  renderScriptPanel();
  renderFlagsPanel();
  renderOverlay();
  if (options.history !== false) {
    rememberSelection(panel);
  }
}

function selectSchemaRecord(recordId, options = {}) {
  if (!schemaRecordById(recordId)) return;
  const panel = options.panel || activeInspectorPanelName();
  state.selectedItem = { type: "schema-record", recordId, context: options.context || null };
  state.selectedScriptNode = null;
  if (options.panel) activateInspectorPanel(options.panel);
  renderExplorerSelectionPanel();
  renderSelectionPanel();
  renderScriptPanel();
  renderOverlay();
  if (options.history !== false) {
    rememberSelection(panel);
  }
}

function selectDecodingItem(decodingId, options = {}) {
  if (!decodingItemById(decodingId)) return;
  const panel = options.panel || activeInspectorPanelName();
  state.selectedItem = { type: "decoding", decodingId };
  state.selectedScriptNode = null;
  if (options.panel) activateInspectorPanel(options.panel);
  renderExplorerSelectionPanel();
  renderSelectionPanel();
  renderScriptPanel();
  renderDecodingPanel();
  renderOverlay();
  if (options.history !== false) {
    rememberSelection(panel);
  }
}

function selectItem(type, item, options = {}) {
  if (options.normalize !== false) {
    if (type === "overlay") {
      const entityId = entityIdForOverlayBox(item?.box || item);
      if (entityId && targetExists(entityId)) {
        selectEntity(entityId, { ...options, context: item });
        return;
      }
    }
    if (type === "record") {
      const targetId = entityIdForRecordSelection(item);
      if (targetId && selectSchemaTarget(targetId)) return;
    }
    if (type === "door") {
      const entityId = item?.nodeId || entityIdForOverlayBox({ recordRef: item?.recordRef, category: "trigger" });
      if (entityId && entityById(entityId)) {
        selectEntity(entityId, { ...options, context: item });
        return;
      }
    }
    if (type === "random") {
      const entityId = `random:${item?.levelType}:${item?.levelIndex}:${item?.id ?? item?.rectIndex ?? item?.recordRef}`;
      if (entityById(entityId)) {
        selectEntity(entityId, { ...options, context: item });
        return;
      }
    }
  }
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
  renderExplorerSelectionPanel();
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
  if (entityById(nodeId)) {
    const node = scriptNodeById(nodeId);
    const door = node ? doorByRecordRef(node.recordRef) : null;
    if (door && Number.isInteger(door.levelIndex)) {
      state.selectedLevelId = `${door.levelType}:${door.levelIndex}`;
      renderLevelTabs();
      drawMap();
    }
    selectEntity(nodeId, { panel: "script" });
    return;
  }
  state.selectedScriptNode = nodeId;
  const node = scriptNodeById(nodeId);
  const door = node ? doorByRecordRef(node.recordRef) : null;
  if (door && Number.isInteger(door.levelIndex)) {
    state.selectedLevelId = `${door.levelType}:${door.levelIndex}`;
    state.selectedItem = { type: "door", item: { ...door, actions: actionsForDoor(door) } };
  }
  renderLevelTabs();
  drawMap();
  renderExplorerSelectionPanel();
  renderSelectionPanel();
  renderScriptPanel();
  rememberSelection(activeInspectorPanelName());
}

function renderAll() {
  renderHeader();
  renderLevelTabs();
  updateOverlayFilterSummary();
  drawMap();
  renderExplorerSelectionPanel();
  renderSelectionPanel();
  renderScriptPanel();
  renderFlagsPanel();
  renderDataPanel();
  renderDecodingPanel();
  renderSearchPanel();
  renderFilesPanel();
  updateInspectorNav();
}

function clearScenarioState() {
  state.scenarios = [];
  state.selectedScenarioPath = null;
  state.data = null;
  state.schemaIndex = null;
  state.selectedLevelId = null;
  state.selectedItem = null;
  state.selectedScriptNode = null;
  state.highlightedQuest = null;
  state.hoverTile = null;
  state.overlayBucketOpen = {};
  clearSelectionHistory();
  state.tileAtlasCache.clear();
  state.iconCache.clear();
  state.pictureCache.clear();
  state.secretWalkableCache.clear();
}

async function scenarioPathInfo(folderPath) {
  return api(`/api/path-info?path=${encodeURIComponent(folderPath || "")}`);
}

async function pickScenarioFolderWithLocalServer(initialPath) {
  try {
    const query = initialPath ? `?initialPath=${encodeURIComponent(initialPath)}` : "";
    const result = await apiPost(`/api/pick-folder${query}`);
    return result.path || null;
  } catch (error) {
    if (isUnknownApiEndpoint(error)) {
      throw new Error("Restart the local server to enable filesystem browsing.");
    }
    throw error;
  }
}

async function openScenarioFromInput() {
  const scenarioPath = els.rootPath.value.trim();
  if (!scenarioPath) {
    clearScenarioState();
    setStatus("Choose a folder to begin.");
    renderAll();
    return;
  }

  setStatus("Checking scenario folder...");
  let info;
  try {
    info = await scenarioPathInfo(scenarioPath);
  } catch (error) {
    if (isUnknownApiEndpoint(error)) {
      state.scenarioFolderInitialPath = scenarioPath;
      await loadScenario(scenarioPath);
      return;
    }
    throw error;
  }
  state.scenarioFolderInitialPath = info.path || scenarioPath;
  if (!info.exists) {
    setStatus(`Folder not found: ${scenarioPath}`);
    return;
  }
  if (!info.isDirectory) {
    setStatus("Choose a folder, not a file.");
    return;
  }
  if (!info.isScenarioFolder) {
    const hint = info.scenarioCount
      ? `That folder contains ${info.scenarioCount} scenario folders. Open one of those scenario folders directly.`
      : "That folder does not look like a Realmz scenario folder.";
    clearScenarioState();
    setStatus(hint);
    renderAll();
    return;
  }

  await loadScenario(info.path || scenarioPath);
}

async function loadScenario(scenarioPath) {
  state.selectedScenarioPath = scenarioPath;
  state.scenarios = [];
  state.selectedItem = null;
  state.selectedScriptNode = null;
  state.highlightedQuest = null;
  state.hoverTile = null;
  clearSelectionHistory();
  state.tileAtlasCache.clear();
  state.iconCache.clear();
  state.pictureCache.clear();
  state.secretWalkableCache.clear();
  setStatus("Analyzing scenario...");
  state.data = await api(`/api/analyze?path=${encodeURIComponent(scenarioPath)}`);
  state.selectedScenarioPath = state.data.scenario.path;
  state.scenarioFolderInitialPath = state.data.scenario.path;
  els.rootPath.value = state.data.scenario.path;
  state.scenarios = [{ name: state.data.scenario.name, path: state.data.scenario.path }];
  await rememberScenarioFolder(state.data.scenario.path);
  state.schemaIndex = buildSchemaIndex(state.data.semanticSchema);
  state.selectedLevelId = state.data.levels[0]?.id || null;
  setStatus(`Loaded ${state.data.scenario.name}`);
  activateInspectorPanel("selection");
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
    setStatus(`Imported ${imported} tilemap${imported === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}`);
    drawMap();
  } catch (error) {
    setStatus(error.message);
  } finally {
    els.importTiles.disabled = false;
  }
}

async function locateScenarioFolder() {
  const invoke = getTauriInvoke();

  els.locateScenarios.disabled = true;
  setStatus("Choosing scenario folder...");
  try {
    const initialPath = els.rootPath.value.trim() || state.scenarioFolderInitialPath || state.config?.defaultScenarioRoot || null;
    const selectedPath = invoke
      ? await invoke("pick_scenarios_folder", { initialPath })
      : await pickScenarioFolderWithLocalServer(initialPath);
    if (selectedPath) {
      els.rootPath.value = selectedPath;
      await openScenarioFromInput();
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
  els.overlayFilterButton?.addEventListener("click", () => {
    setOverlayFilterMenu(els.overlayFilterMenu.hidden);
  });
  els.overlayFilterClose?.addEventListener("click", () => setOverlayFilterMenu(false));
  els.overlayShowAll?.addEventListener("click", () => {
    for (const input of overlayToggleInputs()) input.checked = true;
    state.toggles.doors = true;
    state.toggles.random = true;
    state.toggles.encounters = true;
    state.toggles.quest = true;
    state.toggles["map mutation"] = true;
    state.toggles.battle = true;
    state.toggles.text = true;
    state.toggles.unknown = true;
    state.toggles.secrets = true;
    updateOverlayFilterSummary();
    renderOverlay();
  });
  els.overlayHideAll?.addEventListener("click", () => {
    for (const input of overlayToggleInputs()) input.checked = false;
    state.toggles.doors = false;
    state.toggles.random = false;
    state.toggles.encounters = false;
    state.toggles.quest = false;
    state.toggles["map mutation"] = false;
    state.toggles.battle = false;
    state.toggles.text = false;
    state.toggles.unknown = false;
    state.toggles.secrets = false;
    updateOverlayFilterSummary();
    renderOverlay();
  });
  els.overlayOnlySecrets?.addEventListener("click", () => {
    for (const input of overlayToggleInputs()) input.checked = false;
    els.toggleSecrets.checked = true;
    state.toggles.doors = false;
    state.toggles.random = false;
    state.toggles.encounters = false;
    state.toggles.quest = false;
    state.toggles["map mutation"] = false;
    state.toggles.battle = false;
    state.toggles.text = false;
    state.toggles.unknown = false;
    state.toggles.secrets = true;
    updateOverlayFilterSummary();
    renderOverlay();
  });

  els.projectSearchLauncher?.addEventListener("click", () => openProjectSearch());
  els.projectSearchInput?.addEventListener("input", () => {
    state.projectSearch.query = els.projectSearchInput.value;
    state.projectSearch.activeIndex = -1;
    renderProjectSearchResults();
  });
  els.projectSearchInput?.addEventListener("keydown", handleProjectSearchKeydown);
  els.projectSearchOverlay?.addEventListener("click", (event) => {
    if (event.target === els.projectSearchOverlay) closeProjectSearch();
  });
  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.code === "Space") {
      event.preventDefault();
      openProjectSearch();
    } else if (event.key === "Escape" && !els.overlayFilterMenu?.hidden) {
      setOverlayFilterMenu(false);
    } else {
      handleProjectSearchKeydown(event);
    }
  });
  window.addEventListener("pointerdown", (event) => {
    if (els.overlayFilterMenu?.hidden) return;
    if (event.target.closest(".overlay-menu-wrap")) return;
    setOverlayFilterMenu(false);
  });

  els.rootForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    openScenarioFromInput().catch((error) => setStatus(error.message));
  });
  els.locateScenarios?.addEventListener("click", () => {
    locateScenarioFolder();
  });

  els.sidebarToggle.addEventListener("click", () => {
    setSidebarCollapsed(!state.sidebarCollapsed);
  });
  els.explorerResizer?.addEventListener("pointerdown", (event) => beginSidebarResize("explorer", event));
  els.inspectorResizer?.addEventListener("pointerdown", (event) => beginSidebarResize("inspector", event));

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

  for (const tab of document.querySelectorAll(".explorer-tab")) {
    tab.addEventListener("click", () => {
      activateInspectorPanel(tab.dataset.panel);
    });
  }

  els.toggleDoors.addEventListener("change", () => {
    state.toggles.doors = els.toggleDoors.checked;
    updateOverlayFilterSummary();
    renderOverlay();
  });
  els.toggleRealTiles.addEventListener("change", () => {
    state.renderMode = els.toggleRealTiles.checked ? "real" : "color";
    drawMap();
  });
  els.toggleRandom.addEventListener("change", () => {
    state.toggles.random = els.toggleRandom.checked;
    updateOverlayFilterSummary();
    renderOverlay();
  });
  els.toggleEncounters.addEventListener("change", () => {
    state.toggles.encounters = els.toggleEncounters.checked;
    updateOverlayFilterSummary();
    renderOverlay();
  });
  els.toggleQuest.addEventListener("change", () => {
    state.toggles.quest = els.toggleQuest.checked;
    updateOverlayFilterSummary();
    renderOverlay();
  });
  els.toggleMapMutation.addEventListener("change", () => {
    state.toggles["map mutation"] = els.toggleMapMutation.checked;
    updateOverlayFilterSummary();
    renderOverlay();
  });
  els.toggleBattle.addEventListener("change", () => {
    state.toggles.battle = els.toggleBattle.checked;
    updateOverlayFilterSummary();
    renderOverlay();
  });
  els.toggleText.addEventListener("change", () => {
    state.toggles.text = els.toggleText.checked;
    updateOverlayFilterSummary();
    renderOverlay();
  });
  els.toggleUnknown.addEventListener("change", () => {
    state.toggles.unknown = els.toggleUnknown.checked;
    updateOverlayFilterSummary();
    renderOverlay();
  });
  els.toggleSecrets.addEventListener("change", () => {
    state.toggles.secrets = els.toggleSecrets.checked;
    updateOverlayFilterSummary();
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
  loadLayoutWidths();
  wireEvents();
  updateLauncherControls();
  window.setTimeout(updateLauncherControls, 250);
  state.config = await api("/api/config");
  state.scenarioFolderInitialPath = state.config.defaultScenarioRoot || "";
  if (state.config.defaultScenarioRoot) {
    const info = await scenarioPathInfo(state.config.defaultScenarioRoot).catch(() => null);
    state.scenarioFolderInitialPath = info?.path || state.config.defaultScenarioRoot;
    if (info?.isScenarioFolder) {
      els.rootPath.value = info.path;
      await loadScenario(info.path);
      return;
    }
  }
  els.rootPath.value = "";
  clearScenarioState();
  setStatus("Choose a folder to begin.");
  renderAll();
}

init().catch((error) => {
  console.error(error);
  setStatus(error.message);
});
