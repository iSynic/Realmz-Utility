const APPLE_SINGLE_MAGIC = 0x00051600;
const APPLE_DOUBLE_MAGIC = 0x00051607;
const RESOURCE_FORK_ENTRY_ID = 2;

function u16(buffer, offset) {
  if (!buffer || offset < 0 || offset + 2 > buffer.length) {
    return null;
  }
  return buffer.readUInt16BE(offset);
}

function u32(buffer, offset) {
  if (!buffer || offset < 0 || offset + 4 > buffer.length) {
    return null;
  }
  return buffer.readUInt32BE(offset);
}

export function extractResourceFork(buffer) {
  if (!buffer || buffer.length < 26) {
    return buffer;
  }

  const magic = u32(buffer, 0);
  if (magic !== APPLE_SINGLE_MAGIC && magic !== APPLE_DOUBLE_MAGIC) {
    return buffer;
  }

  const entryCount = u16(buffer, 24);
  if (!Number.isInteger(entryCount)) {
    return buffer;
  }

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = 26 + index * 12;
    const id = u32(buffer, entryOffset);
    const offset = u32(buffer, entryOffset + 4);
    const length = u32(buffer, entryOffset + 8);
    if (id === RESOURCE_FORK_ENTRY_ID && Number.isInteger(offset) && Number.isInteger(length) && offset + length <= buffer.length) {
      return buffer.subarray(offset, offset + length);
    }
  }

  return buffer;
}

export function parseResourceFork(buffer) {
  buffer = extractResourceFork(buffer);
  if (!buffer || buffer.length < 32) {
    return [];
  }

  const dataOffset = u32(buffer, 0);
  const mapOffset = u32(buffer, 4);
  if (!Number.isInteger(dataOffset) || !Number.isInteger(mapOffset) || mapOffset + 28 > buffer.length) {
    return [];
  }

  const typeListRelativeOffset = u16(buffer, mapOffset + 24);
  if (!Number.isInteger(typeListRelativeOffset)) {
    return [];
  }
  const typeListOffset = mapOffset + typeListRelativeOffset;
  if (typeListOffset + 2 > buffer.length) {
    return [];
  }

  const rawTypeCount = u16(buffer, typeListOffset);
  if (!Number.isInteger(rawTypeCount)) {
    return [];
  }

  const typeCount = rawTypeCount + 1;
  const resources = [];

  for (let typeIndex = 0; typeIndex < typeCount; typeIndex += 1) {
    const typeOffset = typeListOffset + 2 + typeIndex * 8;
    if (typeOffset + 8 > buffer.length) {
      continue;
    }

    const type = buffer.toString("ascii", typeOffset, typeOffset + 4);
    const rawResourceCount = u16(buffer, typeOffset + 4);
    const refListRelativeOffset = u16(buffer, typeOffset + 6);
    if (!Number.isInteger(rawResourceCount) || !Number.isInteger(refListRelativeOffset)) {
      continue;
    }

    const resourceCount = rawResourceCount + 1;
    const refListOffset = typeListOffset + refListRelativeOffset;

    for (let refIndex = 0; refIndex < resourceCount; refIndex += 1) {
      const refOffset = refListOffset + refIndex * 12;
      if (refOffset + 12 > buffer.length) {
        continue;
      }

      const id = buffer.readInt16BE(refOffset);
      const dataRelativeOffset = (buffer[refOffset + 5] << 16) | (buffer[refOffset + 6] << 8) | buffer[refOffset + 7];
      const lengthOffset = dataOffset + dataRelativeOffset;
      const length = u32(buffer, lengthOffset);
      if (!Number.isInteger(length) || lengthOffset + 4 + length > buffer.length) {
        continue;
      }

      resources.push({
        type,
        id,
        attributes: buffer[refOffset + 4],
        offset: lengthOffset + 4,
        length,
        data: buffer.subarray(lengthOffset + 4, lengthOffset + 4 + length),
      });
    }
  }

  return resources;
}
