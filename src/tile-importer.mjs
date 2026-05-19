import fs from "node:fs/promises";
import path from "node:path";
import { extractResourceFork } from "./resource-fork.mjs";
import { encodePngRgba } from "./png.mjs";

const TILE_ATLAS_WIDTH = 640;
const TILE_ATLAS_HEIGHT = 320;
const TILE_RESOURCE_STEM = "The Family Jewels";
const TILE_RESOURCE_FILE = `${TILE_RESOURCE_STEM}.rsrc`;

const standardLandlooks = new Map([
  [0, { pictId: 300, metadataFile: "Data P BD" }],
  [3, { pictId: 303, metadataFile: "Data SUB BD" }],
  [4, { pictId: 304, metadataFile: "Data Castle BD" }],
  [5, { pictId: 305, metadataFile: "Data Desert BD" }],
  [9, { pictId: 309, metadataFile: "Data Swamp BD" }],
  [10, { pictId: 310, metadataFile: "Data Snow BD" }],
]);

const customLandlooks = new Map([
  [6, { pictId: 306, metadataFile: "Data Custom 1 BD" }],
  [7, { pictId: 307, metadataFile: "Data Custom 2 BD" }],
  [8, { pictId: 308, metadataFile: "Data Custom 3 BD" }],
]);

function u16(buffer, offset) {
  return buffer.readUInt16BE(offset);
}

function i16(buffer, offset) {
  return buffer.readInt16BE(offset);
}

