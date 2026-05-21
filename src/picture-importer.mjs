import fs from "node:fs/promises";
import path from "node:path";
import { parseResourceFork } from "./resource-fork.mjs";
import { encodePngRgba } from "./png.mjs";

const BASE_RESOURCE_STEM = "The Family Jewels";
const BASE_RESOURCE_FILE = `${BASE_RESOURCE_STEM}.rsrc`;
const MAX_PICT_DIMENSION = 2048;

const decodedPictureCache = new Map();
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

function decodePackBitsRow(buffer, offset, packedLength, expectedLength) {
  const end = Math.min(offset + packedLength, buffer.length);
  const output = [];
  let cursor = offset;
  while (cursor < end && output.length < expectedLength) {
    const control = buffer.readInt8(cursor);
    cursor += 1;
    if (control >= 0 && control <= 127) {
      const count = control + 1;
      for (let index = 0; index < count && cursor < end; index += 1) {
        output.push(buffer[cursor]);
        cursor += 1;
      }
    } else if (control >= -127 && control <= -1) {
      const count = 1 - control;
      if (cursor >= end) {
        break;
      }
      const value = buffer[cursor];
      cursor += 1;
      for (let index = 0; index < count; index += 1) {
        output.push(value);
      }
    }
  }

  while (output.length < expectedLength) {
    output.push(0);
  }
  return Buffer.from(output.slice(0, expectedLength));
}

function findPackBitsPixmap(pict) {
  for (let offset = 10; offset + 80 < pict.length; offset += 2) {
    const opcode = u16(pict, offset);
    if (opcode !== 0x0098 && opcode !== 0x0099) {
      continue;
    }

    const pixMapOffset = offset + 2;
    const rowBytesRaw = u16(pict, pixMapOffset);
    const rowBytes = rowBytesRaw & 0x3fff;
    const bounds = {
      top: i16(pict, pixMapOffset + 2),
      left: i16(pict, pixMapOffset + 4),
      bottom: i16(pict, pixMapOffset + 6),
      right: i16(pict, pixMapOffset + 8),
    };
    const pixelType = u16(pict, pixMapOffset + 26);
    const pixelSize = u16(pict, pixMapOffset + 28);
    const componentCount = u16(pict, pixMapOffset + 30);
    const componentSize = u16(pict, pixMapOffset + 32);
    if (!(rowBytesRaw & 0x8000) || rowBytes < 1 || rowBytes > 8192 || pixelType !== 0 || pixelSize !== 8 || componentCount !== 1 || componentSize !== 8) {
      continue;
    }

    const colorTableOffset = pixMapOffset + 46;
    const colorCount = u16(pict, colorTableOffset + 6) + 1;
    const afterColorTable = colorTableOffset + 8 + colorCount * 8;
    if (colorCount < 2 || afterColorTable + 18 >= pict.length) {
      continue;
    }

    const srcRect = {
      top: i16(pict, afterColorTable),
      left: i16(pict, afterColorTable + 2),
      bottom: i16(pict, afterColorTable + 4),
      right: i16(pict, afterColorTable + 6),
    };
    let dataOffset = afterColorTable + 18;
    if (opcode === 0x0099) {
      const regionSize = u16(pict, dataOffset);
      if (regionSize < 10 || dataOffset + regionSize >= pict.length) {
        continue;
      }
      dataOffset += regionSize;
    }

    const width = srcRect.right - srcRect.left;
    const height = srcRect.bottom - srcRect.top;
    if (width > 0 && width <= MAX_PICT_DIMENSION && height > 0 && height <= MAX_PICT_DIMENSION && bounds.bottom > bounds.top) {
      return { opcode, rowBytes, colorTableOffset, colorCount, srcRect, width, height, dataOffset };
    }
  }
  return null;
}

function decodePictPackBits8(pict) {
  const rect = findPackBitsPixmap(pict);
  if (!rect) {
    throw new Error("No supported 8-bit PackBits PICT bitmap was found");
  }

  const palette = [];
  for (let index = 0; index < rect.colorCount; index += 1) {
    const offset = rect.colorTableOffset + 8 + index * 8;
    palette.push({
      r: u16(pict, offset + 2) >> 8,
      g: u16(pict, offset + 4) >> 8,
      b: u16(pict, offset + 6) >> 8,
    });
  }

  const rgba = Buffer.alloc(rect.width * rect.height * 4);
  let cursor = rect.dataOffset;

  for (let y = 0; y < rect.height; y += 1) {
    if (cursor >= pict.length) {
      break;
    }
    const packedLength = rect.rowBytes > 250 ? u16(pict, cursor) : pict[cursor];
    cursor += rect.rowBytes > 250 ? 2 : 1;
    const availableLength = Math.min(packedLength, Math.max(0, pict.length - cursor));
    const row = decodePackBitsRow(pict, cursor, availableLength, rect.rowBytes);
    cursor += availableLength;

    for (let x = 0; x < rect.width; x += 1) {
      const color = palette[row[x] || 0] || { r: 0, g: 0, b: 0 };
      const out = (y * rect.width + x) * 4;
      rgba[out] = color.r;
      rgba[out + 1] = color.g;
      rgba[out + 2] = color.b;
      rgba[out + 3] = 255;
    }
  }

  return { width: rect.width, height: rect.height, rgba, pixelSize: 8, colorCount: rect.colorCount };
}

async function decodePictureFromResource(resourcePath, id, source) {
  const resources = await resourcesForPath(resourcePath);
  const resource = resources.find((entry) => entry.type === "PICT" && entry.id === id);
  if (!resource) {
    return null;
  }

  const stat = await fs.stat(resourcePath);
  const cacheKey = `${resourcePath}:${stat.mtimeMs}:${stat.size}:${id}`;
  const cached = decodedPictureCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let image;
  try {
    image = decodePictPackBits8(resource.data);
  } catch {
    return null;
  }

  const decoded = {
    png: encodePngRgba(image.width, image.height, image.rgba),
    source,
    resourcePath,
    resourceType: "PICT",
    id,
    width: image.width,
    height: image.height,
    pixelSize: image.pixelSize,
    colorCount: image.colorCount,
  };
  decodedPictureCache.set(cacheKey, decoded);
  return decoded;
}

export async function decodePicturePng({ referenceRoot, scenarioPath, assetRoot, id, includeBase = true }) {
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
    const decoded = await decodePictureFromResource(candidate.path, id, candidate.source);
    if (decoded) {
      return decoded;
    }
  }

  return null;
}
