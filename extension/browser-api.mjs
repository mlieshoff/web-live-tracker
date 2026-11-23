const gecko = globalThis.browser?.runtime?.getManifest()?.browser_specific_settings?.gecko;

export const isFirefox = Boolean(gecko);
export const extensionApi = isFirefox ? globalThis.browser : globalThis.chrome;

export function readResponseContent(entry, callback, firefox = isFirefox) {
  if (!firefox) {
    return entry.getContent(callback);
  }

  return entry.getContent().then(
    ([content]) => callback(content, entry.response.content?.encoding),
    () => callback(undefined),
  );
}