function u32(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function tileAtlasCachePath(rootDir, scenarioPath, landlook) {
  const normalizedScenario = path.resolve(scenarioPath);
  const name = Buffer.from(normalizedScenario).toString("base64url").slice(0, 64);
  const safeLandlook = String(landlook).replace(/[^0-9-]/g, "");
  return path.join(rootDir, "tmp", "tile-atlases", name, `landlook-${safeLandlook}.png`);
}

function parseResourceFork(buffer) {
  buffer = extractResourceFork(buffer);
  const dataOffset = u32(buffer, 0);
  const mapOffset = u32(buffer, 4);
  const typeListOffset = mapOffset + u16(buffer, mapOffset + 24);
  const typeCount = u16(buffer, typeListOffset) + 1;
  const resources = [];

  for (let typeIndex = 0; typeIndex < typeCount; typeIndex += 1) {
    const typeOffset = typeListOffset + 2 + typeIndex * 8;
    const type = buffer.toString("ascii", typeOffset, typeOffset + 4);
    const resourceCount = u16(buffer, typeOffset + 4) + 1;
    const refListOffset = typeListOffset + u16(buffer, typeOffset + 6);

    for (let refIndex = 0; refIndex < resourceCount; refIndex += 1) {
      const refOffset = refListOffset + refIndex * 12;
      const id = i16(buffer, refOffset);
      const dataRelativeOffset = (buffer[refOffset + 5] << 16) | (buffer[refOffset + 6] << 8) | buffer[refOffset + 7];
      const length = u32(buffer, dataOffset + dataRelativeOffset);
      resources.push({
        type,
        id,
        offset: dataOffset + dataRelativeOffset + 4,
        length,
      });
    }
  }

  return resources;
}

async function readResource(resourcePath, type, id) {
  const buffer = await fs.readFile(resourcePath);
  const resource = parseResourceFork(buffer).find((entry) => entry.type === type && entry.id === id);
  if (!resource) {
    return null;
  }
  return buffer.subarray(resource.offset, resource.offset + resource.length);
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
  return Buffer.from(output.subarray ? output.subarray(0, expectedLength) : output.slice(0, expectedLength));
}

function findPackBitsRect(pict) {
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
    if (!(rowBytesRaw & 0x8000) || rowBytes < 1 || rowBytes > 4096 || pixelType !== 0 || pixelSize !== 8 || componentCount !== 1 || componentSize !== 8) {
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
    if (width > 0 && width <= 2048 && height > 0 && height <= 2048 && bounds.bottom > bounds.top) {
      return { opcode, pixMapOffset, rowBytes, colorTableOffset, colorCount, srcRect, width, height, dataOffset };
    }
  }
  return null;
}

function decodePictPackBits8(pict) {
  const rect = findPackBitsRect(pict);
  if (!rect) {
    throw new Error("No 8-bit PackBitsRect tile bitmap was found in PICT resource");
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

  const width = Math.min(rect.width, TILE_ATLAS_WIDTH);
  const height = Math.min(rect.height, TILE_ATLAS_HEIGHT);
  const rgba = Buffer.alloc(width * height * 4);
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
    if (y >= height) {
      continue;
    }
    for (let x = 0; x < width; x += 1) {
      const color = palette[row[x] || 0] || { r: 0, g: 0, b: 0 };
      const out = (y * width + x) * 4;
      rgba[out] = color.r;
      rgba[out + 1] = color.g;
      rgba[out + 2] = color.b;
      rgba[out + 3] = 255;
    }
  }

  return { width, height, rgba };
}

async function baseResourcePath(referenceRoot, assetRoot) {
  const candidates = [
    path.join(referenceRoot, "base", "Realmz", "Data Files", TILE_RESOURCE_FILE),
    path.join(referenceRoot, "out_win_clang", "Data Files", TILE_RESOURCE_FILE),
    path.join(referenceRoot, "base", "Realmz", "Data Files", `${TILE_RESOURCE_STEM}.rsf`),
    path.join(referenceRoot, "out_win_clang", "Data Files", `${TILE_RESOURCE_STEM}.rsf`),
    path.join(referenceRoot, "base", "Realmz", "Data Files", TILE_RESOURCE_STEM),
    path.join(referenceRoot, "out_win_clang", "Data Files", TILE_RESOURCE_STEM),
    path.join(referenceRoot, "base", "Realmz", "Data Files", `${TILE_RESOURCE_FILE}.rsf`),
    path.join(referenceRoot, "out_win_clang", "Data Files", `${TILE_RESOURCE_FILE}.rsf`),
  ];
  if (assetRoot) {
    candidates.push(
      path.join(assetRoot, "assets", "realmz", "resources", "binary", `${TILE_RESOURCE_STEM}.rsf`),
      path.join(assetRoot, "assets", "realmz", "resources", "binary", TILE_RESOURCE_STEM),
      path.join(assetRoot, "assets", "realmz", "resources", "binary", `${TILE_RESOURCE_FILE}.rsf`),
      path.join(assetRoot, "assets", "realmz", "resources", "binary", TILE_RESOURCE_FILE),
    );
  }
  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function customResourcePath(scenarioPath) {
  const name = path.basename(scenarioPath);
  const candidates = [
    path.join(scenarioPath, "Scenario.rsrc"),
    path.join(scenarioPath, "Scenario.rsf"),
    path.join(scenarioPath, `${name}.rsrc`),
    path.join(scenarioPath, `${name}.rsf`),
  ];
  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function metadataPath(referenceRoot, scenarioPath, landlook, metadataFile, assetRoot) {
  const baseCandidates = customLandlooks.has(landlook)
    ? [path.join(scenarioPath, metadataFile)]
    : [
        path.join(referenceRoot, "base", "Realmz", "Data Files", metadataFile),
        path.join(referenceRoot, "out_win_clang", "Data Files", metadataFile),
      ];
  if (assetRoot && !customLandlooks.has(landlook)) {
    baseCandidates.push(path.join(assetRoot, "assets", "realmz", "resources", "binary", metadataFile));
  }
  for (const candidate of baseCandidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function metadataSummary(referenceRoot, scenarioPath, landlook, metadataFile, assetRoot) {
  const filePath = await metadataPath(referenceRoot, scenarioPath, landlook, metadataFile, assetRoot);
  if (!filePath) {
    return null;
  }
  const buffer = await fs.readFile(filePath);
  const baseTile = buffer.length >= 8042 ? i16(buffer, 8040) : null;
  const baseScale = buffer.length >= 8044 ? i16(buffer, 8042) : null;
  return { path: filePath, bytes: buffer.length, baseTile, baseScale };
}

async function referenceExtractedPicturePath(rootDir, pictId) {
  const extractedPath = path.join(rootDir, "assets", "realmz", "resources", "pictures", `picture_${pictId}.png`);
  return await exists(extractedPath) ? extractedPath : null;
}

export async function tilemapSourceForLandlook(referenceRoot, scenarioPath, landlook, assetRoot = null) {
  const standard = standardLandlooks.get(landlook);
  const custom = customLandlooks.get(landlook);
  if (!standard && !custom) {
    return null;
  }

  const resourcePath = custom ? await customResourcePath(scenarioPath) : await baseResourcePath(referenceRoot, assetRoot);
  const pictId = (standard || custom).pictId;
  const metadataFile = (standard || custom).metadataFile;
  return {
    landlook,
    custom: Boolean(custom),
    pictId,
    resourceType: "PICT",
    resourcePath,
    metadataFile,
    metadata: await metadataSummary(referenceRoot, scenarioPath, landlook, metadataFile, assetRoot),
  };
}

export async function exportTileAtlas({ rootDir, assetRoot = rootDir, referenceRoot, scenarioPath, landlook, force = false }) {
  const targetPath = tileAtlasCachePath(rootDir, scenarioPath, landlook);
  if (!force && await exists(targetPath)) {
    return { available: true, created: false, path: targetPath, landlook };
  }

  const source = await tilemapSourceForLandlook(referenceRoot, scenarioPath, landlook, assetRoot);
  if (!source) {
    throw new Error(`No tilemap source is known for landlook ${landlook}`);
  }

  const extractedPath = await referenceExtractedPicturePath(assetRoot, source.pictId);
  if (extractedPath && !source.custom) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(extractedPath, targetPath);
    const metadata = {
      ...source,
      width: 640,
      height: 320,
      path: targetPath,
      importedFrom: "realmz_tools extracted PNG",
      extractedPath,
    };
    await fs.writeFile(`${targetPath}.json`, JSON.stringify(metadata, null, 2));
    return { available: true, created: true, path: targetPath, width: 640, height: 320, ...source, importedFrom: metadata.importedFrom };
  }

  if (!source.resourcePath) {
    throw new Error(`No tilemap resource file was found for landlook ${landlook}`);
  }

  const pict = await readResource(source.resourcePath, "PICT", source.pictId);
  if (!pict) {
    throw new Error(`PICT ${source.pictId} was not found in ${source.resourcePath}`);
  }

  const image = decodePictPackBits8(pict);
  const png = encodePngRgba(image.width, image.height, image.rgba);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, png);
  await fs.writeFile(`${targetPath}.json`, JSON.stringify({ ...source, width: image.width, height: image.height, path: targetPath }, null, 2));
  return { available: true, created: true, path: targetPath, width: image.width, height: image.height, ...source };
}

export async function exportTileAtlases({ rootDir, assetRoot = rootDir, referenceRoot, scenarioPath, landlooks, force = false }) {
  const results = [];
  for (const landlook of landlooks) {
    try {
      results.push(await exportTileAtlas({ rootDir, assetRoot, referenceRoot, scenarioPath, landlook, force }));
    } catch (error) {
      results.push({ available: false, landlook, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}
