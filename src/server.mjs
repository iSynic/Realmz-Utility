import http from "node:http";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeScenario, discoverScenarios } from "./realmz-parser.mjs";
import { exportTileAtlas, exportTileAtlases, tileAtlasCachePath, tilemapSourceForLandlook } from "./tile-importer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const referenceIconDir = path.join(rootDir, "assets", "realmz", "resources", "icons");
const localScenarioRootCandidates = [
  path.join(process.cwd(), "Scenarios"),
  path.join(rootDir, "Scenarios"),
  path.join(process.cwd(), "Realmz", "Scenarios"),
  path.join(rootDir, "Realmz", "Scenarios"),
  path.join(process.cwd(), "Realmz", "base", "Realmz", "Scenarios"),
  path.join(rootDir, "Realmz", "base", "Realmz", "Scenarios"),
];
const legacyScenarioRoot = process.platform === "win32" ? "F:\\Realmz\\base\\Realmz\\Scenarios" : path.join(os.homedir(), "Realmz", "base", "Realmz", "Scenarios");
const defaultScenarioRootCandidates = [...localScenarioRootCandidates, legacyScenarioRoot];
const defaultScenarioRoot = process.env.REALMZ_SCENARIO_ROOT || defaultScenarioRootCandidates.find((candidate) => existsSync(candidate)) || localScenarioRootCandidates[0];
const defaultReferenceRoot = process.env.REALMZ_REFERENCE_ROOT || (process.platform === "win32" ? "F:\\Realmz" : path.join(os.homedir(), "Realmz"));

function dataDir() {
  return process.env.REALMZ_UTILITY_DATA_DIR || rootDir;
}

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function sendError(res, status, error) {
  sendJson(res, status, { error: error instanceof Error ? error.message : String(error) });
}

function safePublicPath(urlPath) {
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const resolved = path.resolve(publicDir, "." + decodeURIComponent(requested));
  if (!resolved.startsWith(publicDir)) {
    return null;
  }
  return resolved;
}

async function serveStatic(req, res, pathname) {
  const filePath = safePublicPath(pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(data);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    throw error;
  }
}

async function serveTileAtlas(res, url) {
  const scenarioPath = url.searchParams.get("scenarioPath") || url.searchParams.get("path");
  const landlook = Number(url.searchParams.get("landlook"));
  if (!scenarioPath || !Number.isInteger(landlook)) {
    sendError(res, 400, "Missing scenarioPath or integer landlook");
    return;
  }

  const atlasPath = tileAtlasCachePath(dataDir(), scenarioPath, landlook);
  try {
    let data;
    try {
      data = await fs.readFile(atlasPath);
    } catch (error) {
      if (!error || error.code !== "ENOENT") {
        throw error;
      }
      await exportTileAtlas({ rootDir: dataDir(), assetRoot: rootDir, referenceRoot: defaultReferenceRoot, scenarioPath, landlook });
      data = await fs.readFile(atlasPath);
    }
    res.writeHead(200, {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600",
    });
    res.end(data);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      sendJson(res, 404, {
        available: false,
        landlook,
        sourceResource: `PICT ${300 + landlook}`,
        status: "No utility-side exported atlas PNG is available yet. The UI should use decoded color tiles.",
        expectedCachePath: atlasPath,
        referenceRoot: defaultReferenceRoot,
      });
      return;
    }
    sendJson(res, 404, {
      available: false,
      landlook,
      sourceResource: `PICT ${300 + landlook}`,
      status: error instanceof Error ? error.message : String(error),
      expectedCachePath: atlasPath,
      referenceRoot: defaultReferenceRoot,
    });
  }
}

