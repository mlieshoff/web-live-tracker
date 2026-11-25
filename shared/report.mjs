import { translateDiagnostic } from "./panel-language.mjs";
import { reportMessages } from "./report-language.mjs";

const groups = ["images", "media", "documents", "otherFiles"];
const imageExtensions = new Set(["avif", "bmp", "gif", "jpg", "png", "tiff", "webp"]);
const videoPreviewExtensions = new Set(["m4v", "mov", "mp4", "ogv", "webm"]);
const mediaExtensions = new Set(["aac", "flac", "m4a", "m4v", "mkv", "mov", "mp3", "mp4", "mpeg", "ogg", "ogv", "ts", "wav", "webm"]);
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

function fileRow(file, caption, suffix, preview, svgViews, messages) {
  const view = file.svg && svgViews.get(file.path);
  if (view) return `<li>${newTabLink(`#${view}`, caption)}${suffix}</li>`;
  if (!file.svg || !preview) return `<li>${fileLink(file.path, caption, preview)}${suffix}</li>`;

  const id = `svg-view-${svgViews.size + 1}`;
  svgViews.set(file.path, id);
  return `<li id="${id}" class="svg-view">
    ${newTabLink(`#${id}`, caption, preview)}<span class="file-details">${suffix}</span>
    <div class="svg-view-actions">
      <a href="#files">${messages.back}</a>
      ${fileLink(file.path, messages.openSavedFile)}
    </div>
  </li>`;
}

function fileExtension(file) {
  return file.path.split(".").at(-1).toLowerCase();
}

function fileGroup(file) {
  const extension = fileExtension(file);
  if (file.svg || imageExtensions.has(extension)) return "images";
  if (mediaExtensions.has(extension)) return "media";
  if (documentExtensions.has(extension)) return "documents";
  return "otherFiles";
}

function mediaPreview(file, partial) {
  if (file.svg) {
    // SVG is loaded as a non-interactive image, never as markup or a linked document.
    return file.svgPreview
      ? `<img class="thumbnail" src="data:image/svg+xml;base64,${escapeHtml(file.svgPreview)}" alt="" loading="lazy" decoding="async">`
      : "";
  }

  const extension = fileExtension(file);
  const href = fileHref(file.path);
  if (imageExtensions.has(extension) && extension !== "tiff") {
    return `<img class="thumbnail" src="${href}" alt="" loading="lazy" decoding="async">`;
  }
  if (!partial && videoPreviewExtensions.has(extension)) {
    return `<video class="thumbnail" src="${href}" muted playsinline preload="metadata" loading="lazy" aria-hidden="true"></video>`;
  }
  return "";
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

export function captureReport({ researchId, startedAt, records, unreadable = 0, folderUnavailable = false, folderNotSelected = false, historyOnly = false, language = "en" }) {
  const locale = language === "de" ? "de" : "en";
  const messages = reportMessages[locale];
  const groupedFiles = new Map(groups.map((group) => [group, []]));
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
  const previewed = new Set();
  const svgViews = new Map();
  let saved = 0;

  for (const [index, record] of records.entries()) {
    const { metadata, request, response, indexPath, error, earlier } = record;
    const url = metadata ? new URL(metadata.url) : null;
    const host = url?.host ?? record.host;
    const resource = url ? url.pathname.split("/").filter(Boolean).at(-1) : record.name;
    sites.add(host);
    const name = resource ? `${resource} · ${host}` : host;
    const details = `<a href="#exchange-${index + 1}">${messages.captureDetails}</a>`;
    const partial = metadata?.status === 206 && response?.source !== "refetched";
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
          const badges = direction === "response" && partial ? ` · ${messages.partialFile}` : "";
          const caption = `${name} (${label.toLowerCase()})`;
          const earlierLabel = earlier ? ` · ${messages.earlierCapture}` : "";
          const preview = previewed.has(file.path) ? "" : mediaPreview(file, direction === "response" && partial);
          if (preview) previewed.add(file.path);
          const suffix = `${badges}${earlierLabel} · ${details}`;
          groupedFiles.get(fileGroup(file)).push(fileRow(file, caption, suffix, preview, svgViews, messages));
          saved += 1;
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
      ? `${escapeHtml(metadata.method)} ${escapeHtml(metadata.url)} · ${messages.status} ${escapeHtml(metadata.status)}`
      : messages.filesInFolder;
    exchanges.push(`<details>
      <summary>${escapeHtml(name)} · ${escapeHtml(time)}${earlier ? ` · ${messages.earlierCapture}` : ""}</summary>
      <p id="exchange-${index + 1}">${technicalDetails}</p>
      ${error ? `<p>${escapeHtml(translateDiagnostic(locale, error))}</p>` : `<ul>${notes.join("")}</ul>`}
      ${raw}
    </details>`);
  }

  const categories = groups
    .filter((group) => groupedFiles.get(group).length > 0)
    .map((group) => `<h3>${messages[group]}</h3><ul>${groupedFiles.get(group).join("")}</ul>`)
    .join("");

  return new Blob([`<!doctype html>
<html lang="${locale}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file: data:; media-src file:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(researchId)} · ${messages.title}</title>
<style>
  :root { color-scheme: light dark; font: 16px/1.55 system-ui, sans-serif; }
  body { max-width: 54rem; padding: 1.5rem; margin: auto; overflow-wrap: anywhere; }
  nav { display: flex; flex-wrap: wrap; gap: 1rem; }
  section { border-top: 1px solid GrayText; margin-top: 2rem; }
  li, details { margin-block: .55rem; }
  summary { cursor: pointer; }
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
  .svg-view:target .file-details { display: none; }
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
  <p>${historyOnly ? messages.created : messages.started} ${escapeHtml(startedAt.toLocaleString(locale))} · ${messages.saved(saved)}</p>
  <p>Downloads/web-live-tracker/${escapeHtml(researchId)}/</p>
  ${records.some((record) => record.earlier) ? `<p>${messages.earlierNote}</p>` : ""}
  ${sites.size ? `<p>${messages.websites} · ${escapeHtml([...sites].join(", "))}</p>` : ""}
  <nav aria-label="${messages.sections}">
    <a href="#files">${messages.savedFiles}</a><a href="#issues">${messages.issues}</a><a href="#details">${messages.technicalDetails}</a>
  </nav>
  <section id="files">
    <h2>${messages.savedFiles}</h2>
    ${categories || `<p>${messages.noFiles}</p>`}
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
</html>`], { type: "text/html;charset=utf-8" });
}
