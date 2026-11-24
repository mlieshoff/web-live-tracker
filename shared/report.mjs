const groups = ["Images", "Audio and video", "Documents", "Other files"];
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

function fileRow(file, caption, suffix, preview, svgViews) {
  const view = file.svg && svgViews.get(file.path);
  if (view) return `<li>${newTabLink(`#${view}`, caption)}${suffix}</li>`;
  if (!file.svg || !preview) return `<li>${fileLink(file.path, caption, preview)}${suffix}</li>`;

  const id = `svg-view-${svgViews.size + 1}`;
  svgViews.set(file.path, id);
  return `<li id="${id}" class="svg-view">
    ${newTabLink(`#${id}`, caption, preview)}<span class="file-details">${suffix}</span>
    <div class="svg-view-actions">
      <a href="#files">Back to report</a>
      ${fileLink(file.path, "Open saved file")}
    </div>
  </li>`;
}

function fileExtension(file) {
  return file.path.split(".").at(-1).toLowerCase();
}

function fileGroup(file) {
  const extension = fileExtension(file);
  if (file.svg || imageExtensions.has(extension)) return "Images";
  if (mediaExtensions.has(extension)) return "Audio and video";
  if (documentExtensions.has(extension)) return "Documents";
  return "Other files";
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

function fileDescription(file, direction) {
  if (file.path) return fileLink(file.path, direction === "response" ? "Open received file" : "Open sent file");
  if (file.status === "absent") {
    return direction === "response" ? "The website did not send a file." : "The browser did not send a file.";
  }
  if (file.status === "missing-from-folder") return "The earlier file is missing from the research folder.";
  if (file.status === "saved") return "The browser provided the file, but it could not be saved.";
  return "The browser could not provide this file.";
}

export function captureReport({ researchId, startedAt, records, unreadable = 0, folderUnavailable = false, folderNotSelected = false, historyOnly = false }) {
  const groupedFiles = new Map(groups.map((group) => [group, []]));
  const issues = [];
  if (folderUnavailable) {
    issues.push("<li>Earlier files could not be read. Check the research folder in Downloads.</li>");
  } else if (folderNotSelected) {
    issues.push("<li>Use Open capture report in Web Live Tracker to choose the research folder and include earlier files.</li>");
  }
  if (unreadable) {
    issues.push(`<li>${unreadable} raw ${unreadable === 1 ? "record could" : "records could"} not be read.</li>`);
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
    const details = `<a href="#exchange-${index + 1}">Capture details</a>`;
    const partial = metadata?.status === 206 && response?.source !== "refetched";
    const notes = [];

    if (error) {
      issues.push(`<li>${escapeHtml(name)}. ${escapeHtml(error)} ${details}</li>`);
    } else {
      for (const [direction, file] of [["request", request], ["response", response]]) {
        if (file.status === "unknown") continue;
        const description = fileDescription(file, direction);
        const label = direction === "response" ? "Received" : "Sent";
        notes.push(`<li>${label} — ${description}</li>`);
        if (file.path) {
          const badges = direction === "response" && partial ? " · Partial file" : "";
          const caption = `${name} (${label.toLowerCase()})`;
          const earlierLabel = earlier ? " · Earlier capture" : "";
          const preview = previewed.has(file.path) ? "" : mediaPreview(file, direction === "response" && partial);
          if (preview) previewed.add(file.path);
          const suffix = `${badges}${earlierLabel} · ${details}`;
          groupedFiles.get(fileGroup(file)).push(fileRow(file, caption, suffix, preview, svgViews));
          saved += 1;
        } else if (file.status !== "absent") {
          issues.push(`<li>${escapeHtml(name)} · ${label}. ${description} ${details}</li>`);
        }
      }
      if (partial && response.path) {
        issues.push(`<li>${fileLink(response.path, name)}. The website sent only part of this file, so it may not open or play in full. ${details}</li>`);
      }
      if (response.source === "refetched") {
        notes.push("<li>The file was retrieved in a separate download.</li>");
      }
      if (!indexPath && !earlier) {
        issues.push(`<li>${escapeHtml(name)}. The technical record could not be saved. ${details}</li>`);
      }
    }

    const raw = indexPath ? fileLink(indexPath, "Open raw record (JSON)") : "";
    const time = metadata?.timestamp ?? new Date(record.capturedAt).toLocaleDateString();
    const technicalDetails = metadata
      ? `${escapeHtml(metadata.method)} ${escapeHtml(metadata.url)} · Status ${escapeHtml(metadata.status)}`
      : "Files saved in this research folder in Downloads.";
    exchanges.push(`<details>
      <summary>${escapeHtml(name)} · ${escapeHtml(time)}${earlier ? " · Earlier capture" : ""}</summary>
      <p id="exchange-${index + 1}">${technicalDetails}</p>
      ${error ? `<p>${escapeHtml(error)}</p>` : `<ul>${notes.join("")}</ul>`}
      ${raw}
    </details>`);
  }

  const categories = groups
    .filter((group) => groupedFiles.get(group).length > 0)
    .map((group) => `<h3>${group}</h3><ul>${groupedFiles.get(group).join("")}</ul>`)
    .join("");

  return new Blob([`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file: data:; media-src file:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(researchId)} · Capture report</title>
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
  <h1>${escapeHtml(researchId)} · Capture report</h1>
  <p>${historyOnly ? "Report created" : "Started"} ${escapeHtml(startedAt.toLocaleString())} · ${saved} ${saved === 1 ? "file" : "files"} saved</p>
  <p>Downloads/web-live-tracker/${escapeHtml(researchId)}/</p>
  ${records.some((record) => record.earlier) ? "<p>Includes earlier files saved in this research folder. Open their raw records for capture details.</p>" : ""}
  ${sites.size ? `<p>Websites recorded · ${escapeHtml([...sites].join(", "))}</p>` : ""}
  <nav aria-label="Report sections">
    <a href="#files">Saved files</a><a href="#issues">What needs attention</a><a href="#details">Technical details</a>
  </nav>
  <section id="files">
    <h2>Saved files</h2>
    ${categories || "<p>No files were saved in this capture.</p>"}
  </section>
  <section id="issues">
    <h2>What needs attention</h2>
    ${issues.length ? `<ul>${issues.join("")}</ul>` : "<p>No missing files or save problems were recorded.</p>"}
  </section>
  <section id="details">
    <h2>Technical details</h2>
    ${exchanges.join("") || (historyOnly ? "<p>No saved capture records were found for this research ID.</p>" : "<p>No completed requests were recorded.</p>")}
  </section>
</main>
</html>`], { type: "text/html;charset=utf-8" });
}
