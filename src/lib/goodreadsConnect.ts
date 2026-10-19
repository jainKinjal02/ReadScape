/**
 * Importing straight from Goodreads, without the reader handling a file.
 *
 * Goodreads has no API, so this does in an in-app browser what the reader
 * would otherwise do by hand: they sign in on Goodreads' own pages (Readscape
 * never sees their password), then the script below presses "Export Library"
 * on goodreads.com/review/import, waits for Goodreads to prepare the file,
 * and hands the CSV back to the app. The CSV is then imported exactly like an
 * uploaded file (src/lib/goodreads.ts).
 *
 * It depends on Goodreads' page: a button labelled "Export Library" and, once
 * the export is ready, a link labelled "Your export from <date>". If Goodreads
 * changes those, this stops working and the reader is offered the file upload.
 */

/** Where the reader signs in. Goodreads offers Amazon, Apple and email here. */
export const GOODREADS_SIGN_IN_URL = "https://www.goodreads.com/user/sign_in";

/** The page with the "Export Library" button. */
export const GOODREADS_EXPORT_PAGE = "https://www.goodreads.com/review/import";

/**
 * Goodreads serves its full desktop site, which has the export page, to a
 * desktop browser. Its mobile site does not reliably offer the export.
 */
export const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

/** Pages that mean the reader has not finished signing in. */
export function isSignInPage(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/(^|\.)goodreads\.com$/.test(u.hostname)) return true; // Amazon / Apple sign-in pages
    return /^\/(user\/(sign_in|new|sign_up)|ap\/|ap-handler)/.test(u.pathname);
  } catch {
    return true;
  }
}

export function isExportPage(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)goodreads\.com$/.test(u.hostname) && u.pathname.startsWith("/review/import");
  } catch {
    return false;
  }
}

/** Messages the page script posts back to the app. */
export type ConnectMessage =
  | { type: "exporting" }
  | { type: "csv"; text: string; label: string }
  | { type: "stale"; href: string; label: string }
  | { type: "error"; reason: "no-button" | "download"; message?: string };

/** How long Goodreads gets to prepare a new export before we offer the old one. */
export const EXPORT_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * Runs on the export page. Remembers any export link already there (an older
 * export, possibly months stale), presses Export Library, then waits for a
 * link that is new and downloads that one. Survives the page reloading after
 * the click, by keeping its state in sessionStorage.
 */
export const EXPORT_SCRIPT = `
(function () {
  if (window.__readscapeExport) return;
  window.__readscapeExport = true;
  var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  if (location.pathname.indexOf('/review/import') !== 0) return;

  var all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var label = function (el) { return ((el.textContent || el.value || '') + '').replace(/\\s+/g, ' ').trim(); };
  var exportLink = function () {
    return all('a').filter(function (a) { return /^your export from/i.test(label(a)); })[0] || null;
  };
  var exportButton = function () {
    return all('button, input[type=submit], input[type=button], a').filter(function (el) {
      return /^export library$/i.test(label(el));
    })[0] || null;
  };
  var key = function (a) { return a ? a.href + '|' + label(a) : null; };

  var state = null;
  try { state = JSON.parse(sessionStorage.getItem('readscapeExport') || 'null'); } catch (e) {}
  if (!state) {
    var button = exportButton();
    if (!button) { post({ type: 'error', reason: 'no-button' }); return; }
    var before = exportLink();
    state = { before: key(before), beforeLabel: before ? label(before) : null, at: Date.now() };
    sessionStorage.setItem('readscapeExport', JSON.stringify(state));
    post({ type: 'exporting' });
    button.click();
  }

  var download = function (a) {
    fetch(a.href, { credentials: 'include' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (text) {
        sessionStorage.removeItem('readscapeExport');
        post({ type: 'csv', text: text, label: label(a) });
      })
      .catch(function (e) { post({ type: 'error', reason: 'download', message: String(e) }); });
  };
  window.__readscapeDownload = function (href, text) {
    download({ href: href, textContent: text });
  };

  var started = Date.now();
  var tick = function () {
    var a = exportLink();
    if (a && key(a) !== state.before) { download(a); return; }
    if (Date.now() - state.at > ${EXPORT_TIMEOUT_MS}) {
      sessionStorage.removeItem('readscapeExport');
      if (a) post({ type: 'stale', href: a.href, label: label(a) });
      else post({ type: 'error', reason: 'no-button', message: 'export never appeared' });
      return;
    }
    // The finished export may only show after a refresh; this script runs
    // again on the reloaded page and carries on from sessionStorage.
    if (Date.now() - started > 10000) { location.reload(); return; }
    setTimeout(tick, 2000);
  };
  setTimeout(tick, 1500);
})();
true;
`;

/** Ask the page to download a specific export link (the "use the older one" choice). */
export function downloadScript(href: string, label: string): string {
  return `window.__readscapeDownload && window.__readscapeDownload(${JSON.stringify(href)}, ${JSON.stringify(
    label
  )}); true;`;
}
