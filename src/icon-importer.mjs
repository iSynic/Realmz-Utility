import fs from "node:fs/promises";
import path from "node:path";
import { parseResourceFork } from "./resource-fork.mjs";
import { encodePngRgba } from "./png.mjs";

const BASE_RESOURCE_STEM = "The Family Jewels";
const BASE_RESOURCE_FILE = `${BASE_RESOURCE_STEM}.rsrc`;
const CICN_HEADER_BYTES = 82;

const decodedIconCache = new Map();
const resourceCache = new Map();

function u16(buffer, offset) {
  return buffer.readUInt16BE(offset);
}

function i16(buffer, offset) {
  return buffer.readInt16BE(offset);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function firstExisting(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    if (await exists(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function scenarioResourcePath(scenarioPath) {
  if (!scenarioPath) {
    return null;
  }
  const name = path.basename(scenarioPath);
  return firstExisting([
    path.join(scenarioPath, "Scenario.rsrc"),
    path.join(scenarioPath, "Scenario.rsf"),
    path.join(scenarioPath, `${name}.rsrc`),
    path.join(scenarioPath, `${name}.rsf`),
  ]);
}

async function baseResourcePath(referenceRoot, assetRoot) {
  const candidates = [
    path.join(referenceRoot, "base", "Realmz", "Data Files", BASE_RESOURCE_FILE),
    path.join(referenceRoot, "out_win_clang", "Data Files", BASE_RESOURCE_FILE),
    path.join(referenceRoot, "base", "Realmz", "Data Files", `${BASE_RESOURCE_STEM}.rsf`),
    path.join(referenceRoot, "out_win_clang", "Data Files", `${BASE_RESOURCE_STEM}.rsf`),
    path.join(referenceRoot, "base", "Realmz", "Data Files", BASE_RESOURCE_STEM),
    path.join(referenceRoot, "out_win_clang", "Data Files", BASE_RESOURCE_STEM),
    path.join(referenceRoot, "base", "Realmz", "Data Files", `${BASE_RESOURCE_FILE}.rsf`),
    path.join(referenceRoot, "out_win_clang", "Data Files", `${BASE_RESOURCE_FILE}.rsf`),
  ];
  if (assetRoot) {
    candidates.push(
      path.join(assetRoot, "assets", "realmz", "resources", "binary", `${BASE_RESOURCE_STEM}.rsf`),
      path.join(assetRoot, "assets", "realmz", "resources", "binary", BASE_RESOURCE_STEM),
      path.join(assetRoot, "assets", "realmz", "resources", "binary", `${BASE_RESOURCE_FILE}.rsf`),
      path.join(assetRoot, "assets", "realmz", "resources", "binary", BASE_RESOURCE_FILE),
    );
  }
  return firstExisting(candidates);
}

async function resourcesForPath(resourcePath) {
  const stat = await fs.stat(resourcePath);
  const cacheKey = `${resourcePath}:${stat.mtimeMs}:${stat.size}`;
  const cached = resourceCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const resources = parseResourceFork(await fs.readFile(resourcePath));
  resourceCache.set(cacheKey, resources);
  return resources;
}

function paletteColor(entry, fallback = { r: 0, g: 0, b: 0 }) {
  return entry || fallback;
}

function decodeCicn(cicn) {
  if (!Buffer.isBuffer(cicn) || cicn.length < CICN_HEADER_BYTES) {
    throw new Error("cicn resource is too short");
  }

  const rowBytes = u16(cicn, 4) & 0x3fff;
  const top = i16(cicn, 6);
  const left = i16(cicn, 8);
  const bottom = i16(cicn, 10);
  const right = i16(cicn, 12);
  const width = right - left;
  const height = bottom - top;
  const pixelSize = u16(cicn, 32);
  const maskRowBytes = u16(cicn, 54) & 0x3fff;
  const maskTop = i16(cicn, 56);
  const maskBottom = i16(cicn, 60);
  const maskHeight = maskBottom > maskTop ? maskBottom - maskTop : height;

  if (width <= 0 || height <= 0 || width > 512 || height > 512 || rowBytes <= 0 || maskRowBytes <= 0) {
    throw new Error("cicn resource has unsupported dimensions");
  }
  if (![1, 2, 4, 8].includes(pixelSize)) {
    throw new Error(`unsupported cicn pixel size ${pixelSize}`);
  }

  const maskOffset = CICN_HEADER_BYTES;
  const colorTableOffset = maskOffset + maskRowBytes * maskHeight;
  if (colorTableOffset + 8 > cicn.length) {
    throw new Error("cicn color table is missing");
  }

  const colorCount = u16(cicn, colorTableOffset + 6) + 1;
  const colorTableBytes = 8 + colorCount * 8;
  const pixelDataOffset = colorTableOffset + colorTableBytes;
  const pixelDataBytes = rowBytes * height;
  if (pixelDataOffset + pixelDataBytes > cicn.length) {
    throw new Error("cicn pixel data is truncated");
  }

  const palette = [];
  for (let index = 0; index < colorCount; index += 1) {
    const offset = colorTableOffset + 8 + index * 8;
    const colorIndex = u16(cicn, offset);
    palette[colorIndex] = {
      r: u16(cicn, offset + 2) >> 8,
      g: u16(cicn, offset + 4) >> 8,
      b: u16(cicn, offset + 6) >> 8,
    };
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let colorIndex = 0;
      if (pixelSize === 8) {
        colorIndex = cicn[pixelDataOffset + y * rowBytes + x] || 0;
      } else if (pixelSize === 4) {
        const byte = cicn[pixelDataOffset + y * rowBytes + Math.floor(x / 2)] || 0;
        colorIndex = x % 2 === 0 ? byte >> 4 : byte & 0x0f;
      } else if (pixelSize === 2) {
        const byte = cicn[pixelDataOffset + y * rowBytes + Math.floor(x / 4)] || 0;
        colorIndex = (byte >> (6 - (x % 4) * 2)) & 0x03;
      } else {
        const byte = cicn[pixelDataOffset + y * rowBytes + Math.floor(x / 8)] || 0;
        colorIndex = (byte >> (7 - (x % 8))) & 0x01;
      }

      const maskByte = cicn[maskOffset + y * maskRowBytes + Math.floor(x / 8)] || 0;
      const alpha = (maskByte >> (7 - (x % 8))) & 0x01 ? 255 : 0;
      const color = paletteColor(palette[colorIndex], paletteColor(palette[0]));
      const output = (y * width + x) * 4;
      rgba[output] = color.r;
      rgba[output + 1] = color.g;
      rgba[output + 2] = color.b;
      rgba[output + 3] = alpha;
    }
  }

  return { width, height, rgba, pixelSize, colorCount };
}

async function decodeCicnFromResource(resourcePath, id, source) {
  const resources = await resourcesForPath(resourcePath);
  const resource = resources.find((entry) => entry.type === "cicn" && entry.id === id);
  if (!resource) {
    return null;
  }

  const stat = await fs.stat(resourcePath);
  const cacheKey = `${resourcePath}:${stat.mtimeMs}:${stat.size}:${id}`;
  const cached = decodedIconCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let image;
  try {
    image = decodeCicn(resource.data);
  } catch {
    return null;
  }
  const decoded = {
    png: encodePngRgba(image.width, image.height, image.rgba),
    source,
    resourcePath,
    resourceType: "cicn",
    id,
    width: image.width,
    height: image.height,
    pixelSize: image.pixelSize,
    colorCount: image.colorCount,
  };
  decodedIconCache.set(cacheKey, decoded);
  return decoded;
}

export async function decodeIconPng({ referenceRoot, scenarioPath, assetRoot, id, includeBase = false }) {
  const candidates = [
    { source: "scenario", path: await scenarioResourcePath(scenarioPath) },
  ];
  if (includeBase) {
    candidates.push({ source: "base", path: await baseResourcePath(referenceRoot, assetRoot) });
  }
  const seen = new Set();

  for (const candidate of candidates) {
    if (!candidate.path || seen.has(candidate.path)) {
      continue;
    }
    seen.add(candidate.path);
    const decoded = await decodeCicnFromResource(candidate.path, id, candidate.source);
    if (decoded) {
      return decoded;
    }
  }

  return null;
}
