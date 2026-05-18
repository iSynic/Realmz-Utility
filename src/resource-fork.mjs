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
