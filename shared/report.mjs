import { translateDiagnostic } from "./panel-language.mjs";
import { reportMessages } from "./report-language.mjs";

// The downloaded report authorizes only this fixed script. Keep the hash in sync with its exact text.
const tipScript = `
(() => {
  const output = document.querySelector("#report-tip");
  const tips = document.querySelector("#report-tips").content.querySelectorAll("span");
  let current = Math.floor(Math.random() * tips.length);
  output.textContent = tips[current].textContent;

  const tipIntervalMs = 60_000;
  setInterval(() => {
    const next = Math.floor(Math.random() * (tips.length - 1));
    current = next >= current ? next + 1 : next;
    output.textContent = tips[current].textContent;
  }, tipIntervalMs);
})();
`;
const tipScriptHash = "sha256-9Wq0ZUxigNE2psSs+utQcmJnAIQZ1/3ae4P54e6QJI8=";

import { isImageFilename } from "./payload.mjs";

const groups = ["images", "media", "documents", "otherFiles"];
const audioPlayerExtensions = new Set(["aac", "flac", "m4a", "mp3", "ogg", "wav"]);
const videoPlayerExtensions = new Set(["m4v", "mov", "mp4", "ogv", "webm"]);
const mediaExtensions = new Set([...audioPlayerExtensions, ...videoPlayerExtensions, "mkv", "mpeg", "ts"]);
const documentExtensions = new Set(["csv", "json", "pdf", "tsv", "txt"]);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function fileHref(path) {
  // Reports live in the research folder. Skip the download and research folder names.
  const href = path.split("/").slice(2).map(encodeURIComponent).join("/");
  return `./${escapeHtml(href)}`;
}

function newTabLink(href, label, preview = "") {
  const className = preview ? ' class="preview-link"' : "";
  return `<a${className} target="_blank" rel="noopener noreferrer" href="${href}">${preview}${escapeHtml(label)}</a>`;
}

function fileLink(path, label, preview) {
  return newTabLink(fileHref(path), label, preview);
}