async function serveTileAtlasMeta(res, url) {
  const scenarioPath = url.searchParams.get("scenarioPath") || url.searchParams.get("path");
  const landlook = Number(url.searchParams.get("landlook"));
  if (!scenarioPath || !Number.isInteger(landlook)) {
    sendError(res, 400, "Missing scenarioPath or integer landlook");
    return;
  }

  const atlasPath = tileAtlasCachePath(dataDir(), scenarioPath, landlook);
  const source = await tilemapSourceForLandlook(defaultReferenceRoot, scenarioPath, landlook, rootDir);
  let cached = null;
  try {
    cached = JSON.parse(await fs.readFile(`${atlasPath}.json`, "utf8"));
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
  }

  sendJson(res, 200, {
    available: Boolean(source),
    cachePath: atlasPath,
    ...source,
    cached,
  });
}

async function serveIcon(res, url) {
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id)) {
    sendError(res, 400, "Missing integer icon id");
    return;
  }

  const iconPath = path.join(referenceIconDir, `icon_${id}.png`);
  const resolved = path.resolve(iconPath);
  if (!resolved.startsWith(path.resolve(referenceIconDir))) {
    sendError(res, 403, "Invalid icon path");
    return;
  }

  try {
    const data = await fs.readFile(resolved);
    res.writeHead(200, {
      "content-type": "image/png",
      "cache-control": "public, max-age=3600",
    });
    res.end(data);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      sendJson(res, 404, { available: false, id, status: "No extracted realmz_tools icon PNG is available." });
      return;
    }
    throw error;
  }
}

async function importTileAtlases(res, url) {
  const scenarioPath = url.searchParams.get("scenarioPath") || url.searchParams.get("path");
  if (!scenarioPath) {
    sendError(res, 400, "Missing scenarioPath");
    return;
  }
  const requestedLandlook = url.searchParams.get("landlook");
  const analysis = await analyzeScenario(scenarioPath);
  const landlooks = requestedLandlook == null
    ? analysis.assets.tileAtlases.map((atlas) => atlas.landlook)
    : [Number(requestedLandlook)];
  if (landlooks.some((landlook) => !Number.isInteger(landlook))) {
    sendError(res, 400, "landlook must be an integer");
    return;
  }
  const results = await exportTileAtlases({
    rootDir: dataDir(),
    assetRoot: rootDir,
    referenceRoot: defaultReferenceRoot,
    scenarioPath,
    landlooks,
    force: url.searchParams.get("force") === "1",
  });
  sendJson(res, 200, { scenarioPath: path.resolve(scenarioPath), results });
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/config") {
    sendJson(res, 200, { defaultScenarioRoot, defaultScenarioRootCandidates, defaultReferenceRoot, dataDir: dataDir(), assetRoot: rootDir });
    return;
  }

  if (url.pathname === "/api/scenarios") {
    const root = url.searchParams.get("root") || defaultScenarioRoot;
    sendJson(res, 200, { root, scenarios: await discoverScenarios(root) });
    return;
  }

  if (url.pathname === "/api/analyze") {
    const scenarioPath = url.searchParams.get("path");
    if (!scenarioPath) {
      sendError(res, 400, "Missing scenario path");
      return;
    }
    sendJson(res, 200, await analyzeScenario(scenarioPath));
    return;
  }

  if (url.pathname === "/api/asset/tile-atlas") {
    await serveTileAtlas(res, url);
    return;
  }

  if (url.pathname === "/api/asset/tile-atlas-meta") {
    await serveTileAtlasMeta(res, url);
    return;
  }

  if (url.pathname === "/api/asset/icon") {
    await serveIcon(res, url);
    return;
  }

  if (url.pathname === "/api/asset/import-tile-atlases") {
    await importTileAtlases(res, url);
    return;
  }

  sendError(res, 404, "Unknown API endpoint");
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url);
        return;
      }
      await serveStatic(req, res, url.pathname);
    } catch (error) {
      console.error(error);
      sendError(res, 500, error);
    }
  });
}

export function startServer({ port = Number(process.env.PORT || 5177), host = "127.0.0.1" } = {}) {
  const server = createServer();
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      resolve({ server, host, port: actualPort, url: `http://${host}:${actualPort}/` });
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requestedPort = Number(process.env.PORT || 5177);
  const { url } = await startServer({ port: requestedPort, host: "127.0.0.1" });
  console.log(`Realmz Scenario Utility listening on ${url}`);
}
