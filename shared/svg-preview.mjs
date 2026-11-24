const maxSvgBytes = 64 * 1024;
const maxPreviewBytes = 1024 * 1024;

export function isSvgMediaType(mediaType) {
  return typeof mediaType === "string" && mediaType.split(";", 1)[0].trim().toLowerCase() === "image/svg+xml";
}

export function createSvgPreviewReader() {
  const previews = new Map();
  let bytes = 0;

  return async (path, readBlob) => {
    if (!path || !readBlob) return undefined;
    if (previews.has(path)) return previews.get(path);
    if (bytes >= maxPreviewBytes) return undefined;

    try {
      const blob = await readBlob();
      if (!blob.size || blob.size > maxSvgBytes || bytes + blob.size > maxPreviewBytes) return undefined;
      const data = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < data.length; offset += 8192) {
        binary += String.fromCharCode(...data.subarray(offset, offset + 8192));
      }
      const preview = btoa(binary);
      previews.set(path, preview);
      bytes += blob.size;
      return preview;
    } catch {
      // A preview failure cannot prevent saving or linking the captured file.
      return undefined;
    }
  };
}