function fileEntryLink(file, caption, preview, id, messages) {
  if (!id) return fileLink(file.path, caption, preview);

  return `<div id="${id}" class="svg-view">
    ${newTabLink(`#${id}`, caption, preview)}
    <div class="svg-view-actions">
      <a href="#files">${messages.back}</a>
      ${fileLink(file.path, messages.openSavedFile)}
    </div>
  </div>`;
}

function fileExtension(file) {
  return file.path.split(".").at(-1).toLowerCase();
}

function fileGroup(file) {
  const extension = fileExtension(file);
  if (file.svg || isImageFilename(file.path)) return "images";
  if (mediaExtensions.has(extension)) return "media";
  if (documentExtensions.has(extension)) return "documents";
  return "otherFiles";
}

function imagePreview(file) {
  if (file.svg) {
    // SVG is loaded as a non-interactive image, never as markup or a linked document.
    return file.svgPreview
      ? `<img class="thumbnail" src="data:image/svg+xml;base64,${escapeHtml(file.svgPreview)}" alt="" loading="lazy" decoding="async">`
      : "";
  }

  const extension = fileExtension(file);
  const href = fileHref(file.path);
  if (isImageFilename(file.path) && extension !== "tiff") {
    return `<img class="thumbnail" src="${href}" alt="" loading="lazy" decoding="async">`;
  }
  return "";
}

function mediaPlayer(file, caption, mediaType) {
  const extension = fileExtension(file);
  const audioWebm = extension === "webm" && /^audio\/webm(?:\s*;|\s*$)/i.test(mediaType);
  let tag;
  if (audioWebm || audioPlayerExtensions.has(extension)) {
    tag = "audio";
  } else if (videoPlayerExtensions.has(extension)) {
    tag = "video";
  } else {
    return "";
  }
  return `<${tag} class="media-player" src="${fileHref(file.path)}" controls preload="none" aria-label="${escapeHtml(caption)}"></${tag}>`;
}

function isPartialResponse(metadata, response) {
  if (metadata?.status !== 206 || response?.source === "refetched") return false;
  const range = /^bytes 0-(\d+)\/(\d+)$/i.exec(metadata.responseRange);
  if (!range || !Number.isSafeInteger(response?.size) || response.size <= 0) return true;
  return Number(range[1]) !== response.size - 1 || Number(range[2]) !== response.size;
}

function fileDescription(file, direction, messages) {
  if (file.path) return fileLink(file.path, direction === "response" ? messages.openReceivedFile : messages.openSentFile);
  if (file.status === "absent") {
    return direction === "response" ? messages.responseAbsent : messages.requestAbsent;
  }
  if (file.status === "missing-from-folder") return messages.fileMissing;
  if (file.status === "saved") return messages.fileUnsaved;
  return messages.fileUnavailable;
}

function renderSources(sources, messages, collapsible = false) {
  return [...sources].map(([url, captures]) => {
    const source = url ? `<div>${messages.sourceUrl} <span>${escapeHtml(url)}</span></div>` : "";
    if (collapsible) return source + `<ul>${captures.map(({ html }) => `<li>${html}</li>`).join("")}</ul>`;
    return source + captures.map(({ html }) => `<div>${html}</div>`).join("");
  }).join("");
}

function fileSourceDetails(sources, messages) {
  const earlierSources = new Map();
  const currentSources = new Map();
  let earlierCount = 0;
  for (const [url, captures] of sources) {
    const earlier = captures.filter((capture) => capture.earlier);
    const current = captures.filter((capture) => !capture.earlier);
    if (earlier.length) earlierSources.set(url, earlier);
    if (current.length) currentSources.set(url, current);
    earlierCount += earlier.length;
  }
  if (earlierCount < 2) return renderSources(sources, messages);

  return renderSources(currentSources, messages) +
    `<details class="earlier-captures"><summary>${messages.earlierCaptureDetails} (${earlierCount})</summary>` +
    renderSources(earlierSources, messages, true) + "</details>";
}

export function captureReport({ researchId, startedAt, records, unreadable = 0, folderUnavailable = false, folderNotSelected = false, historyOnly = false, language = "en" }) {
  const locale = language === "de" ? "de" : "en";
  const messages = reportMessages[locale];
  const fileOrder = new Intl.Collator(locale, { sensitivity: "accent" });
  const groupedFiles = new Map(groups.map((group) => [group, []]));
  const savedFiles = new Map();
  const imageKeysByPath = new Map();
  for (const { response } of records) {
    if (response?.path && response.contentKey && fileGroup(response) === "images") {
      const type = response.svg ? "svg" : fileExtension(response);
      imageKeysByPath.set(response.path, `image:${type}:${response.contentKey}`);
    }
  }
  const sizeFormat = new Intl.NumberFormat(locale, { style: "unit", unit: "byte", unitDisplay: "long" });
  const issues = [];
  if (folderUnavailable) {
    issues.push(`<li>${messages.folderUnavailable}</li>`);
  } else if (folderNotSelected) {
    issues.push(`<li>${messages.folderNotSelected}</li>`);
  }
  if (unreadable) {
    issues.push(`<li>${messages.unreadable(unreadable)}</li>`);
  }
  const exchanges = [];
  const sites = new Set();

  for (const [index, record] of records.entries()) {
    const { metadata, request, response, indexPath, error, earlier } = record;
    const url = metadata ? new URL(metadata.url) : null;
    const sourceUrl = url ? url.origin + url.pathname : null;
    const host = url?.host ?? record.host;
    const resource = url ? url.pathname.split("/").filter(Boolean).at(-1) : record.name;
    sites.add(host);
    const name = resource ? `${resource} · ${host}` : host;
    const details = `<a href="#exchange-${index + 1}">${messages.captureDetails}</a>`;
    const partial = isPartialResponse(metadata, response);
    const notes = [];

    if (error) {
      issues.push(`<li>${escapeHtml(name)}. ${escapeHtml(translateDiagnostic(locale, error))} ${details}</li>`);
    } else {
      for (const [direction, file] of [["request", request], ["response", response]]) {
        if (file.status === "unknown") continue;
        const description = fileDescription(file, direction, messages);
        const label = direction === "response" ? messages.received : messages.sent;
        notes.push(`<li>${label} — ${description}</li>`);
        if (file.path) {
          const isPartial = direction === "response" && partial;
          const savedKey = imageKeysByPath.get(file.path) ?? file.path;
          const entry = savedFiles.get(savedKey) ?? {
            file, name: resource ?? host, caption: `${name} (${label.toLowerCase()})`,
            sources: new Map(), size: file.size,
          };
          if (file.svgPreview || (file.svg && !entry.file.svg)) {
            entry.file = { ...file, path: entry.file.path };
          }
          entry.size ??= file.size;
          if (direction === "response") entry.mediaType ??= metadata?.mediaType;
          const source = entry.sources.get(sourceUrl) ?? [];
          const html = [label, isPartial && messages.partialFile, earlier && messages.earlierCapture, details]
            .filter(Boolean).join(" · ");
          source.push({ earlier, html });
          entry.sources.set(sourceUrl, source);
          savedFiles.set(savedKey, entry);
        } else if (file.status !== "absent") {
          issues.push(`<li>${escapeHtml(name)} · ${label}. ${description} ${details}</li>`);
        }
      }
      if (partial && response.path) {
        issues.push(`<li>${fileLink(response.path, name)}. ${messages.partialWarning} ${details}</li>`);
      }
      if (response.source === "refetched") {
        notes.push(`<li>${messages.refetched}</li>`);
      }
      if (!indexPath && !earlier) {
        issues.push(`<li>${escapeHtml(name)}. ${messages.rawSaveFailed} ${details}</li>`);
      }
    }

    const raw = indexPath ? fileLink(indexPath, messages.openRawRecord) : "";
    const time = metadata?.timestamp ?? new Date(record.capturedAt).toLocaleDateString(locale);
    const technicalDetails = metadata
      ? `${escapeHtml(metadata.method)} ${escapeHtml(sourceUrl)} · ${messages.status} ${escapeHtml(metadata.status)}`
      : messages.filesInFolder;
    exchanges.push(`<details>
      <summary>${escapeHtml(name)} · ${escapeHtml(time)}${earlier ? ` · ${messages.earlierCapture}` : ""}</summary>
      <p id="exchange-${index + 1}">${technicalDetails}</p>
      ${error ? `<p>${escapeHtml(translateDiagnostic(locale, error))}</p>` : `<ul>${notes.join("")}</ul>`}
      ${raw}
    </details>`);
  }

  let nextView = 0;
  for (const { file, name, caption, sources, size, mediaType } of savedFiles.values()) {
    const group = fileGroup(file);
    const preview = group === "images" ? imagePreview(file) : "";
    const player = group === "media" ? mediaPlayer(file, caption, mediaType) : "";
    const viewId = file.svg && preview ? `svg-view-${++nextView}` : null;
    const link = fileEntryLink(file, caption, preview, viewId, messages);
    const sizeText = Number.isSafeInteger(size) && size >= 0 ? `<div>${escapeHtml(sizeFormat.format(size))}</div>` : "";
    const sourceDetails = fileSourceDetails(sources, messages);
    groupedFiles.get(group).push({ name, link, player, details: sizeText + sourceDetails });
  }

  const categories = groups
    .filter((group) => groupedFiles.get(group).length > 0)
    .map((group) => {
      const files = groupedFiles.get(group)
        .sort((left, right) => fileOrder.compare(left.name, right.name));
      const heading = `<h3 id="files-${group}">${messages[group]}</h3>`;
      if (group === "images" || group === "media") {
        const tiles = files.map(({ link, player, details }) =>
          `<li>${link}${player}<div class="gallery-details">${details}</div></li>`
        ).join("");
        return `${heading}<ul class="file-gallery" role="list" aria-labelledby="files-${group}">${tiles}</ul>`;
      }
      if (group === "documents") {
        const items = files.map(({ link, details }) => `<li>${link}${details}</li>`).join("");
        return `${heading}<ul aria-labelledby="files-${group}">${items}</ul>`;
      }
      const rows = files.map(({ link, details }) => `<tr><td>${link}</td><td>${details}</td></tr>`).join("");
      return `${heading}<table aria-labelledby="files-${group}"><thead><tr><th scope="col">${messages.file}</th><th scope="col">${messages.captureDetails}</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join("");

  return new Blob([`<!doctype html>
<html lang="${locale}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src '${tipScriptHash}'; img-src file: data:; media-src file:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(researchId)} · ${messages.title}</title>
<style>
  :root { color-scheme: light dark; font: 16px/1.55 system-ui, sans-serif; }
  body { box-sizing: border-box; max-width: 100rem; padding: clamp(.75rem, 2vw, 1.5rem); margin: auto; overflow-wrap: anywhere; }
  nav { display: flex; flex-wrap: wrap; gap: 1rem; }
  section { border-top: 1px solid GrayText; margin-top: 2rem; }
  li, details { margin-block: .55rem; }
  summary { cursor: pointer; }
  .tip-of-the-day { margin-block: 1.5rem 0; padding: .75rem 1rem; border-inline-start: .25rem solid GrayText; }
  .tip-of-the-day h3, .tip-of-the-day p { margin: 0; }
  .tip-of-the-day p { margin-block-start: .25rem; }
  .earlier-captures ul { margin-block: .25rem .5rem; padding-inline-start: 1.25rem; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid GrayText; padding: .55rem; text-align: start; vertical-align: top; }
  .file-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 8rem), 1fr));
    gap: 1rem;
    list-style: none;
    padding: 0;
  }
  .file-gallery > li {
    min-width: 0;
    margin: 0;
    padding: .75rem;
    border: 1px solid GrayText;
    border-radius: .5rem;
  }
  .file-gallery .preview-link { display: block; }
  .gallery-details { margin-top: .35rem; font-size: .875rem; }
  .preview-link { display: inline-block; max-width: 100%; }
  .thumbnail {
    display: block;
    width: 7rem;
    height: 4.5rem;
    margin-block: .3rem;
    border: 1px solid GrayText;
    border-radius: .35rem;
    background: #fff;
    object-fit: contain;
    pointer-events: none;
  }
  .file-gallery .thumbnail { box-sizing: border-box; width: 100%; height: 7rem; }
  .file-gallery[aria-labelledby="files-media"] {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  }
  .media-player { display: block; width: 100%; max-height: 18rem; margin-block: .35rem; }
  :target { outline: 2px solid currentColor; outline-offset: .25rem; }
  .svg-view-actions { display: none; }
  main:has(.svg-view:target) { visibility: hidden; }
  .svg-view:target {
    position: fixed;
    inset: 0;
    box-sizing: border-box;
    overflow: auto;
    margin: 0;
    padding: 1.5rem;
    z-index: 1;
    display: grid;
    grid-template-rows: auto minmax(min-content, 1fr);
    gap: 1rem;
    visibility: visible;
    background: Canvas;
    color: CanvasText;
    outline: none;
  }
  .svg-view:target .svg-view-actions {
    grid-row: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .svg-view:target .preview-link {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    justify-items: center;
    min-height: 0;
    color: CanvasText;
    text-decoration: none;
    pointer-events: none;
  }
  .svg-view:target .thumbnail {
    width: 100%;
    height: 100%;
    max-height: calc(100dvh - 7rem);
    margin: 0;
  }
</style>
<main>
  <h1>${escapeHtml(researchId)} · ${messages.title}</h1>
  <p>${historyOnly ? messages.created : messages.started} ${escapeHtml(startedAt.toLocaleString(locale))} · ${messages.saved(savedFiles.size)}</p>
  <p>Downloads/web-live-tracker/${escapeHtml(researchId)}/</p>
  ${records.some((record) => record.earlier) ? `<p>${messages.earlierNote}</p>` : ""}
  ${sites.size ? `<p>${messages.websites} · ${escapeHtml([...sites].join(", "))}</p>` : ""}
  <nav aria-label="${messages.sections}">
    <a href="#files">${messages.savedFiles}</a><a href="#issues">${messages.issues}</a><a href="#details">${messages.technicalDetails}</a>
  </nav>
  <section id="files">
    <h2>${messages.savedFiles}</h2>
    ${categories || `<p>${messages.noFiles}</p>`}
    <aside class="tip-of-the-day" aria-labelledby="report-tip-heading">
      <h3 id="report-tip-heading">${messages.tipOfTheDay}</h3>
      <p id="report-tip">${escapeHtml(messages.tips[0])}</p>
      <template id="report-tips">${messages.tips.map((tip) => `<span>${escapeHtml(tip)}</span>`).join("")}</template>
    </aside>
  </section>
  <section id="issues">
    <h2>${messages.issues}</h2>
    ${issues.length ? `<ul>${issues.join("")}</ul>` : `<p>${messages.noIssues}</p>`}
  </section>
  <section id="details">
    <h2>${messages.technicalDetails}</h2>
    ${exchanges.join("") || (historyOnly ? `<p>${messages.noHistory}</p>` : `<p>${messages.noRequests}</p>`)}
  </section>
</main>
<script>${tipScript}</script>
</html>`], { type: "text/html;charset=utf-8" });
}
